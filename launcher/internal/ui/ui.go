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

// Geometria (pixels). O visual segue a proporcao do atualizador classico: moldura fina de bronze,
// barra de titulo, area azul, "muro" de pedra e um painel inferior com barras, botoes e o botao redondo.
const (
	titleY0 = 7       // linha de cima da barra de titulo
	titleY1 = 41      // fim da barra de titulo
	bandTop = H - 128 // comeco da faixa de baixo (painel)
	barX0   = 166     // barras de progresso
	barX1   = 668
)

var (
	rClose    = image.Rect(W-46, titleY0+3, W-12, titleY1-2)
	rTitle    = image.Rect(10, titleY0, W-46, titleY1)
	rPanel    = image.Rect(40, bandTop+14, 820, bandTop+98)
	rCheck    = image.Rect(676, rPanel.Min.Y+12, 800, rPanel.Min.Y+38)
	rExit     = image.Rect(676, rPanel.Min.Y+46, 800, rPanel.Min.Y+72)
	rPlate    = image.Rect(822, bandTop, 928, bandTop+100)
	playC     = image.Pt(872, bandTop+56)
	playR     = 51
	rNews     = image.Rect(190, 372, W-190, 488)
	rNewsPrev = image.Rect(rNews.Min.X-30, rNews.Min.Y+38, rNews.Min.X-4, rNews.Min.Y+78)
	rNewsNext = image.Rect(rNews.Max.X+4, rNews.Min.Y+38, rNews.Max.X+30, rNews.Min.Y+78)
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
