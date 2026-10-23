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
	NewsPrev
	NewsNext
	NewsCard
)

type StatusKind int

const (
	StatusNormal StatusKind = iota
	StatusError
	StatusOK
)

// NewsItem e um aviso mostrado no centro da janela (vem de news.json no site).
type NewsItem struct {
	Kind  string // aviso, recompensa, correcao, novidade
	Title string
	Text  string
	Date  string
	URL   string // opcional; clicar abre no navegador
}

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
	News      []NewsItem
	NewsIdx   int
}

var (
	rClose    = image.Rect(W-46, 4, W-8, 34)
	rTitle    = image.Rect(8, 4, W-46, 34)
	rPanel    = image.Rect(36, H-132, W-36, H-30)
	rCheck    = image.Rect(640, H-132+16, 800, H-132+46)
	rExit     = image.Rect(640, H-132+54, 800, H-132+84)
	playC     = image.Pt(W-86, H-132+44)
	playR     = 54
	rNews     = image.Rect(190, 372, W-190, 492)
	rNewsPrev = image.Rect(rNews.Min.X-30, rNews.Min.Y+40, rNews.Min.X-4, rNews.Min.Y+80)
	rNewsNext = image.Rect(rNews.Max.X+4, rNews.Min.Y+40, rNews.Max.X+30, rNews.Min.Y+80)
)

// HitTest diz qual botao esta sob o ponto (x, y) da janela. Os botoes de noticia so existem
// quando ha noticias: use HitTestState.
func HitTest(x, y int) Button { return HitTestState(x, y, 0) }

// HitTestState e o HitTest sabendo quantas noticias estao na tela.
func HitTestState(x, y, news int) Button {
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
	case news > 1 && p.In(rNewsPrev):
		return NewsPrev
	case news > 1 && p.In(rNewsNext):
		return NewsNext
	case news > 0 && p.In(rNews):
		return NewsCard
	case p.In(rTitle):
		return TitleBar
	}
	return None
}
