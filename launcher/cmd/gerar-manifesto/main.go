// gerar-manifesto: a partir da pasta System aprovada, cria a pasta patch/
// (manifest.json + copia dos arquivos) para publicar em https://.../patch/.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"l2akamanah/launcher/internal/config"
	"l2akamanah/launcher/internal/patch"
)

func main() {
	system := flag.String("system", "System", "pasta System aprovada")
	out := flag.String("out", "patch", "pasta de saida (sera criada/limpa)")
	tex := flag.String("systextures", "", "opcional: pasta com arquivos .utx que vao para a SysTextures do jogador (ex.: AkamanahUI.utx)")
	flag.Parse()

	ignore := config.Default().IgnoreFiles
	if err := run(*system, *tex, *out, ignore); err != nil {
		fmt.Fprintln(os.Stderr, "erro:", err)
		os.Exit(1)
	}
}

func run(system, tex, out string, ignore []string) error {
	if st, err := os.Stat(system); err != nil || !st.IsDir() {
		return fmt.Errorf("pasta System nao encontrada: %s", system)
	}
	if err := os.RemoveAll(out); err != nil {
		return err
	}
	if err := os.MkdirAll(out, 0o755); err != nil {
		return err
	}
	m := patch.Manifest{Version: 1, Generated: time.Now().UTC().Format(time.RFC3339)}
	err := filepath.WalkDir(system, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, _ := filepath.Rel(system, p)
		rel = filepath.ToSlash(rel)
		if patch.Ignored(rel, ignore) || strings.HasSuffix(rel, ".part") {
			return nil
		}
		if err := patch.ValidPath(rel); err != nil {
			return err
		}
		h, err := patch.HashFile(p)
		if err != nil {
			return err
		}
		st, _ := d.Info()
		m.Files = append(m.Files, patch.Entry{Path: rel, Size: st.Size(), SHA256: h})
		return copyFile(p, filepath.Join(out, filepath.FromSlash(rel)))
	})
	if err != nil {
		return err
	}
	if tex != "" {
		err := filepath.WalkDir(tex, func(p string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return err
			}
			rel, _ := filepath.Rel(tex, p)
			rel = filepath.ToSlash(rel)
			if !strings.EqualFold(filepath.Ext(rel), ".utx") {
				return nil
			}
			if err := patch.ValidPath(rel); err != nil {
				return err
			}
			h, err := patch.HashFile(p)
			if err != nil {
				return err
			}
			st, _ := d.Info()
			m.Files = append(m.Files, patch.Entry{Path: rel, Size: st.Size(), SHA256: h, Base: patch.BaseSysTextures})
			return copyFile(p, filepath.Join(out, patch.BaseSysTextures, filepath.FromSlash(rel)))
		})
		if err != nil {
			return err
		}
	}
	sort.Slice(m.Files, func(i, j int) bool {
		if m.Files[i].Base != m.Files[j].Base {
			return m.Files[i].Base < m.Files[j].Base
		}
		return m.Files[i].Path < m.Files[j].Path
	})
	b, _ := json.MarshalIndent(m, "", "  ")
	if err := os.WriteFile(filepath.Join(out, "manifest.json"), b, 0o644); err != nil {
		return err
	}
	fmt.Printf("OK: %d arquivos em %s (suba o conteudo para /patch/ no site)\n", len(m.Files), out)
	return nil
}

func copyFile(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	o, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(o, in); err != nil {
		o.Close()
		return err
	}
	return o.Close()
}
