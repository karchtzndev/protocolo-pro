// Package ui desenha a janela do launcher por software (image.RGBA), sem depender do Windows.
// Assim o visual pode ser gerado e conferido em qualquer sistema; a janela so exibe o quadro.
package ui

import "image"

// Tamanho da janela (pixels).
const (
	W = 960
	H = 700
)

type Button int

const (
	None Button = iota
	Close
	Check
	Exit
	Play
	TitleBar
)

type StatusKind int

const (
	StatusNormal StatusKind = iota
	StatusError
	StatusOK
)

// State e tudo o que muda na tela.
type State struct {
	Status    string
	Kind      StatusKind
	File      float64 // 0..1; <0 = indeterminado
	Total     float64 // 0..1; <0 = indeterminado
	Busy      bool    // atualizando: desliga Verificar e Jogar
	CanPlay   bool
	PlayLabel string // padrao "JOGAR"
	Hover     Button
	Down      Button
	Tick      int // animacao
	GameOpen  bool
}

var (
	rClose = image.Rect(W-46, 4, W-8, 34)
	rTitle = image.Rect(8, 4, W-46, 34)
	rPanel = image.Rect(36, H-132, W-36, H-30)
	rCheck = image.Rect(640, H-132+16, 800, H-132+46)
	rExit  = image.Rect(640, H-132+54, 800, H-132+84)
	playC  = image.Pt(W-86, H-132+44)
	playR  = 54
)

// HitTest diz qual botao esta sob o ponto (x, y) da janela.
func HitTest(x, y int) Button {
	p := image.Pt(x, y)
	dx, dy := x-playC.X, y-playC.Y
	switch {
	case dx*dx+dy*dy <= playR*playR:
		return Play
	case p.In(rClose):
		return Close
	case p.In(rCheck):
		return Check
	case p.In(rExit):
		return Exit
	case p.In(rTitle):
		return TitleBar
	}
	return None
}
