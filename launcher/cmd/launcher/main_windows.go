//go:build windows

package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/lxn/walk"
	"github.com/lxn/win"
	"golang.org/x/sys/windows"

	"l2akamanah/launcher/internal/app"
	"l2akamanah/launcher/internal/config"
	"l2akamanah/launcher/internal/news"
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
	// cursores proprios: cunha de aco (normal) e punhal com manopla (sobre algo clicavel)
	curNormal := newCursor(ui.CursorImage(), ui.CursorHotX, ui.CursorHotY)
	curClick := newCursor(ui.CursorClickImage(), ui.CursorHotX, ui.CursorHotY)
	setCursor := func(c win.HCURSOR) {
		if c == 0 {
			return
		}
		setWindowCursor(mw.Handle(), c)
		setWindowCursor(cw.Handle(), c)
		win.SetCursor(c)
	}
	setCursor(curNormal)
	clickable := false
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

	loadNews := func() {
		if cfg.NewsURL == "" {
			return
		}
		go func() {
			cx, cancelNews := context.WithTimeout(ctx, 15*time.Second)
			defer cancelNews()
			items, err := news.Fetch(cx, &http.Client{Timeout: 15 * time.Second}, cfg.NewsURL)
			if err != nil {
				logger.Printf("noticias: %v", err)
				return
			}
			conv := make([]ui.NewsItem, len(items))
			for i, it := range items {
				conv[i] = ui.NewsItem{Kind: it.Kind, Title: it.Title, Text: it.Text, Date: it.Date, URL: it.URL}
			}
			update(func(s *ui.State) { s.News, s.NewsIdx = conv, 0 })
			mw.Synchronize(func() { cw.Invalidate() })
		}()
	}
	step := func(d int) {
		update(func(s *ui.State) {
			if n := len(s.News); n > 0 {
				s.NewsIdx = ((s.NewsIdx+d)%n + n) % n
			}
		})
	}

	act := func(b ui.Button) {
		switch b {
		case ui.Close, ui.Exit:
			mw.Close()
		case ui.Check:
			if !snapshot().Busy {
				runUpdate()
				loadNews()
			}
		case ui.NewsPrev:
			step(-1)
		case ui.NewsNext:
			step(1)
		case ui.NewsCard:
			s := snapshot()
			if len(s.News) > 0 {
				if u := s.News[s.NewsIdx%len(s.News)].URL; u != "" {
					verb, _ := windows.UTF16PtrFromString("open")
					link, _ := windows.UTF16PtrFromString(u)
					windows.ShellExecute(0, verb, link, nil, nil, windows.SW_SHOWNORMAL)
				}
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
		b := ui.HitTestState(x, y, len(snapshot().News))
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
		if down != ui.None && ui.HitTestState(x, y, len(snapshot().News)) == down {
			act(down)
		}
	})

	// Passa o mouse (hover) e anima a barra enquanto atualiza.
	rot := 0
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
				hover = ui.HitTestState(int(p.X), int(p.Y), len(snapshot().News))
				if p.X < 0 || p.Y < 0 || p.X >= ui.W || p.Y >= ui.H {
					hover = ui.None
				}
			}
			open := a.GameRunning()
			changed := false
			rot++
			if rot >= 160 { // ~8 s
				rot = 0
				if hover != ui.NewsCard && hover != ui.NewsPrev && hover != ui.NewsNext {
					step(1)
					changed = true
				}
			}
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
			s := snapshot()
			can := false
			switch hover {
			case ui.Close, ui.Exit, ui.NewsPrev, ui.NewsNext:
				can = true
			case ui.Check:
				can = !s.Busy
			case ui.Play:
				can = s.CanPlay && !s.Busy && !s.GameOpen
			case ui.NewsCard:
				can = len(s.News) > 0 && s.News[s.NewsIdx%len(s.News)].URL != ""
			}
			if can != clickable {
				clickable = can
				changed = true
				mw.Synchronize(func() {
					if can {
						setCursor(curClick)
					} else {
						setCursor(curNormal)
					}
				})
			}
			if changed {
				mw.Synchronize(func() { cw.Invalidate() })
			}
		}
	}()

	mw.Closing().Attach(func(_ *bool, _ walk.CloseReason) { stop() })
	runUpdate()
	loadNews()
	// Criada sem o declarative, a janela nasce escondida: precisa ser mostrada explicitamente.
	mw.Show()
	win.SetForegroundWindow(mw.Handle())
	mw.Run()
	logger.Print("launcher encerrado")
}
