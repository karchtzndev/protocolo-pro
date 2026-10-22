//go:build windows

package main

import (
	"context"
	"errors"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/lxn/walk"
	"github.com/lxn/win"
	"golang.org/x/sys/windows"

	"l2akamanah/launcher/internal/app"
	"l2akamanah/launcher/internal/config"
	"l2akamanah/launcher/internal/ui"
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
		mu     sync.Mutex
		st                        = ui.State{Status: "Iniciando...", File: -1, Total: -1, Busy: true}
		cancel context.CancelFunc = func() {}
	)
	snapshot := func() ui.State { mu.Lock(); defer mu.Unlock(); return st }
	update := func(f func(s *ui.State)) { mu.Lock(); f(&st); mu.Unlock() }

	mw, err := walk.NewMainWindow()
	if err != nil {
		logger.Printf("janela: %v", err)
		return
	}
	defer mw.Dispose()
	mw.SetTitle(cfg.ServerName + " - Launcher")
	l := walk.NewVBoxLayout()
	l.SetMargins(walk.Margins{})
	l.SetSpacing(0)
	mw.SetLayout(l)

	cw, err := walk.NewCustomWidgetPixels(mw, 0, func(c *walk.Canvas, _ walk.Rectangle) error {
		bmp, err := walk.NewBitmapFromImage(ui.Render(snapshot()))
		if err != nil {
			return err
		}
		defer bmp.Dispose()
		return c.DrawImagePixels(bmp, walk.Point{})
	})
	if err != nil {
		logger.Printf("widget: %v", err)
		return
	}
	cw.SetClearsBackground(false)
	cw.SetPaintMode(walk.PaintBuffered)

	// Janela sem a moldura padrao, com tamanho e posicao no centro da tela.
	hwnd := mw.Handle()
	style := win.GetWindowLong(hwnd, win.GWL_STYLE)
	style &^= int32(win.WS_CAPTION | win.WS_THICKFRAME | win.WS_MAXIMIZEBOX)
	win.SetWindowLong(hwnd, win.GWL_STYLE, style)
	sw, sh := int(win.GetSystemMetrics(win.SM_CXSCREEN)), int(win.GetSystemMetrics(win.SM_CYSCREEN))
	mw.SetBoundsPixels(walk.Rectangle{X: (sw - ui.W) / 2, Y: (sh - ui.H) / 2, Width: ui.W, Height: ui.H})
	win.SetWindowPos(hwnd, 0, 0, 0, 0, 0, win.SWP_FRAMECHANGED|win.SWP_NOMOVE|win.SWP_NOSIZE|win.SWP_NOZORDER)

	ctx, stop := context.WithCancel(context.Background())
	defer stop()

	runUpdate := func() {
		mu.Lock()
		cancel()
		var cctx context.Context
		cctx, cancel = context.WithCancel(ctx)
		st.Busy, st.CanPlay, st.Kind, st.File, st.Total = true, false, ui.StatusNormal, -1, -1
		mu.Unlock()
		go func() {
			err := a.Update(cctx, func(text string, file, total float64) {
				update(func(s *ui.State) { s.Status, s.File, s.Total = text, file, total })
			})
			update(func(s *ui.State) {
				s.Busy = false
				if err != nil {
					s.Kind, s.Status, s.File, s.Total = ui.StatusError, app.FriendlyError(err), 0, 0
					s.CanPlay = cfg.AllowPlayIfUpdateFails
					return
				}
				s.Kind, s.Status, s.CanPlay = ui.StatusOK, "Cliente atualizado. Clique em JOGAR.", true
			})
		}()
	}

	act := func(b ui.Button) {
		switch b {
		case ui.Close, ui.Exit:
			mw.Close()
		case ui.Check:
			if !snapshot().Busy {
				runUpdate()
			}
		case ui.Play:
			s := snapshot()
			if !s.CanPlay || s.Busy || s.GameOpen {
				return
			}
			if err := a.Launch(); err != nil {
				update(func(s *ui.State) { s.Kind, s.Status = ui.StatusError, err.Error() })
			} else {
				update(func(s *ui.State) { s.Kind, s.Status = ui.StatusOK, "Jogo aberto. Boa diversao!" })
			}
		}
	}

	cw.MouseDown().Attach(func(x, y int, button walk.MouseButton) {
		if button != walk.LeftButton {
			return
		}
		b := ui.HitTest(x, y)
		if b == ui.TitleBar {
			win.ReleaseCapture()
			win.SendMessage(mw.Handle(), win.WM_NCLBUTTONDOWN, win.HTCAPTION, 0)
			return
		}
		update(func(s *ui.State) { s.Down = b })
		cw.Invalidate()
	})
	cw.MouseUp().Attach(func(x, y int, button walk.MouseButton) {
		if button != walk.LeftButton {
			return
		}
		down := snapshot().Down
		update(func(s *ui.State) { s.Down = ui.None })
		cw.Invalidate()
		if down != ui.None && ui.HitTest(x, y) == down {
			act(down)
		}
	})

	// Passa o mouse (hover) e anima a barra enquanto atualiza.
	go func() {
		t := time.NewTicker(50 * time.Millisecond)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
			}
			var p win.POINT
			hover := ui.None
			if win.GetCursorPos(&p) && win.ScreenToClient(cw.Handle(), &p) {
				hover = ui.HitTest(int(p.X), int(p.Y))
				if p.X < 0 || p.Y < 0 || p.X >= ui.W || p.Y >= ui.H {
					hover = ui.None
				}
			}
			open := a.GameRunning()
			changed := false
			update(func(s *ui.State) {
				if s.Hover != hover || s.GameOpen != open {
					changed = true
				}
				s.Hover, s.GameOpen = hover, open
				if s.Busy {
					s.Tick++
					changed = true
				}
			})
			if changed {
				mw.Synchronize(func() { cw.Invalidate() })
			}
		}
	}()

	mw.Closing().Attach(func(_ *bool, _ walk.CloseReason) { stop() })
	runUpdate()
	mw.Run()
	logger.Print("launcher encerrado")
}
