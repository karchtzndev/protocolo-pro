// Package app tem o fluxo do launcher sem depender da interface grafica.
package app

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
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

	mu    sync.Mutex
	child *os.Process
}

func (a *App) SystemPath() string { return filepath.Join(a.Root, a.Cfg.SystemDir) }

// Progress: texto + fracao (0..1; <0 = indeterminado).
type Progress func(text string, frac float64)

// Update compara com o manifesto e baixa so o que difere.
func (a *App) Update(ctx context.Context, prog Progress) error {
	c := &http.Client{Timeout: 5 * time.Minute}
	prog("Buscando lista de arquivos...", -1)
	m, err := patch.FetchManifest(ctx, c, a.Cfg.ManifestURL)
	if err != nil {
		a.Log.Printf("manifesto: %v", err)
		return fmt.Errorf("nao foi possivel obter a lista de atualizacao: %w", err)
	}
	a.Log.Printf("manifesto com %d arquivos", len(m.Files))
	todo, err := patch.Diff(a.SystemPath(), m, a.Cfg.IgnoreFiles, func(i, n int) {
		prog(fmt.Sprintf("Verificando arquivos (%d/%d)", i+1, n), float64(i)/float64(n))
	})
	if err != nil {
		return err
	}
	if len(todo) == 0 {
		a.Log.Print("tudo atualizado")
		prog("Cliente atualizado.", 1)
		return nil
	}
	var total, done int64
	for _, e := range todo {
		total += e.Size
	}
	a.Log.Printf("%d arquivos para baixar (%d bytes)", len(todo), total)
	for i, e := range todo {
		prog(fmt.Sprintf("Baixando %s (%d/%d)", e.Path, i+1, len(todo)), float64(done)/float64(max(total, 1)))
		err := patch.Download(ctx, c, a.Cfg.PatchBaseURL, a.SystemPath(), e, func(n int64) {
			done += n
		})
		if err != nil {
			a.Log.Printf("download %s: %v", e.Path, err)
			return err
		}
		a.Log.Printf("atualizado: %s", e.Path)
	}
	prog("Atualizacao concluida.", 1)
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
	if a.child != nil {
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
	cmd := exec.Command(exe, a.Cfg.GameArgs...)
	cmd.Dir = a.SystemPath()
	if err := cmd.Start(); err != nil {
		return err
	}
	a.child = cmd.Process
	a.Log.Print("jogo iniciado")
	go func() {
		cmd.Wait()
		a.mu.Lock()
		a.child = nil
		a.mu.Unlock()
		a.Log.Print("jogo encerrado")
	}()
	return nil
}

func (a *App) GameRunning() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.child != nil
}
