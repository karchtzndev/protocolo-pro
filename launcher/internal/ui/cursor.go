package ui

import (
	"image"
	"math"
)

// CursorSize e o tamanho do cursor do launcher (pixels).
const CursorSize = 32

// Ponta do ponteiro (ponto ativo do clique).
const (
	CursorHotX = 2
	CursorHotY = 2
)

var arrowPts = []pt{{2, 2}, {2, 25}, {8, 19}, {13, 29}, {17, 27}, {12, 18}, {20, 18}}

func segDist(px, py float64, a, b pt) float64 {
	dx, dy := b.x-a.x, b.y-a.y
	l := dx*dx + dy*dy
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

// CursorImage desenha o ponteiro do launcher: seta dourada com contorno escuro e brilho suave,
// no espirito do ponteiro usado para clicar e andar no jogo (arte propria, nao copiada).
func CursorImage() *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, CursorSize, CursorSize))
	for y := 0; y < CursorSize; y++ {
		for x := 0; x < CursorSize; x++ {
			px, py := float64(x)+.5, float64(y)+.5
			d := polySDF(px, py, arrowPts)
			// brilho externo
			if d > 0 && d < 3.5 {
				a := math.Pow(1-d/3.5, 2) * .38
				blendStraight(img, x, y, rgb{R: 255, G: 226, B: 140, A: 255}, a)
			}
			// contorno escuro
			blendStraight(img, x, y, rgb{R: 38, G: 24, B: 6, A: 255}, clamp(1.15-math.Abs(d-.35), 0, 1))
			// preenchimento com degradê dourado e brilho no canto de cima
			if d < -.45 {
				t := clamp((py-2)/27, 0, 1)
				c := lerp(rgb{R: 255, G: 246, B: 212, A: 255}, rgb{R: 208, G: 164, B: 76, A: 255}, t)
				c = lerp(c, rgb{R: 255, G: 255, B: 255, A: 255}, clamp(.5-(px+py-6)/22, 0, .5))
				blendStraight(img, x, y, c, clamp(-d-.45, 0, 1))
			}
		}
	}
	return img
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
