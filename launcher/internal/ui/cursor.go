package ui

import (
	"image"
	"math"
)

// CursorSize e o tamanho dos cursores do launcher (pixels).
const CursorSize = 32

// Ponta dos cursores (ponto ativo do clique).
const (
	CursorHotX = 2
	CursorHotY = 2
)

type shape struct {
	pts  []pt
	fill func(px, py float64) rgb
}

func segDist(px, py float64, a, b pt) float64 {
	dx, dy := b.x-a.x, b.y-a.y
	l := dx*dx + dy*dy
	if l == 0 {
		return math.Hypot(px-a.x, py-a.y)
	}
	t := clamp(((px-a.x)*dx+(py-a.y)*dy)/l, 0, 1)
	return math.Hypot(px-(a.x+t*dx), py-(a.y+t*dy))
}

// polySDF: distancia com sinal ao poligono (negativa = dentro).
func polySDF(px, py float64, p []pt) float64 {
	d := math.MaxFloat64
	inside := false
	for i := range p {
		a, b := p[i], p[(i+1)%len(p)]
		d = math.Min(d, segDist(px, py, a, b))
		if (a.y > py) != (b.y > py) && px < (b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x {
			inside = !inside
		}
	}
	if inside {
		return -d
	}
	return d
}

// paintShapes pinta as formas (de tras para frente), cada uma com contorno escuro e preenchimento.
func paintShapes(shapes []shape, outline rgb) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, CursorSize, CursorSize))
	for _, s := range shapes {
		for y := 0; y < CursorSize; y++ {
			for x := 0; x < CursorSize; x++ {
				px, py := float64(x)+.5, float64(y)+.5
				d := polySDF(px, py, s.pts)
				blendStraight(img, x, y, outline, clamp(1.2-math.Abs(d-.3), 0, 1))
				if d < -.5 {
					blendStraight(img, x, y, s.fill(px, py), clamp(-d-.5, 0, 1))
				}
			}
		}
	}
	return img
}

func solidFill(c rgb) func(px, py float64) rgb { return func(float64, float64) rgb { return c } }

// CursorImage: ponteiro normal (andar e clicar) - cunha de aco facetada, ponta em cima a esquerda.
func CursorImage() *image.RGBA {
	light, dark := rgb{R: 238, G: 240, B: 246, A: 255}, rgb{R: 122, G: 130, B: 146, A: 255}
	upper := []pt{{2, 2}, {23, 13}, {14, 15}}
	lower := []pt{{2, 2}, {14, 15}, {12, 27}}
	whole := []pt{{2, 2}, {23, 13}, {14, 15}, {12, 27}}
	grad := func(c rgb) func(px, py float64) rgb {
		return func(px, py float64) rgb {
			return lerp(c, rgb{R: 70, G: 76, B: 90, A: 255}, clamp((px+py-4)/46, 0, 1)*.55)
		}
	}
	return paintShapes([]shape{
		{whole, solidFill(rgb{R: 60, G: 66, B: 80, A: 255})},
		{upper, grad(light)},
		{lower, grad(dark)},
	}, rgb{R: 20, G: 22, B: 30, A: 255})
}

// rot gira/translada pontos locais (eixo x = direcao da lamina) para o cursor: ponta em (2,2), descendo a 45 graus.
func rot(local []pt) []pt {
	c, s := math.Cos(math.Pi/4), math.Sin(math.Pi/4)
	out := make([]pt, len(local))
	for i, p := range local {
		out[i] = pt{2 + p.x*c - p.y*s, 2 + p.x*s + p.y*c}
	}
	return out
}

// CursorClickImage: ao passar sobre algo clicavel - punhal de aco empunhado por uma manopla.
func CursorClickImage() *image.RGBA {
	blade1 := rot([]pt{{0, 0}, {15, -4.6}, {15, 0}})
	blade2 := rot([]pt{{0, 0}, {15, 0}, {15, 4.6}})
	bladeAll := rot([]pt{{0, 0}, {15, -4.6}, {15, 4.6}})
	guard := rot([]pt{{15, -8}, {18, -8}, {18, 8}, {15, 8}})
	grip := rot([]pt{{18, -2.2}, {24, -2.2}, {24, 2.2}, {18, 2.2}})
	glove := rot([]pt{{19, -5}, {25, -6.5}, {30, -3.8}, {30, 3.8}, {25, 6.5}, {19, 5}})
	steel := func(base rgb) func(px, py float64) rgb {
		return func(px, py float64) rgb {
			return lerp(base, rgb{R: 60, G: 66, B: 80, A: 255}, clamp((px+py-4)/50, 0, 1)*.5)
		}
	}
	knuckles := func(px, py float64) rgb { // listras claras de articulacao da manopla
		base := rgb{R: 136, G: 142, B: 156, A: 255}
		u := (px - 2 + py - 2) / math.Sqrt2 // distancia ao longo do eixo
		if v := math.Mod(u-18, 4); v < 1 && u > 19 {
			return lerp(base, rgb{R: 240, G: 242, B: 248, A: 255}, .55)
		}
		return lerp(base, rgb{R: 70, G: 76, B: 90, A: 255}, clamp((px+py-30)/30, 0, 1)*.5)
	}
	return paintShapes([]shape{
		{bladeAll, solidFill(rgb{R: 70, G: 76, B: 90, A: 255})},
		{blade1, steel(rgb{R: 240, G: 242, B: 248, A: 255})},
		{blade2, steel(rgb{R: 150, G: 158, B: 174, A: 255})},
		{guard, solidFill(rgb{R: 188, G: 160, B: 104, A: 255})},
		{grip, solidFill(rgb{R: 74, G: 54, B: 36, A: 255})},
		{glove, knuckles},
	}, rgb{R: 20, G: 22, B: 30, A: 255})
}

// blendStraight mistura c sobre o pixel mantendo alfa (RGBA "reto", nao pre-multiplicado).
func blendStraight(img *image.RGBA, x, y int, c rgb, a float64) {
	if a <= 0 {
		return
	}
	i := img.PixOffset(x, y)
	p := img.Pix[i : i+4 : i+4]
	da := float64(p[3]) / 255
	oa := a + da*(1-a)
	for k, v := range [3]uint8{c.R, c.G, c.B} {
		p[k] = uint8(clamp((float64(v)*a+float64(p[k])*da*(1-a))/oa, 0, 255))
	}
	p[3] = uint8(clamp(oa*255, 0, 255))
}
