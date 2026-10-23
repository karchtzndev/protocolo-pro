package ui

import (
	"image"
	"math"
)

// Cores da moldura (bronze claro/escuro) e do fundo escuro ao redor.
var (
	tanLight = rgb{R: 214, G: 198, B: 160, A: 255}
	tanMain  = rgb{R: 176, G: 156, B: 114, A: 255}
	tanDark  = rgb{R: 104, G: 90, B: 60, A: 255}
	outerBG  = rgb{R: 22, G: 22, B: 22, A: 255}
)

func fillRect(img *image.RGBA, r image.Rectangle, c rgb) {
	r = r.Intersect(img.Rect)
	for y := r.Min.Y; y < r.Max.Y; y++ {
		for x := r.Min.X; x < r.Max.X; x++ {
			blend(img, x, y, c, 1)
		}
	}
}

// dot: ponto antialiased de raio w/2.
func dot(img *image.RGBA, x, y, w float64, c rgb) {
	r := w / 2
	for yy := int(y - r - 1); yy <= int(y+r+1); yy++ {
		for xx := int(x - r - 1); xx <= int(x+r+1); xx++ {
			d := math.Hypot(float64(xx)+.5-x, float64(yy)+.5-y)
			blend(img, xx, yy, c, clamp(r+.5-d, 0, 1))
		}
	}
}

func lineW(img *image.RGBA, x0, y0, x1, y1, w float64, c rgb) {
	n := int(math.Max(math.Abs(x1-x0), math.Abs(y1-y0))*2) + 1
	for i := 0; i <= n; i++ {
		t := float64(i) / float64(n)
		dot(img, x0+(x1-x0)*t, y0+(y1-y0)*t, w, c)
	}
}

type pt struct{ x, y float64 }

func quad(p0, p1, p2 pt, t float64) pt {
	u := 1 - t
	return pt{u*u*p0.x + 2*u*t*p1.x + t*t*p2.x, u*u*p0.y + 2*u*t*p1.y + t*t*p2.y}
}

func strokeQuad(img *image.RGBA, p0, p1, p2 pt, w float64, c rgb) {
	for t := 0.0; t <= 1; t += .004 {
		p := quad(p0, p1, p2, t)
		dot(img, p.x, p.y, w, c)
	}
}

// drawFrame desenha o fundo escuro, a moldura fina de bronze e a barra de titulo com o arco
// de filigrana no centro; o conteudo azul entra depois por cima.
func drawFrame(img *image.RGBA) {
	fillRect(img, img.Rect, outerBG)
	cx := float64(W) / 2

	// moldura: 1px escuro por fora, 2px claro, brilho interno
	outer := image.Rect(1, titleY0, W-1, H-1)
	fillRR(img, outer, 8, solid(tanDark))
	fillRR(img, outer.Inset(1), 7, func(_, y int) rgb { return lerp(tanLight, tanMain, float64(y)/H) })
	fillRR(img, outer.Inset(3), 5, solid(rgb{R: 70, G: 58, B: 38, A: 255}))

	// barra de titulo (metade de cima mais clara, como no atualizador classico)
	bar := image.Rect(4, titleY0+3, W-4, titleY1)
	for y := bar.Min.Y; y < bar.Max.Y; y++ {
		t := float64(y-bar.Min.Y) / float64(bar.Dy())
		var c rgb
		if t < .5 {
			c = lerp(rgb{R: 118, G: 112, B: 98, A: 255}, rgb{R: 96, G: 90, B: 76, A: 255}, t*2)
		} else {
			c = lerp(rgb{R: 74, G: 64, B: 46, A: 255}, rgb{R: 52, G: 43, B: 28, A: 255}, (t-.5)*2)
		}
		for x := bar.Min.X; x < bar.Max.X; x++ {
			blend(img, x, y, c, 1)
		}
	}
	for x := bar.Min.X; x < bar.Max.X; x++ {
		blend(img, x, bar.Min.Y, rgb{R: 232, G: 220, B: 190, A: 255}, .55)
		blend(img, x, bar.Max.Y-1, rgb{R: 12, G: 9, B: 5, A: 255}, .9)
	}

	// recorte do arco central: escurece a area acima da curva (a barra "afunda" sob o ornamento)
	y0 := float64(titleY0)
	main := func(side float64) (pt, pt, pt) {
		return pt{cx + side*9, y0 + 4}, pt{cx + side*56, y0 + 24}, pt{cx + side*116, y0 + 2}
	}
	for side := -1.0; side <= 1; side += 2 {
		p0, p1, p2 := main(side)
		top := map[int]float64{}
		for t := 0.0; t <= 1; t += .002 {
			p := quad(p0, p1, p2, t)
			top[int(p.x)] = p.y
		}
		for x, ty := range top {
			for y := titleY0; y < int(ty); y++ {
				blend(img, x, y, outerBG, 1)
			}
		}
	}
	for y := titleY0 - 8; y < titleY0+1; y++ { // faixa acima do centro
		for x := int(cx) - 124; x < int(cx)+124; x++ {
			blend(img, x, y, outerBG, 1)
		}
	}

	// filigrana do arco
	for side := -1.0; side <= 1; side += 2 {
		p0, p1, p2 := main(side)
		strokeQuad(img, p0, p1, p2, 2.2, tanLight)
		strokeQuad(img, pt{cx + side*7, y0 - 1}, pt{cx + side*32, y0 + 3}, pt{cx + side*76, y0 + 4}, 1.4, tanMain)
		lineW(img, cx+side*116, y0+2, cx+side*130, y0-1, 1.6, tanLight)
		dot(img, cx+side*118, y0+3, 3, tanLight)
		dot(img, cx+side*78, y0+4, 2.4, tanMain)
		lineW(img, cx+side*20, y0+9, cx+side*34, y0+2, 1.2, tanMain)
	}
	// losango do topo
	for _, e := range [][4]float64{{0, -7, -7, 3}, {0, -7, 7, 3}, {-7, 3, 0, 12}, {7, 3, 0, 12}} {
		lineW(img, cx+e[0], y0+e[1], cx+e[2], y0+e[3], 1.8, tanLight)
	}
	dot(img, cx, y0-8, 3, tanLight)
	dot(img, cx, y0+3.5, 2.6, tanMain)

	// ornamentos em "S" nas laterais de cima e curvas nas pontas de baixo
	for _, side := range []float64{-1, 1} {
		x0 := 4.0
		if side > 0 {
			x0 = W - 5
		}
		for y := y0 + 2; y < y0+46; y += .25 {
			x := x0 - side*(-1)*0 + (-side)*0
			x = x0 + 3.2*math.Sin((y-y0)/44*2*math.Pi)*(-side*-1)
			dot(img, x, y, 1.8, tanLight)
		}
		bx, by := 12.0, float64(H-12)
		if side > 0 {
			bx = W - 12
		}
		arc(img, bx, by, 6, math.Pi*.55, math.Pi*1.85, 1.8, tanLight)
		dot(img, bx+side*(-1)*-6, by+6, 2.6, tanLight)
	}
}
