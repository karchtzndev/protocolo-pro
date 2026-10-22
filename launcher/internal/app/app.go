// Package app tem o fluxo do launcher sem depender da interface grafica.
package app

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"l2akamanah/launcher/internal/config"
	"l2akamanah/launcher/internal/guard"
	"l2akamanah/launcher/internal/patch"
)

type App struct {
	Cfg  config.Config
	Root string // pasta do launcher.exe
	Log  *log.Logger

	mu      sync.Mutex
	running bool
}

func (a *App) SystemPath() string { return filepath.Join(a.Root, a.Cfg.SystemDir) }

// Progress: texto + fracao do arquivo atual e do total (0..1; <0 = indeterminado).
type Progress func(text string, file, total float64)

// Update compara com o manifesto e baixa so o que difere.
func (a *App) Update(ctx context.Context, prog Progress) error {
	c := &http.Client{Timeout: 5 * time.Minute}
	prog("Buscando lista de arquivos...", -1, -1)
	m, err := patch.FetchManifest(ctx, c, a.Cfg.ManifestURL)
	if err != nil {
		a.Log.Printf("manifesto: %v", err)
		return fmt.Errorf("nao foi possivel obter a lista de atualizacao: %w", err)
	}
	a.Log.Printf("manifesto com %d arquivos", len(m.Files))
	todo, err := patch.Diff(a.SystemPath(), m, a.Cfg.IgnoreFiles, func(i, n int) {
		prog(fmt.Sprintf("Verificando arquivos (%d/%d)", i+1, n), -1, float64(i)/float64(n))
	})
	if err != nil {
		return err
	}
	if len(todo) == 0 {
		a.Log.Print("tudo atualizado")
		prog("Cliente atualizado.", 1, 1)
		return nil
	}
	var total, done int64
	for _, e := range todo {
		total += e.Size
	}
	a.Log.Printf("%d arquivos para baixar (%d bytes)", len(todo), total)
	for i, e := range todo {
		var fileDone int64
		label := fmt.Sprintf("Baixando %s (%d/%d)", e.Path, i+1, len(todo))
		prog(label, 0, float64(done)/float64(max(total, 1)))
		err := patch.Download(ctx, c, a.Cfg.PatchBaseURL, a.SystemPath(), e, func(n int64) {
			done += n
			fileDone += n
			prog(label, float64(fileDone)/float64(max(e.Size, 1)), float64(done)/float64(max(total, 1)))
		})
		if err != nil {
			a.Log.Printf("download %s: %v", e.Path, err)
			return err
		}
		a.Log.Printf("atualizado: %s", e.Path)
	}
	prog("Atualizacao concluida.", 1, 1)
	return nil
}

// CheckBlacklist devolve os processos proibidos em execucao.
func (a *App) CheckBlacklist() ([]string, error) {
	list, err := guard.LoadBlacklist(filepath.Join(a.Root, a.Cfg.BlacklistFile))
	if err != nil {
		return nil, fmt.Errorf("lista negra: %w", err)
	}
	run, err := guard.RunningProcesses()
	if err != nil {
		return nil, err
	}
	return guard.Match(run, list), nil
}

var ErrAlreadyRunning = errors.New("o jogo ja esta aberto por este launcher")

// Launch abre o l2.exe (uma instancia por launcher).
func (a *App) Launch() error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.running {
		return ErrAlreadyRunning
	}
	bad, err := a.CheckBlacklist()
	if err != nil {
		return err
	}
	if len(bad) > 0 {
		a.Log.Printf("bloqueado: %s", strings.Join(bad, ","))
		return fmt.Errorf("feche estes programas antes de jogar: %s", strings.Join(bad, ", "))
	}
	exe := filepath.Join(a.SystemPath(), a.Cfg.GameExe)
	if _, err := os.Stat(exe); err != nil {
		return fmt.Errorf("%s nao encontrado em %s", a.Cfg.GameExe, a.Cfg.SystemDir)
	}
	wait, err := startGame(exe, a.SystemPath(), a.Cfg.GameArgs)
	if err != nil {
		a.Log.Printf("falha ao abrir o jogo: %v", err)
		return fmt.Errorf("nao foi possivel abrir o jogo: %w", err)
	}
	a.running = true
	a.Log.Print("jogo iniciado")
	go func() {
		wait()
		a.mu.Lock()
		a.running = false
		a.mu.Unlock()
		a.Log.Print("jogo encerrado")
	}()
	return nil
}

func (a *App) GameRunning() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.running
}

// FriendlyError traduz erros de rede para uma mensagem que o jogador entende.
func FriendlyError(err error) string {
	var ne net.Error
	var dns *net.DNSError
	if errors.As(err, &dns) || errors.As(err, &ne) || errors.Is(err, context.DeadlineExceeded) {
		return "Sem conexao com a internet ou com o servidor de atualizacao. Verifique sua internet e clique em Verificar arquivos."
	}
	return "Falha na atualizacao. Clique em Verificar arquivos para tentar de novo (detalhes em launcher.log)."
}
