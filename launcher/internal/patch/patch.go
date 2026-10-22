// Package patch implementa o manifesto, a comparacao e o download dos arquivos.
package patch

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
)

const maxManifestBytes = 16 << 20

type Entry struct {
	Path   string `json:"path"`
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}

type Manifest struct {
	Version   int     `json:"version"`
	Generated string  `json:"generated,omitempty"`
	Files     []Entry `json:"files"`
}

// ValidPath rejeita caminhos que escapam da pasta System.
func ValidPath(p string) error {
	if p == "" || strings.ContainsAny(p, "\\:\x00") || strings.HasPrefix(p, "/") {
		return fmt.Errorf("caminho invalido: %q", p)
	}
	for _, seg := range strings.Split(p, "/") {
		if seg == "" || seg == "." || seg == ".." {
			return fmt.Errorf("caminho invalido: %q", p)
		}
	}
	return nil
}

func (m *Manifest) Validate() error {
	seen := map[string]bool{}
	for _, e := range m.Files {
		if err := ValidPath(e.Path); err != nil {
			return err
		}
		if e.Size < 0 || len(e.SHA256) != 64 {
			return fmt.Errorf("entrada invalida: %q", e.Path)
		}
		if _, err := hex.DecodeString(e.SHA256); err != nil {
			return fmt.Errorf("sha256 invalido: %q", e.Path)
		}
		k := strings.ToLower(e.Path)
		if seen[k] {
			return fmt.Errorf("caminho duplicado: %q", e.Path)
		}
		seen[k] = true
	}
	return nil
}

func FetchManifest(ctx context.Context, c *http.Client, manifestURL string) (*Manifest, error) {
	if err := requireHTTPS(manifestURL); err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, manifestURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("manifesto: HTTP %d", resp.StatusCode)
	}
	var m Manifest
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxManifestBytes)).Decode(&m); err != nil {
		return nil, fmt.Errorf("manifesto invalido: %w", err)
	}
	if err := m.Validate(); err != nil {
		return nil, err
	}
	return &m, nil
}

func requireHTTPS(u string) error {
	p, err := url.Parse(u)
	if err != nil || p.Scheme != "https" || p.Host == "" {
		return fmt.Errorf("URL precisa ser HTTPS: %q", u)
	}
	return nil
}

// HashFile devolve o SHA-256 (hex minusculo) do arquivo.
func HashFile(p string) (string, error) {
	f, err := os.Open(p)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func localPath(root, rel string) string { return filepath.Join(root, filepath.FromSlash(rel)) }

// Ignored diz se o caminho esta na lista de arquivos do jogador (nunca tocados).
func Ignored(rel string, ignore []string) bool {
	for _, i := range ignore {
		if strings.EqualFold(rel, i) {
			return true
		}
	}
	return false
}

// Diff devolve as entradas ausentes ou diferentes no disco.
// onCheck e chamado a cada arquivo verificado (pode ser nil).
func Diff(root string, m *Manifest, ignore []string, onCheck func(done, total int)) ([]Entry, error) {
	var out []Entry
	for i, e := range m.Files {
		if onCheck != nil {
			onCheck(i, len(m.Files))
		}
		if Ignored(e.Path, ignore) {
			continue
		}
		lp := localPath(root, e.Path)
		st, err := os.Stat(lp)
		if err != nil || st.IsDir() || st.Size() != e.Size {
			out = append(out, e)
			continue
		}
		h, err := HashFile(lp)
		if err != nil || h != strings.ToLower(e.SHA256) {
			out = append(out, e)
		}
	}
	return out, nil
}

func fileURL(base, rel string) string {
	segs := strings.Split(rel, "/")
	for i, s := range segs {
		segs[i] = url.PathEscape(s)
	}
	return strings.TrimRight(base, "/") + "/" + path.Join(segs...)
}

// Download baixa e confere um arquivo; so substitui o original se o hash bater.
func Download(ctx context.Context, c *http.Client, baseURL, root string, e Entry, onBytes func(n int64)) error {
	if err := requireHTTPS(baseURL); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fileURL(baseURL, e.Path), nil)
	if err != nil {
		return err
	}
	resp, err := c.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s: HTTP %d", e.Path, resp.StatusCode)
	}
	dst := localPath(root, e.Path)
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	tmp := dst + ".part"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	h := sha256.New()
	n, err := io.Copy(io.MultiWriter(f, h), &countReader{r: io.LimitReader(resp.Body, e.Size+1), cb: onBytes})
	cerr := f.Close()
	if err == nil {
		err = cerr
	}
	if err == nil && n != e.Size {
		err = fmt.Errorf("%s: tamanho %d, esperado %d", e.Path, n, e.Size)
	}
	if err == nil && hex.EncodeToString(h.Sum(nil)) != strings.ToLower(e.SHA256) {
		err = errors.New(e.Path + ": SHA-256 nao confere")
	}
	if err != nil {
		os.Remove(tmp)
		return err
	}
	if err := os.Rename(tmp, dst); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("%s: nao foi possivel substituir (jogo aberto?): %w", e.Path, err)
	}
	return nil
}

type countReader struct {
	r  io.Reader
	cb func(int64)
}

func (c *countReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	if n > 0 && c.cb != nil {
		c.cb(int64(n))
	}
	return n, err
}
