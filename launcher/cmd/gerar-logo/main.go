// gerar-logo: desenha a logo do launcher ("L2 AKAMANAH / HIGH FIVE") em PNG transparente.
// Marca propria do servidor, so texto em fonte livre (Cinzel, OFL); nao copia logos de terceiros.
//
// Uso: go run ./cmd/gerar-logo assets/fonts/Cinzel-Bold.ttf internal/ui/assets/logo.png
package main

import (
	"image"
	"image/color"
	"image/png"
	"math"
	"os"

	"golang.org/x/image/font"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

const (
	cw, ch = 780, 250
)

func face(f *opentype.Font, px float64) font.Face {
	fc, err := opentype.NewFace(f, &opentype.FaceOptions{Size: px, DPI: 72, Hinting: font.HintingNone})
	if err != nil {
		panic(err)
	}
	return fc
}

// mask desenha o texto com espacamento extra entre letras e devolve a cobertura (0..1) no canvas.
func mask(fc font.Face, text string, cx, baseline int, tracking float64) []float64 {
	m := image.NewAlpha(image.Rect(0, 0, cw, ch))
	var total fixed.Int26_6
	for _, r := range text {
		a, _ := fc.GlyphAdvance(r)
		total += a + fixed.Int26_6(tracking*64)
	}
	total -= fixed.Int26_6(tracking * 64)
	x := fixed.Int26_6(cx*64) - total/2
	d := font.Drawer{Dst: m, Src: image.NewUniform(color.Alpha{255}), Face: fc}
	for _, r := range text {
		d.Dot = fixed.Point26_6{X: x, Y: fixed.I(baseline)}
		d.DrawString(string(r))
		a, _ := fc.GlyphAdvance(r)
		x += a + fixed.Int26_6(tracking*64)
	}
	out := make([]float64, cw*ch)
	for i := range out {
		out[i] = float64(m.Pix[i]) / 255
	}
	return out
}

func blur(a []float64, r int) []float64 {
	tmp := make([]float64, len(a))
	out := make([]float64, len(a))
	for pass := 0; pass < 3; pass++ {
		for y := 0; y < ch; y++ { // horizontal
			var s float64
			for x := -r; x <= r; x++ {
				if x >= 0 && x < cw {
					s += a[y*cw+x]
				}
			}
			for x := 0; x < cw; x++ {
				tmp[y*cw+x] = s / float64(2*r+1)
				if x-r >= 0 {
					s -= a[y*cw+x-r]
				}
				if x+r+1 < cw {
					s += a[y*cw+x+r+1]
				}
			}
		}
		for x := 0; x < cw; x++ { // vertical
			var s float64
			for y := -r; y <= r; y++ {
				if y >= 0 && y < ch {
					s += tmp[y*cw+x]
				}
			}
			for y := 0; y < ch; y++ {
				out[y*cw+x] = s / float64(2*r+1)
				if y-r >= 0 {
					s -= tmp[(y-r)*cw+x]
				}
				if y+r+1 < ch {
					s += tmp[(y+r+1)*cw+x]
				}
			}
		}
		a = out
		out = make([]float64, len(a))
	}
	return a
}

func over(dst *image.NRGBA, x, y int, c [3]float64, a float64) {
	if a <= 0 || x < 0 || y < 0 || x >= cw || y >= ch {
		return
	}
	i := dst.PixOffset(x, y)
	p := dst.Pix[i : i+4]
	da := float64(p[3]) / 255
	oa := a + da*(1-a)
	if oa <= 0 {
		return
	}
	for k := 0; k < 3; k++ {
		p[k] = uint8(clamp((c[k]*a+float64(p[k])*da*(1-a))/oa, 0, 255))
	}
	p[3] = uint8(clamp(oa*255, 0, 255))
}

func clamp(v, lo, hi float64) float64 { return math.Max(lo, math.Min(hi, v)) }

func lerp3(a, b [3]float64, t float64) [3]float64 {
	t = clamp(t, 0, 1)
	return [3]float64{a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, a[2] + (b[2]-a[2])*t}
}

// paint pinta uma mascara com gradiente vertical (y0..y1), com sombra e brilho.
func paint(dst *image.NRGBA, m []float64, y0, y1 int, top, mid, bot, glow [3]float64, glowA float64) {
	g := blur(m, 7)
	for y := 0; y < ch; y++ {
		for x := 0; x < cw; x++ {
			over(dst, x, y, glow, clamp(g[y*cw+x]*glowA, 0, 1))
		}
	}
	for y := 0; y < ch; y++ { // sombra
		for x := 0; x < cw; x++ {
			if y >= 3 {
				over(dst, x, y, [3]float64{6, 10, 22}, m[(y-3)*cw+x]*.65)
			}
		}
	}
	for y := 0; y < ch; y++ {
		t := clamp(float64(y-y0)/float64(y1-y0), 0, 1)
		var c [3]float64
		if t < .5 {
			c = lerp3(top, mid, t*2)
		} else {
			c = lerp3(mid, bot, (t-.5)*2)
		}
		for x := 0; x < cw; x++ {
			over(dst, x, y, c, m[y*cw+x])
		}
	}
}

func main() {
	fb, err := os.ReadFile(os.Args[1])
	if err != nil {
		panic(err)
	}
	f, err := opentype.Parse(fb)
	if err != nil {
		panic(err)
	}
	img := image.NewNRGBA(image.Rect(0, 0, cw, ch))
	silverTop, silverMid, silverBot := [3]float64{255, 255, 255}, [3]float64{216, 226, 242}, [3]float64{120, 138, 170}
	gold := [3]float64{236, 206, 140}

	// L2 (pequeno, em cima) e AKAMANAH (grande)
	paint(img, mask(face(f, 58), "L2", cw/2, 78, 14), 30, 80, silverTop, silverMid, silverBot, [3]float64{150, 190, 255}, 1.1)
	paint(img, mask(face(f, 100), "AKAMANAH", cw/2, 186, 7), 108, 188, silverTop, silverMid, silverBot, [3]float64{150, 190, 255}, 1.1)

	// filete com losango e "HIGH FIVE"
	hf := mask(face(f, 22), "HIGH FIVE", cw/2, 232, 12)
	paint(img, hf, 212, 234, gold, gold, [3]float64{190, 150, 80}, [3]float64{230, 190, 110}, .5)
	for _, side := range []int{-1, 1} {
		for k := 0; k < 150; k++ {
			x := cw/2 + side*(120+k)
			a := 1 - float64(k)/150
			over(img, x, 224, gold, a*.9)
			over(img, x, 225, gold, a*.4)
		}
	}

	out, err := os.Create(os.Args[2])
	if err != nil {
		panic(err)
	}
	defer out.Close()
	if err := png.Encode(out, img); err != nil {
		panic(err)
	}
}
