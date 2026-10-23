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

// Liberation Serif Bold (SIL Open Font License 1.1): titulos no estilo do atualizador classico.
//
//go:embed assets/serif-bold.ttf
var serifTTF []byte

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
	serif   *opentype.Font
)

func initAssets() {
	once.Do(func() {
		regular, _ = opentype.Parse(goregular.TTF)
		bold, _ = opentype.Parse(gobold.TTF)
		serif, _ = opentype.Parse(serifTTF)
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

// serifFace: fonte de titulo (serifada, negrito).
func serifFace(px float64) font.Face {
	key := "s" + string(rune(int(px*10)))
	faceMu.Lock()
	defer faceMu.Unlock()
	if fc, ok := faces[key]; ok {
		return fc
	}
	fc, _ := opentype.NewFace(serif, &opentype.FaceOptions{Size: px, DPI: 72, Hinting: font.HintingFull})
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

func hash2(x, y int) float64 {
	h := uint32(x)*374761393 + uint32(y)*668265263
	h = (h ^ (h >> 13)) * 1274126177
	return float64((h^(h>>16))&0xffff) / 65535
}

// cloud: ruido suave (soma de senoides) em -1..1, para a nevoa do fundo.
func cloud(x, y float64) float64 {
	return .5*math.Sin(x/90+math.Sin(y/57)*2.1) + .3*math.Sin((x+y)/47+1.3) + .2*math.Sin(x/27-y/35+.6)
}

func arc(img *image.RGBA, cx, cy, r float64, a0, a1 float64, w float64, c rgb) {
	for a := a0; a <= a1; a += .01 {
		for dw := -w / 2; dw <= w/2; dw += .5 {
			x, y := cx+(r+dw)*math.Cos(a), cy+(r+dw)*math.Sin(a)
			blend(img, int(x), int(y), c, 1)
		}
	}
}

func buildStatic() *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, W, H))
	drawFrame(img)

	// area azul abaixo da barra de titulo
	area := image.Rect(5, titleY1, W-5, H-4)
	cx, cy := float64(W)/2, 215.0
	for y := area.Min.Y; y < area.Max.Y; y++ {
		for x := area.Min.X; x < area.Max.X; x++ {
			ty := float64(y-area.Min.Y) / float64(area.Dy())
			base := lerp(rgb{R: 28, G: 56, B: 96, A: 255}, rgb{R: 14, G: 30, B: 54, A: 255}, math.Pow(ty, .8))
			g := clamp(1-math.Hypot((float64(x)-cx)/560, (float64(y)-cy)/260), 0, 1)
			c := lerp(base, rgb{R: 54, G: 98, B: 156, A: 255}, g*g*.8)
			n := cloud(float64(x), float64(y))
			c = lerp(c, rgb{R: 72, G: 114, B: 170, A: 255}, clamp(n*.5+.1, 0, .35)*(1-ty))
			c = lerp(c, rgb{R: 6, G: 14, B: 28, A: 255}, clamp(-n*.5, 0, .25)*.6)
			v := clamp(math.Hypot((float64(x)-cx)/640, (float64(y)-cy)/560), 0, 1)
			c = lerp(c, rgb{R: 4, G: 10, B: 22, A: 255}, v*v*.5)
			blend(img, x, y, c, 1)
		}
	}
	// sombra logo abaixo da barra de titulo
	for i := 0; i < 8; i++ {
		for x := area.Min.X; x < area.Max.X; x++ {
			blend(img, x, titleY1+i, rgb{R: 2, G: 6, B: 14, A: 255}, .55*(1-float64(i)/8))
		}
	}
	// muro de pedra escura acima da faixa de baixo
	y0 := bandTop - 82
	for y := y0; y < bandTop; y++ {
		ramp := math.Pow(float64(y-y0)/float64(bandTop-y0), 1.2)
		for x := area.Min.X; x < area.Max.X; x++ {
			streak := hash2(x/2, 7)*.5 + hash2(x/9, 3)*.5
			c := lerp(rgb{R: 12, G: 20, B: 34, A: 255}, rgb{R: 52, G: 58, B: 70, A: 255}, streak*.75)
			blend(img, x, y, c, clamp(.1+.85*ramp, 0, .95))
			if h := hash2(x/3, y/4); h > .94 {
				blend(img, x, y, rgb{R: 120, G: 132, B: 150, A: 255}, .10*ramp)
			} else if h < .05 {
				blend(img, x, y, rgb{R: 0, G: 0, B: 0, A: 255}, .18*ramp)
			}
		}
	}
	// faixa de baixo: azul escuro que escurece ate quase preto
	for y := bandTop; y < area.Max.Y; y++ {
		t := float64(y-bandTop) / float64(area.Max.Y-bandTop)
		c := lerp(rgb{R: 18, G: 52, B: 88, A: 255}, rgb{R: 5, G: 11, B: 20, A: 255}, math.Pow(t, .7))
		for x := area.Min.X; x < area.Max.X; x++ {
			blend(img, x, y, c, 1)
		}
	}
	for x := area.Min.X; x < area.Max.X; x++ {
		blend(img, x, bandTop, rgb{R: 4, G: 10, B: 20, A: 255}, .9)
		blend(img, x, bandTop+1, rgb{R: 54, G: 102, B: 150, A: 255}, .5)
	}

	// titulo
	drawText(img, "L2 Akamanah - Atualizador", 66, titleY0+25, face(false, 13), rgb{R: 188, G: 176, B: 144, A: 255}, 0)
	drawText(img, "L2 AKAMANAH", W/2+1, titleY0+31, serifFace(15), rgb{R: 14, G: 10, B: 5, A: 200}, 1)
	drawText(img, "L2 AKAMANAH", W/2, titleY0+30, serifFace(15), rgb{R: 214, G: 198, B: 160, A: 255}, 1)

	// painel das barras: contorno fino claro, miolo azul-marinho com brilho no canto de cima
	pr := rPanel
	fillRR(img, pr, 3, solid(rgb{R: 46, G: 92, B: 140, A: 255}))
	in := pr.Inset(1)
	fillRR(img, in, 3, func(x, y int) rgb {
		t := float64(y-in.Min.Y) / float64(in.Dy())
		c := lerp(rgb{R: 16, G: 54, B: 92, A: 255}, rgb{R: 8, G: 28, B: 52, A: 255}, math.Pow(t, .8))
		g := clamp(1-math.Hypot(float64(x-in.Min.X)/260, float64(y-in.Min.Y)/60), 0, 1)
		return lerp(c, rgb{R: 34, G: 86, B: 136, A: 255}, g*.45)
	})
	fc := face(false, 14)
	lab := rgb{R: 150, G: 176, B: 206, A: 255}
	drawText(img, "Arquivo atual", 62, barY1()+9, fc, lab, 0)
	drawText(img, "Progresso total", 62, barY2()+9, fc, lab, 0)

	// placa de pedra do botao JOGAR, com fio de bronze e o botao pequeno no canto
	pl := rPlate
	fillRect(img, pl, rgb{R: 6, G: 8, B: 12, A: 255})
	pi := pl.Inset(1)
	for y := pi.Min.Y; y < pi.Max.Y; y++ {
		for x := pi.Min.X; x < pi.Max.X; x++ {
			streak := hash2(x/3, 11)*.5 + hash2(x/7, y/6)*.5
			blend(img, x, y, lerp(rgb{R: 24, G: 27, B: 33, A: 255}, rgb{R: 58, G: 62, B: 72, A: 255}, streak), 1)
		}
	}
	arc(img, float64(playC.X), float64(playC.Y), float64(playR)+7, -math.Pi*.95, math.Pi*.35, 1.6, rgb{R: 96, G: 78, B: 44, A: 255})
	kx, ky := float64(pl.Max.X-16), float64(pl.Min.Y+22)
	dot(img, kx, ky, 22, rgb{R: 74, G: 60, B: 34, A: 255})
	dot(img, kx, ky, 17, rgb{R: 12, G: 13, B: 16, A: 255})
	dot(img, kx-3, ky-3, 5, rgb{R: 70, G: 74, B: 84, A: 255})

	drawText(img, "L2 Akamanah - servidor privado, sem vinculo com a NCSOFT", W/2, H-12, serifFace(12), rgb{R: 112, G: 122, B: 136, A: 255}, 1)
	return img
}

func barY1() int { return rPanel.Min.Y + 36 }
func barY2() int { return rPanel.Min.Y + 56 }

// drawLogo desenha a logo com um reflexo suave embaixo, centralizada em ly.
func drawLogo(img *image.RGBA, ly int) {
	if logo == nil {
		return
	}
	lw, lh := logo.Bounds().Dx(), logo.Bounds().Dy()
	lx := (W - lw) / 2
	draw.Draw(img, image.Rect(lx, ly, lx+lw, ly+lh), logo, image.Point{}, draw.Over)
	for i := 0; i < lh/2; i++ {
		a := .26 * math.Pow(1-float64(i)/float64(lh/2), 1.6)
		for x := 0; x < lw; x++ {
			s := logo.RGBAAt(x, lh-1-i)
			if s.A > 0 {
				blend(img, lx+x, ly+lh+3+i, rgb{s.R, s.G, s.B, 255}, a*float64(s.A)/255)
			}
		}
	}
}

func kindStyle(kind string) (label string, c rgb) {
	switch kind {
	case "aviso":
		return "AVISO", rgb{201, 162, 74, 255}
	case "recompensa":
		return "RECOMPENSA", rgb{90, 168, 106, 255}
	case "correcao":
		return "CORREÇÃO", rgb{90, 143, 217, 255}
	}
	return "NOVIDADE", rgb{217, 120, 74, 255}
}

// drawNews: cartao do meio com a noticia atual (titulo, texto, data e indicadores).
func drawNews(img *image.RGBA, s State) {
	if len(s.News) == 0 {
		return
	}
	cur := ((s.NewsIdx % len(s.News)) + len(s.News)) % len(s.News)
	n := s.News[cur]
	r := rNews
	border := rgb{98, 134, 182, 255}
	if s.Hover == NewsCard && n.URL != "" {
		border = rgb{190, 156, 90, 255}
	}
	box(img, r, 6, border, rgb{10, 24, 46, 224}, rgb{7, 16, 32, 230})
	label, c := kindStyle(n.Kind)
	cf := face(true, 11)
	cw := textWidth(label, cf) + 16
	chip := image.Rect(r.Min.X+14, r.Min.Y+12, r.Min.X+14+cw, r.Min.Y+30)
	fillRR(img, chip, 4, solid(rgb{c.R, c.G, c.B, 110}))
	drawText(img, label, chip.Min.X+8, chip.Min.Y+13, cf, rgb{255, 255, 255, 255}, 0)
	title := n.Title
	tf := serifFace(18)
	for textWidth(title, tf) > r.Dx()-cw-130 && len(title) > 4 {
		title = title[:len(title)-4] + "..."
	}
	drawText(img, title, chip.Max.X+12, r.Min.Y+28, tf, cGold, 0)
	if n.Date != "" {
		drawText(img, n.Date, r.Max.X-14, r.Min.Y+27, face(false, 12), rgb{120, 146, 180, 255}, 2)
	}
	body := face(false, 14)
	for i, ln := range wrap(n.Text, body, r.Dx()-32, 3) {
		drawText(img, ln, r.Min.X+16, r.Min.Y+56+i*19, body, cText, 0)
	}
	if len(s.News) > 1 {
		x0 := r.Min.X + r.Dx()/2 - (len(s.News)*14)/2
		for i := range s.News {
			col := rgb{70, 96, 132, 255}
			if i == cur {
				col = cGold
			}
			fillRR(img, image.Rect(x0+i*14, r.Max.Y-14, x0+i*14+8, r.Max.Y-8), 3, solid(col))
		}
		for _, a := range []struct {
			r  image.Rectangle
			b  Button
			ch string
		}{{rNewsPrev, NewsPrev, "<"}, {rNewsNext, NewsNext, ">"}} {
			col := rgb{120, 150, 190, 255}
			if s.Hover == a.b {
				col = cGold
			}
			drawText(img, a.ch, (a.r.Min.X+a.r.Max.X)/2, a.r.Min.Y+27, serifFace(26), col, 1)
		}
	}
}

func drawBar(img *image.RGBA, y int, frac float64, tick int) {
	r := image.Rect(barX0, y, barX1, y+9)
	fillRR(img, r, 1, solid(rgb{R: 10, G: 28, B: 50, A: 255}))
	in := r.Inset(1)
	fillRR(img, in, 1, solid(rgb{R: 0, G: 0, B: 0, A: 255}))
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
	for yy := fill.Min.Y; yy < fill.Max.Y; yy++ {
		c := lerp(rgb{R: 118, G: 196, B: 255, A: 255}, rgb{R: 34, G: 104, B: 196, A: 255}, float64(yy-fill.Min.Y)/float64(max(1, fill.Dy())))
		for xx := fill.Min.X; xx < fill.Max.X; xx++ {
			blend(img, xx, yy, c, 1)
		}
	}
}

// drawButton: botao com contorno duplo (escuro por fora, claro por dentro) e brilho na metade de cima.
func drawButton(img *image.RGBA, r image.Rectangle, label string, enabled, hover, down bool) {
	edge, top, bot := rgb{R: 104, G: 148, B: 190, A: 255}, rgb{R: 30, G: 78, B: 122, A: 255}, rgb{R: 14, G: 44, B: 76, A: 255}
	tc := rgb{R: 238, G: 244, B: 250, A: 255}
	switch {
	case !enabled:
		edge, top, bot, tc = rgb{R: 62, G: 84, B: 108, A: 255}, rgb{R: 22, G: 40, B: 60, A: 255}, rgb{R: 14, G: 26, B: 42, A: 255}, rgb{R: 112, G: 128, B: 148, A: 255}
	case down:
		top, bot = rgb{R: 12, G: 36, B: 62, A: 255}, rgb{R: 22, G: 58, B: 96, A: 255}
	case hover:
		edge, top, bot = rgb{R: 170, G: 214, B: 250, A: 255}, rgb{R: 44, G: 100, B: 152, A: 255}, rgb{R: 20, G: 58, B: 96, A: 255}
	}
	fillRR(img, r.Inset(-1), 6, solid(rgb{R: 3, G: 10, B: 20, A: 255}))
	fillRR(img, r, 5, solid(edge))
	in := r.Inset(1)
	fillRR(img, in, 4, func(_, y int) rgb {
		t := float64(y-in.Min.Y) / float64(in.Dy())
		if t < .5 {
			return lerp(top, rgb{R: top.R - 6, G: top.G - 10, B: top.B - 10, A: 255}, t*2)
		}
		return lerp(rgb{R: bot.R + 6, G: bot.G + 8, B: bot.B + 10, A: 255}, bot, (t-.5)*2)
	})
	for x := in.Min.X + 3; x < in.Max.X-3; x++ {
		blend(img, x, in.Min.Y+1, rgb{R: 255, G: 255, B: 255, A: 255}, .16)
	}
	drawText(img, label, (r.Min.X+r.Max.X)/2, r.Min.Y+18, face(true, 13), tc, 1)
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
			case d > r-2: // aro externo escuro
				c = rgb{R: 34, G: 27, B: 14, A: 255}
			case d > r-7: // aro de bronze
				c = lerp(rgb{R: 188, G: 164, B: 98, A: 255}, rgb{R: 82, G: 66, B: 34, A: 255}, (float64(y)-(cy-r))/(2*r))
			case d > r-9: // sulco escuro entre o aro e a esfera
				c = rgb{R: 30, G: 20, B: 10, A: 255}
			default:
				hx, hy := cx-r*.22, cy-r*.42
				t := clamp(math.Hypot(float64(x)-hx, float64(y)-hy)/(r*1.25), 0, 1)
				hi, lo := rgb{R: 214, G: 52, B: 54, A: 255}, rgb{R: 92, G: 8, B: 12, A: 255}
				if !enabled {
					hi, lo = rgb{R: 112, G: 114, B: 120, A: 255}, rgb{R: 44, G: 46, B: 52, A: 255}
				} else if s.Down == Play {
					hi, lo = rgb{R: 170, G: 36, B: 38, A: 255}, rgb{R: 70, G: 6, B: 8, A: 255}
				} else if s.Hover == Play {
					hi, lo = rgb{R: 240, G: 86, B: 78, A: 255}, rgb{R: 120, G: 16, B: 18, A: 255}
				}
				c = lerp(hi, lo, t)
				// quadriculado fino, como o desenho da esfera do atualizador classico
				if (x%11 == 0 || y%11 == 0) && enabled {
					c = lerp(c, rgb{R: 255, G: 150, B: 140, A: 255}, .14)
				}
				// brilho de vidro na metade de cima
				if gy := (float64(y) - (cy - r + 9)) / (r * .9); gy >= 0 && gy < 1 {
					c = lerp(c, rgb{R: 255, G: 255, B: 255, A: 255}, .10*(1-gy))
				}
			}
			blend(img, x, y, c, clamp(r+.5-d, 0, 1))
		}
	}
	label := s.PlayLabel
	if label == "" {
		label = "JOGAR"
	}
	fc := face(false, 22)
	drawText(img, label, playC.X+1, playC.Y+9, fc, rgb{R: 60, G: 0, B: 0, A: 150}, 1)
	c := rgb{R: 255, G: 255, B: 255, A: 255}
	if !enabled {
		c = rgb{R: 176, G: 182, B: 192, A: 255}
	}
	drawText(img, label, playC.X, playC.Y+8, fc, c, 1)
}

// Render monta o quadro atual.
func Render(s State) *image.RGBA {
	initAssets()
	img := image.NewRGBA(static.Rect)
	copy(img.Pix, static.Pix)

	// logo: no centro da janela; sobe para dar lugar ao cartao quando ha noticias
	ly := 232
	if len(s.News) > 0 {
		ly = 84
	}
	drawLogo(img, ly)
	drawNews(img, s)

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
	lines := wrap(s.Status, fc, barX1-barX0-20, 2)
	y0 := rPanel.Min.Y + 26
	if len(lines) > 1 {
		y0 = rPanel.Min.Y + 17
	}
	for i, ln := range lines {
		drawText(img, ln, (barX0+barX1)/2, y0+i*16, fc, col, 1)
	}

	drawBar(img, barY1(), s.File, s.Tick)
	drawBar(img, barY2(), s.Total, s.Tick)

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
