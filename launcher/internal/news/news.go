// Package news baixa o news.json (avisos, recompensas, correcoes) mostrado no centro do launcher.
package news

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const (
	maxBytes = 256 << 10
	maxItems = 8
)

type Item struct {
	Kind  string `json:"kind"`
	Title string `json:"title"`
	Text  string `json:"text"`
	Date  string `json:"date"`
	URL   string `json:"url"`
}

type Feed struct {
	Items []Item `json:"items"`
}

func clip(s string, n int) string {
	r := []rune(strings.TrimSpace(s))
	if len(r) > n {
		r = append(r[:n-1], '…')
	}
	return string(r)
}

// Clean valida e limita o conteudo. Links so valem se forem https do mesmo dominio do feed.
func Clean(f Feed, feedHost string) []Item {
	var out []Item
	for _, it := range f.Items {
		it.Title, it.Text, it.Date = clip(it.Title, 70), clip(it.Text, 280), clip(it.Date, 16)
		if it.Title == "" {
			continue
		}
		switch it.Kind {
		case "aviso", "recompensa", "correcao", "novidade":
		default:
			it.Kind = "novidade"
		}
		if u, err := url.Parse(it.URL); err != nil || u.Scheme != "https" || !strings.EqualFold(u.Hostname(), feedHost) {
			it.URL = ""
		}
		out = append(out, it)
		if len(out) == maxItems {
			break
		}
	}
	return out
}

// Fetch baixa e limpa o feed. Qualquer falha devolve erro; o launcher segue sem noticias.
func Fetch(ctx context.Context, c *http.Client, feedURL string) ([]Item, error) {
	u, err := url.Parse(feedURL)
	if err != nil || u.Scheme != "https" || u.Host == "" {
		return nil, fmt.Errorf("URL das noticias precisa ser HTTPS")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, feedURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("noticias: HTTP %d", resp.StatusCode)
	}
	var f Feed
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxBytes)).Decode(&f); err != nil {
		return nil, fmt.Errorf("noticias invalidas: %w", err)
	}
	return Clean(f, u.Hostname()), nil
}
