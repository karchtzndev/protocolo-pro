//go:build windows

package main

import (
	"context"
	"errors"
	"log"
	"os"
	"path/filepath"

	"github.com/lxn/walk"
	. "github.com/lxn/walk/declarative"
	"golang.org/x/sys/windows"

	"l2akamanah/launcher/internal/app"
	"l2akamanah/launcher/internal/config"
)

func main() {
	exe, _ := os.Executable()
	root := filepath.Dir(exe)

	lf, err := os.OpenFile(filepath.Join(root, "launcher.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		lf = os.Stderr
	}
	logger := log.New(lf, "", log.LstdFlags)

	// Instancia unica do launcher.
	name, _ := windows.UTF16PtrFromString(`Local\L2AkamanahLauncher`)
	if _, err := windows.CreateMutex(nil, false, name); errors.Is(err, windows.ERROR_ALREADY_EXISTS) {
		walk.MsgBox(nil, "L2 Akamanah", "O launcher ja esta aberto.", walk.MsgBoxIconInformation)
		return
	}

	cfg, err := config.Load(filepath.Join(root, "launcher.json"))
	if err != nil {
		walk.MsgBox(nil, "L2 Akamanah", err.Error(), walk.MsgBoxIconError)
		return
	}
	a := &app.App{Cfg: cfg, Root: root, Log: logger}
	logger.Print("launcher iniciado")

	var (
		mw      *walk.MainWindow
		status  *walk.Label
		bar     *walk.ProgressBar
		playBtn *walk.PushButton
	)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = MainWindow{
		AssignTo: &mw,
		Title:    cfg.ServerName + " - Launcher",
		Size:     Size{Width: 460, Height: 220},
		MinSize:  Size{Width: 460, Height: 220},
		Layout:   VBox{Margins: Margins{Left: 20, Top: 16, Right: 20, Bottom: 16}},
		Children: []Widget{
			Label{Text: "L2 AKAMANAH", Font: Font{Family: "Segoe UI", PointSize: 22, Bold: true}, TextAlignment: AlignCenter},
			Label{AssignTo: &status, Text: "Iniciando..."},
			ProgressBar{AssignTo: &bar, MinValue: 0, MaxValue: 1000},
			Label{Text: "O launcher dificulta, mas nao garante, a protecao contra trapaca.", TextColor: walk.RGB(120, 120, 120)},
			Composite{
				Layout: HBox{MarginsZero: true},
				Children: []Widget{
					HSpacer{},
					PushButton{AssignTo: &playBtn, Text: "Jogar", Enabled: false, MinSize: Size{Width: 110},
						OnClicked: func() {
							if err := a.Launch(); err != nil {
								walk.MsgBox(mw, cfg.ServerName, err.Error(), walk.MsgBoxIconWarning)
							}
						}},
					PushButton{Text: "Sair", MinSize: Size{Width: 110}, OnClicked: func() { mw.Close() }},
				},
			},
		},
	}.Create()
	if err != nil {
		logger.Printf("janela: %v", err)
		return
	}

	set := func(text string, frac float64) {
		mw.Synchronize(func() {
			status.SetText(text)
			if frac < 0 {
				bar.SetMarqueeMode(true)
			} else {
				bar.SetMarqueeMode(false)
				bar.SetValue(int(frac * 1000))
			}
		})
	}
	go func() {
		err := a.Update(ctx, set)
		mw.Synchronize(func() {
			if err != nil {
				status.SetText("Falha na atualizacao: " + err.Error())
				bar.SetMarqueeMode(false)
				bar.SetValue(0)
				playBtn.SetEnabled(cfg.AllowPlayIfUpdateFails)
				return
			}
			playBtn.SetEnabled(true)
		})
	}()
	mw.Run()
	logger.Print("launcher encerrado")
}
