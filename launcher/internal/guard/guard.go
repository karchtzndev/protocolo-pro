// Package guard: lista negra de processos. Detecta so o obvio; nao e protecao completa.
package guard

import (
	"bufio"
	"os"
	"strings"
)

// LoadBlacklist le um nome por linha (sem .exe), '#' comenta, '*' no fim = prefixo.
func LoadBlacklist(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var out []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		l := strings.ToLower(strings.TrimSpace(sc.Text()))
		l = strings.TrimSuffix(l, ".exe")
		if l == "" || strings.HasPrefix(l, "#") {
			continue
		}
		out = append(out, l)
	}
	return out, sc.Err()
}

// Match devolve os processos em execucao que estao na lista negra (sem repeticao).
func Match(running, blacklist []string) []string {
	seen := map[string]bool{}
	var hit []string
	for _, r := range running {
		n := strings.TrimSuffix(strings.ToLower(r), ".exe")
		for _, b := range blacklist {
			ok := n == b
			if p, star := strings.CutSuffix(b, "*"); star {
				ok = p != "" && strings.HasPrefix(n, p)
			}
			if ok && !seen[n] {
				seen[n] = true
				hit = append(hit, n)
			}
		}
	}
	return hit
}
