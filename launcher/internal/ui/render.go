package ui

import (
	"bytes"
	_ "embed"
	"image"
	"image/color"
	"image/png"
	"math"
	"sync"

	"golang.org/x/image/draw"
	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

//go:embed assets/logo.png
var logoPNG []byte

type rgb = color.NRGBA

var (
	cGold      = rgb{232, 208, 150, 255}
	cGoldDim   = rgb{190, 168, 120, 255}
	cText      = rgb{214, 226, 240, 255}
	cTextDim   = rgb{127, 155, 189, 255}
	cTextError = rgb{255, 150, 130, 255}
	cTextOK    = rgb{150, 230, 170, 255}
)

var (
	once    sync.Once
	static  *image.RGBA
	logo    *image.RGBA
	faceMu  sync.Mutex
	faces   = map[string]font.Face{}
	regular *opentype.Font
	bold    *opentype.Font
)

func initAssets() {
	once.Do(func() {
		regular, _ = opentype.Parse(goregular.TTF)
		bold, _ = opentype.Parse(gobold.TTF)
		src, err := png.Decode(bytes.NewReader(logoPNG))
		if err == nil {
			w := 430
			h := src.Bounds().Dy() * w / src.Bounds().Dx()
			logo = image.NewRGBA(image.Rect(0, 0, w, h))
			draw.CatmullRom.Scale(logo, logo.Bounds(), src, src.Bounds(), draw.Over, nil)
		}
		static = buildStatic()
	})
}

func face(b bool, px float64) font.Face {
	key := "r"
	f := regular
	if b {
		key, f = "b", bold
	}
	key += string(rune(int(px * 10)))
	faceMu.Lock()
	defer faceMu.Unlock()
	if fc, ok := faces[key]; ok {
		return fc
	}
	fc, _ := opentype.NewFace(f, &opentype.FaceOptions{Size: px, DPI: 72, Hinting: font.HintingFull})
	faces[key] = fc
	return fc
}

func textWidth(s string, fc font.Face) int {
	return font.MeasureString(fc, s).Round()
}

// drawText escreve s com a base em y; align: 0 esquerda, 1 centro, 2 direita (em relacao a x).
func drawText(img *image.RGBA, s string, x, y int, fc font.Face, c rgb, align int) {
	w := textWidth(s, fc)
	switch align {
	case 1:
		x -= w / 2
	case 2:
		x -= w
	}
	d := font.Drawer{Dst: img, Src: image.NewUniform(c), Face: fc, Dot: fixed.P(x, y)}
	d.DrawString(s)
}

func clamp(v, lo, hi float64) float64 { return math.Max(lo, math.Min(hi, v)) }

func lerp(a, b rgb, t float64) rgb {
	t = clamp(t, 0, 1)
	return rgb{
		uint8(float64(a.R) + (float64(b.R)-float64(a.R))*t),
		uint8(float64(a.G) + (float64(b.G)-float64(a.G))*t),
		uint8(float64(a.B) + (float64(b.B)-float64(a.B))*t),
		uint8(float64(a.A) + (float64(b.A)-float64(a.A))*t),
	}
}

// blend mistura c sobre o pixel com cobertura a (0..1).
func blend(img *image.RGBA, x, y int, c rgb, a float64) {
	if !(image.Pt(x, y).In(img.Rect)) || a <= 0 {
		return
	}
	a *= float64(c.A) / 255
	i := img.PixOffset(x, y)
	p := img.Pix[i : i+4 : i+4]
	p[0] = uint8(float64(p[0])*(1-a) + float64(c.R)*a)
	p[1] = uint8(float64(p[1])*(1-a) + float64(c.G)*a)
	p[2] = uint8(float64(p[2])*(1-a) + float64(c.B)*a)
	p[3] = 255
}

// rrDist: distancia com sinal ate um retangulo arredondado (negativa = dentro).
func rrDist(px, py float64, r image.Rectangle, rad float64) float64 {
	cx, cy := float64(r.Min.X+r.Max.X)/2, float64(r.Min.Y+r.Max.Y)/2
	hx, hy := float64(r.Dx())/2-rad, float64(r.Dy())/2-rad
	qx, qy := math.Abs(px-cx)-hx, math.Abs(py-cy)-hy
	return math.Hypot(math.Max(qx, 0), math.Max(qy, 0)) + math.Min(math.Max(qx, qy), 0) - rad
}

// fillRR preenche um retangulo arredondado; col(y) da a cor por linha (gradiente vertical).
func fillRR(img *image.RGBA, r image.Rectangle, rad float64, col func(x, y int) rgb) {
	for y := r.Min.Y - 1; y <= r.Max.Y; y++ {
		for x := r.Min.X - 1; x <= r.Max.X; x++ {
			d := rrDist(float64(x)+.5, float64(y)+.5, r, rad)
			blend(img, x, y, col(x, y), clamp(.5-d, 0, 1))
		}
	}
}

func solid(c rgb) func(x, y int) rgb { return func(int, int) rgb { return c } }

func vgrad(r image.Rectangle, a, b rgb) func(x, y int) rgb {
	return func(_, y int) rgb { return lerp(a, b, float64(y-r.Min.Y)/float64(max(1, r.Dy()))) }
}

// box: contorno + preenchimento em gradiente.
func box(img *image.RGBA, r image.Rectangle, rad float64, border rgb, top, bot rgb) {
	fillRR(img, r, rad, solid(border))
	in := r.Inset(1)
	fillRR(img, in, math.Max(rad-1, 0), vgrad(in, top, bot))
}

func buildStatic() *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, W, H))
	// moldura de bronze
	fillRR(img, img.Rect, 6, func(_, y int) rgb { return lerp(rgb{138, 116, 72, 255}, rgb{70, 58, 36, 255}, float64(y)/H) })
	inner := img.Rect.Inset(5)
	// fundo azul com brilho central e vinheta
	cx, cy := float64(W)/2, 300.0
	for y := inner.Min.Y; y < inner.Max.Y; y++ {
		for x := inner.Min.X; x < inner.Max.X; x++ {
			ty := float64(y-inner.Min.Y) / float64(inner.Dy())
			base := lerp(rgb{18, 40, 70, 255}, rgb{14, 30, 56, 255}, ty)
			g := clamp(1-math.Hypot((float64(x)-cx)/480, (float64(y)-cy)/330), 0, 1)
			c := lerp(base, rgb{58, 102, 160, 255}, g*g*.85)
			v := clamp(math.Hypot((float64(x)-cx)/620, (float64(y)-cy)/520), 0, 1)
			c = lerp(c, rgb{6, 14, 28, 255}, v*v*.55)
			blend(img, x, y, c, 1)
		}
	}
	// "muro" escuro com listras suaves, como no atualizador classico
	for y := H - 215; y < H-135; y++ {
		fade := math.Sin(float64(y-(H-215)) / 80 * math.Pi)
		for x := inner.Min.X; x < inner.Max.X; x++ {
			n := float64((x*73+(x/7)*131)%17) / 17
			blend(img, x, y, rgb{4, 10, 20, 255}, clamp(.25+.35*n, 0, 1)*fade)
		}
	}
	// logo + reflexo
	if logo != nil {
		lw, lh := logo.Bounds().Dx(), logo.Bounds().Dy()
		lx, ly := (W-lw)/2, 190
		draw.Draw(img, image.Rect(lx, ly, lx+lw, ly+lh), logo, image.Point{}, draw.Over)
		for i := 0; i < lh/2; i++ {
			a := .22 * (1 - float64(i)/float64(lh/2))
			for x := 0; x < lw; x++ {
				s := logo.RGBAAt(x, lh-1-i)
				if s.A > 0 {
					blend(img, lx+x, ly+lh+4+i, rgb{s.R, s.G, s.B, 255}, a*float64(s.A)/255)
				}
			}
		}
	}
	// barra de titulo
	title := image.Rect(5, 5, W-5, 36)
	for y := title.Min.Y; y < title.Max.Y; y++ {
		c := lerp(rgb{64, 52, 34, 255}, rgb{34, 27, 18, 255}, float64(y-title.Min.Y)/float64(title.Dy()))
		for x := title.Min.X; x < title.Max.X; x++ {
			blend(img, x, y, c, 1)
		}
	}
	for x := title.Min.X; x < title.Max.X; x++ {
		blend(img, x, title.Max.Y, rgb{20, 15, 9, 255}, 1)
		blend(img, x, title.Max.Y+1, rgb{110, 92, 58, 255}, .6)
	}
	drawText(img, "L2 Akamanah - Atualizador", 22, 26, face(false, 13), cGoldDim, 0)
	pill := image.Rect(W/2-84, 3, W/2+84, 34)
	box(img, pill, 10, rgb{150, 124, 76, 255}, rgb{70, 56, 34, 255}, rgb{38, 30, 20, 255})
	drawText(img, "L2 AKAMANAH", W/2, 25, face(true, 15), cGold, 1)
	// painel inferior
	box(img, rPanel, 6, rgb{70, 104, 150, 255}, rgb{19, 40, 70, 245}, rgb{11, 26, 48, 250})
	fc := face(false, 14)
	drawText(img, "Arquivo atual", 60, rPanel.Min.Y+55, fc, cTextDim, 0)
	drawText(img, "Progresso total", 60, rPanel.Min.Y+79, fc, cTextDim, 0)
	drawText(img, "L2 Akamanah - servidor privado, sem vinculo com a NCSOFT", W/2, H-12, face(false, 11), rgb{88, 116, 152, 255}, 1)
	return img
}

var barR = image.Rect(190, 0, 620, 0)

func drawBar(img *image.RGBA, y int, frac float64, tick int) {
	r := image.Rect(190, y, 620, y+11)
	fillRR(img, r, 3, solid(rgb{60, 90, 130, 255}))
	in := r.Inset(1)
	fillRR(img, in, 2, solid(rgb{3, 6, 12, 255}))
	var fill image.Rectangle
	if frac < 0 {
		w := 110
		span := in.Dx() + w
		p := (tick * 7) % (2 * span)
		if p > span {
			p = 2*span - p
		}
		fill = image.Rect(in.Min.X+p-w, in.Min.Y, in.Min.X+p, in.Max.Y).Intersect(in)
	} else {
		fill = image.Rect(in.Min.X, in.Min.Y, in.Min.X+int(float64(in.Dx())*clamp(frac, 0, 1)), in.Max.Y)
	}
	if !fill.Empty() {
		for yy := fill.Min.Y; yy < fill.Max.Y; yy++ {
			c := lerp(rgb{120, 196, 255, 255}, rgb{38, 110, 200, 255}, float64(yy-fill.Min.Y)/float64(fill.Dy()))
			for xx := fill.Min.X; xx < fill.Max.X; xx++ {
				blend(img, xx, yy, c, 1)
			}
		}
	}
}

func drawButton(img *image.RGBA, r image.Rectangle, label string, enabled, hover, down bool) {
	top, bot, border := rgb{44, 86, 130, 255}, rgb{20, 46, 80, 255}, rgb{128, 170, 214, 255}
	tc := rgb{255, 255, 255, 255}
	switch {
	case !enabled:
		top, bot, border, tc = rgb{30, 44, 62, 255}, rgb{22, 32, 46, 255}, rgb{70, 88, 112, 255}, rgb{120, 136, 156, 255}
	case down:
		top, bot = rgb{18, 40, 70, 255}, rgb{30, 62, 104, 255}
	case hover:
		top, bot, border = rgb{66, 120, 178, 255}, rgb{32, 70, 116, 255}, rgb{180, 216, 255, 255}
	}
	box(img, r, 5, border, top, bot)
	drawText(img, label, (r.Min.X+r.Max.X)/2, r.Min.Y+20, face(false, 14), tc, 1)
}

func drawPlay(img *image.RGBA, s State) {
	cx, cy, r := float64(playC.X), float64(playC.Y), float64(playR)
	enabled := s.CanPlay && !s.Busy && !s.GameOpen
	for y := playC.Y - playR - 3; y <= playC.Y+playR+3; y++ {
		for x := playC.X - playR - 3; x <= playC.X+playR+3; x++ {
			d := math.Hypot(float64(x)+.5-cx, float64(y)+.5-cy)
			if d > r+1.5 {
				continue
			}
			var c rgb
			switch {
			case d > r-6: // aro de bronze
				c = lerp(rgb{214, 184, 120, 255}, rgb{96, 74, 40, 255}, (float64(y)-(cy-r))/(2*r))
			default:
				hx, hy := cx-r*.25, cy-r*.4
				t := clamp(math.Hypot(float64(x)-hx, float64(y)-hy)/(r*1.3), 0, 1)
				hi, lo := rgb{236, 70, 62, 255}, rgb{108, 12, 14, 255}
				if !enabled {
					hi, lo = rgb{110, 112, 118, 255}, rgb{48, 50, 56, 255}
				} else if s.Down == Play {
					hi, lo = rgb{190, 44, 40, 255}, rgb{80, 8, 10, 255}
				} else if s.Hover == Play {
					hi, lo = rgb{255, 104, 92, 255}, rgb{140, 20, 22, 255}
				}
				c = lerp(hi, lo, t)
			}
			blend(img, x, y, c, clamp(r+.5-d, 0, 1))
		}
	}
	label := s.PlayLabel
	if label == "" {
		label = "JOGAR"
	}
	fc := face(true, 19)
	drawText(img, label, playC.X+1, playC.Y+8, fc, rgb{60, 0, 0, 160}, 1)
	c := rgb{255, 255, 255, 255}
	if !enabled {
		c = rgb{170, 176, 186, 255}
	}
	drawText(img, label, playC.X, playC.Y+7, fc, c, 1)
}

// Render monta o quadro atual.
func Render(s State) *image.RGBA {
	initAssets()
	img := image.NewRGBA(static.Rect)
	copy(img.Pix, static.Pix)

	// fechar (X)
	if s.Hover == Close {
		fillRR(img, rClose, 4, solid(rgb{170, 40, 36, 255}))
	}
	cx, cy := float64(rClose.Min.X+rClose.Max.X)/2, float64(rClose.Min.Y+rClose.Max.Y)/2
	for t := -6.0; t <= 6; t += .25 {
		blend(img, int(cx+t), int(cy+t), cGold, 1)
		blend(img, int(cx+t), int(cy-t), cGold, 1)
		blend(img, int(cx+t)+1, int(cy+t), cGold, .6)
		blend(img, int(cx+t)+1, int(cy-t), cGold, .6)
	}

	// status
	col := cTextDim
	switch s.Kind {
	case StatusError:
		col = cTextError
	case StatusOK:
		col = cTextOK
	}
	fc := face(false, 14)
	lines := wrap(s.Status, fc, 430, 2)
	y0 := rPanel.Min.Y + 28
	if len(lines) > 1 {
		y0 = rPanel.Min.Y + 19
	}
	for i, ln := range lines {
		drawText(img, ln, 190, y0+i*17, fc, col, 0)
	}

	drawBar(img, rPanel.Min.Y+46, s.File, s.Tick)
	drawBar(img, rPanel.Min.Y+70, s.Total, s.Tick)

	enabled := !s.Busy
	drawButton(img, rCheck, "Verificar arquivos", enabled, s.Hover == Check, s.Down == Check)
	drawButton(img, rExit, "Sair", true, s.Hover == Exit, s.Down == Exit)
	drawPlay(img, s)
	return img
}

// wrap quebra s em ate n linhas de largura maxW; o que sobrar vira "...".
func wrap(s string, fc font.Face, maxW, n int) []string {
	var out []string
	for len(out) < n && s != "" {
		if textWidth(s, fc) <= maxW {
			return append(out, s)
		}
		cut := len(s)
		for cut > 1 && textWidth(s[:cut], fc) > maxW {
			cut--
		}
		if sp := lastSpace(s[:cut]); sp > 0 && len(out) < n-1 {
			cut = sp
		}
		line := s[:cut]
		s = trimSpace(s[cut:])
		if len(out) == n-1 && s != "" && cut > 3 {
			line = s0(line)
		}
		out = append(out, line)
	}
	return out
}

func lastSpace(s string) int {
	for i := len(s) - 1; i > 0; i-- {
		if s[i] == ' ' {
			return i
		}
	}
	return -1
}

func trimSpace(s string) string {
	for len(s) > 0 && s[0] == ' ' {
		s = s[1:]
	}
	return s
}

func s0(line string) string { return line[:len(line)-3] + "..." }
