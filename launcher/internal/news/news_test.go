package news

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestClean(t *testing.T) {
	f := Feed{Items: []Item{
		{Kind: "aviso", Title: "  ok  ", Text: "t", URL: "https://l2akamanah.com.br/x"},
		{Kind: "xyz", Title: "outro dominio", URL: "https://evil.example/x"},
		{Kind: "aviso", Title: "http", URL: "http://l2akamanah.com.br/x"},
		{Title: ""},
		{Kind: "correcao", Title: strings.Repeat("a", 200), Text: strings.Repeat("b", 900)},
	}}
	got := Clean(f, "l2akamanah.com.br")
	if len(got) != 4 {
		t.Fatalf("esperava 4 itens, veio %d", len(got))
	}
	if got[0].Title != "ok" || got[0].URL == "" {
		t.Errorf("item 0: %+v", got[0])
	}
	if got[1].Kind != "novidade" || got[1].URL != "" || got[2].URL != "" {
		t.Errorf("tipo/URL nao saneados: %+v %+v", got[1], got[2])
	}
	if len([]rune(got[3].Title)) > 70 || len([]rune(got[3].Text)) > 280 {
		t.Errorf("sem limite de tamanho")
	}
}

func TestFetch(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"items":[{"kind":"recompensa","title":"Caixa","text":"x"}]}`))
	}))
	defer srv.Close()
	items, err := Fetch(context.Background(), srv.Client(), srv.URL+"/news.json")
	if err != nil || len(items) != 1 || items[0].Kind != "recompensa" {
		t.Fatalf("%v %+v", err, items)
	}
	if _, err := Fetch(context.Background(), srv.Client(), "http://x/news.json"); err == nil {
		t.Fatal("http deveria ser recusado")
	}
	_ = url.Parse
}
