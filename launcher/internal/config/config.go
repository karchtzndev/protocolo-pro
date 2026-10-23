// Package config le o launcher.json (ao lado do launcher.exe).
package config

import (
	"encoding/json"
	"fmt"
	"os"
)

type Config struct {
	ServerName   string `json:"serverName"`
	ManifestURL  string `json:"manifestUrl"`
	PatchBaseURL string `json:"patchBaseUrl"`
	// Avisos do meio da janela (HTTPS). Vazio = sem noticias.
	NewsURL   string   `json:"newsUrl"`
	SystemDir string   `json:"systemDir"`
	GameExe   string   `json:"gameExe"`
	GameArgs  []string `json:"gameArgs"`
	// Arquivos do jogador que o patch nunca cria nem substitui.
	IgnoreFiles   []string `json:"ignoreFiles"`
	BlacklistFile string   `json:"blacklistFile"`
	// Se true, deixa jogar mesmo quando o site de patch estiver fora do ar.
	AllowPlayIfUpdateFails bool `json:"allowPlayIfUpdateFails"`
	Hwid                   Hwid `json:"hwid"`
}

// Hwid: Fase 2. Desligado por padrao; o endpoint NAO existe ainda.
type Hwid struct {
	Enabled  bool   `json:"enabled"`
	Endpoint string `json:"endpoint"`
}

func Default() Config {
	return Config{
		ServerName:    "L2 Akamanah",
		ManifestURL:   "https://l2akamanah.com.br/patch/manifest.json",
		PatchBaseURL:  "https://l2akamanah.com.br/patch",
		NewsURL:       "https://l2akamanah.com.br/patch/news.json",
		SystemDir:     "System",
		GameExe:       "l2.exe",
		IgnoreFiles:   []string{"user.ini", "Option.ini", "chatfilter.ini", "l2.log", "l2Second.log", "CheckGrp.log", "HardWare.ini", "WindowsInfo.ini", "s_info.ini"},
		BlacklistFile: "blacklist.txt",
	}
}

func Load(p string) (Config, error) {
	c := Default()
	b, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return c, nil
		}
		return c, err
	}
	if err := json.Unmarshal(b, &c); err != nil {
		return c, fmt.Errorf("launcher.json invalido: %w", err)
	}
	return c, nil
}
