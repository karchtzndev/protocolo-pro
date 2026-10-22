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
		{"a.dat", int64(len(good)), sum(good)},
		{"sub/b.dat", int64(len(good)), sum(good)},
		{"c.dat", int64(len(good)), sum(good)}, // alterado
		{"user.ini", 1, sum([]byte("x"))},      // ignorado
	}}
	todo, _ := Diff(root, m, []string{"user.ini"}, nil)
	if len(todo) != 2 {
		t.Fatalf("esperava 2 diferencas, veio %d", len(todo))
	}
	c := srv.Client()
	for _, e := range todo {
		if err := Download(context.Background(), c, srv.URL+"/patch", root, e, nil); err != nil {
			t.Fatal(err)
		}
	}
	if todo, _ = Diff(root, m, []string{"user.ini"}, nil); len(todo) != 0 {
		t.Fatal("ainda ha diferencas")
	}
	// hash errado nao substitui o arquivo original
	bad := Entry{"bad.dat", 10, sum([]byte("legitimo"))}
	os.WriteFile(filepath.Join(root, "bad.dat"), []byte("orig"), 0o644)
	if Download(context.Background(), c, srv.URL+"/patch", root, bad, nil) == nil {
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
