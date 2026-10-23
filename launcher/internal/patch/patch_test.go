package patch

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func sum(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }

func TestValidPath(t *testing.T) {
	for _, p := range []string{"", "../x", "a/../b", "/abs", "C:/x", `a\b`, "a//b", "."} {
		if ValidPath(p) == nil {
			t.Errorf("deveria rejeitar %q", p)
		}
	}
	if ValidPath("sub/arquivo.dat") != nil {
		t.Error("deveria aceitar")
	}
}

func TestUpdateFlow(t *testing.T) {
	good := []byte("conteudo novo")
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/patch/a.dat", "/patch/sub/b.dat", "/patch/c.dat":
			w.Write(good)
		case "/patch/bad.dat":
			w.Write([]byte("adulterado"))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, "a.dat"), good, 0o644) // ja correto
	os.WriteFile(filepath.Join(root, "c.dat"), []byte("outro"), 0o644)
	m := &Manifest{Files: []Entry{
		{Path: "a.dat", Size: int64(len(good)), SHA256: sum(good)},
		{Path: "sub/b.dat", Size: int64(len(good)), SHA256: sum(good)},
		{Path: "c.dat", Size: int64(len(good)), SHA256: sum(good)}, // alterado
		{Path: "user.ini", Size: 1, SHA256: sum([]byte("x"))},      // ignorado
	}}
	todo, _ := Diff(Dirs{System: root}, m, []string{"user.ini"}, nil)
	if len(todo) != 2 {
		t.Fatalf("esperava 2 diferencas, veio %d", len(todo))
	}
	c := srv.Client()
	for _, e := range todo {
		if err := Download(context.Background(), c, srv.URL+"/patch", Dirs{System: root}, e, nil); err != nil {
			t.Fatal(err)
		}
	}
	if todo, _ = Diff(Dirs{System: root}, m, []string{"user.ini"}, nil); len(todo) != 0 {
		t.Fatal("ainda ha diferencas")
	}
	// hash errado nao substitui o arquivo original
	bad := Entry{Path: "bad.dat", Size: 10, SHA256: sum([]byte("legitimo"))}
	os.WriteFile(filepath.Join(root, "bad.dat"), []byte("orig"), 0o644)
	if Download(context.Background(), c, srv.URL+"/patch", Dirs{System: root}, bad, nil) == nil {
		t.Fatal("deveria falhar")
	}
	if b, _ := os.ReadFile(filepath.Join(root, "bad.dat")); string(b) != "orig" {
		t.Fatal("original foi sobrescrito")
	}
	if _, err := os.Stat(filepath.Join(root, "bad.dat.part")); err == nil {
		t.Fatal(".part ficou")
	}
}

func TestHTTPSOnly(t *testing.T) {
	if _, err := FetchManifest(context.Background(), http.DefaultClient, "http://x/manifest.json"); err == nil {
		t.Fatal("http deveria ser recusado")
	}
}

func TestSysTexturesBase(t *testing.T) {
	data := []byte("textura")
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/patch/systextures/AkamanahUI.utx" {
			w.Write(data)
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()
	sys, tex := t.TempDir(), t.TempDir()
	d := Dirs{System: sys, SysTextures: tex}
	e := Entry{Path: "AkamanahUI.utx", Size: int64(len(data)), SHA256: sum(data), Base: BaseSysTextures}
	m := &Manifest{Files: []Entry{e}}
	if err := m.Validate(); err != nil {
		t.Fatal(err)
	}
	if todo, _ := Diff(d, m, nil, nil); len(todo) != 1 {
		t.Fatal("deveria faltar a textura")
	}
	if err := Download(context.Background(), srv.Client(), srv.URL+"/patch", d, e, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(tex, "AkamanahUI.utx")); err != nil {
		t.Fatal("nao foi para a SysTextures:", err)
	}
	if _, err := os.Stat(filepath.Join(sys, "AkamanahUI.utx")); err == nil {
		t.Fatal("nao deveria estar na System")
	}
	// ignoreFiles so vale para a System
	if todo, _ := Diff(Dirs{System: sys, SysTextures: t.TempDir()}, m, []string{"AkamanahUI.utx"}, nil); len(todo) != 1 {
		t.Fatal("a lista de ignorados nao pode afetar a SysTextures")
	}
	bad := &Manifest{Files: []Entry{{Path: "a.utx", Size: 1, SHA256: sum(data), Base: "../x"}}}
	if bad.Validate() == nil {
		t.Fatal("base invalida deveria ser recusada")
	}
}
