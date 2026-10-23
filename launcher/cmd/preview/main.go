// preview: gera PNGs do visual do launcher (para conferir sem abrir o Windows).
package main

import (
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"os"
	"path/filepath"

	"l2akamanah/launcher/internal/ui"
)

func cursorSheet(out string) {
	sheet := image.NewRGBA(image.Rect(0, 0, 4*ui.CursorSize*4+40, ui.CursorSize*4+20))
	draw.Draw(sheet, sheet.Bounds(), image.NewUniform(color.RGBA{34, 56, 92, 255}), image.Point{}, draw.Src)
	for i, cur := range []*image.RGBA{ui.CursorImage(), ui.CursorClickImage()} {
		for y := 0; y < ui.CursorSize*4; y++ {
			for x := 0; x < ui.CursorSize*4; x++ {
				p := cur.Pix[cur.PixOffset(x/4, y/4) : cur.PixOffset(x/4, y/4)+4]
				a := uint32(p[3])
				bg := sheet.RGBAAt(10+i*(ui.CursorSize*4+20)+x, 10+y)
				sheet.SetRGBA(10+i*(ui.CursorSize*4+20)+x, 10+y, color.RGBA{uint8((uint32(p[0])*a + uint32(bg.R)*(255-a)) / 255), uint8((uint32(p[1])*a + uint32(bg.G)*(255-a)) / 255), uint8((uint32(p[2])*a + uint32(bg.B)*(255-a)) / 255), 255})
			}
		}
	}
	f, _ := os.Create(filepath.Join(out, "cursores.png"))
	png.Encode(f, sheet)
	f.Close()
}

func main() {
	out := "preview"
	if len(os.Args) > 1 {
		out = os.Args[1]
	}
	os.MkdirAll(out, 0o755)
	cursorSheet(out)
	cases := map[string]ui.State{
		"1-verificando":   {Status: "Verificando arquivos (84/156)", File: -1, Total: .54, Busy: true, Tick: 6},
		"2-baixando":      {Status: "Baixando Engine.dll (12/31)", File: .42, Total: .27, Busy: true},
		"3-pronto":        {Status: "Cliente atualizado.", Kind: ui.StatusOK, File: 1, Total: 1, CanPlay: true, Hover: ui.Play},
		"4-erro-internet": {Status: "Sem conexao com a internet ou com o servidor de atualizacao. Verifique sua internet e clique em Verificar arquivos.", Kind: ui.StatusError, CanPlay: false, Hover: ui.Check},
	}
	news := []ui.NewsItem{
		{Kind: "aviso", Title: "Abertura oficial em 22/12", Text: "O servidor abre dia 22 de dezembro de 2026 às 20h (horário de Brasília). Crie sua conta e baixe o cliente antes.", Date: "22/10/2026", URL: "https://l2akamanah.com.br"},
		{Kind: "recompensa", Title: "Caixa de Veterano do Open Beta", Text: "Quem fizer 10 lutas de Olimpíada durante o beta recebe a Caixa de Veterano na abertura, uma vez por conta."},
		{Kind: "correcao", Title: "Corrigido: arquivos corrompidos", Text: "Resolvida a mensagem 'Files are corrupted' ao abrir o jogo."},
	}
	cases["5-noticias"] = ui.State{Status: "Cliente atualizado. Clique em JOGAR.", Kind: ui.StatusOK, File: 1, Total: 1, CanPlay: true, News: news, NewsIdx: 0, Hover: ui.None}
	cases["6-noticias-2"] = ui.State{Status: "Baixando Engine.dll (12/31)", File: .42, Total: .27, Busy: true, News: news, NewsIdx: 1, Tick: 9}
	for n, s := range cases {
		f, _ := os.Create(filepath.Join(out, n+".png"))
		fr := ui.Render(s)
		if n == "3-pronto" || n == "5-noticias" { // mostra o cursor proprio sobre o botao Verificar
			cur := ui.CursorImage()
			for i := 0; i < len(cur.Pix); i += 4 { // RGBA reto -> pre-multiplicado, como o draw espera
				a := uint32(cur.Pix[i+3])
				cur.Pix[i], cur.Pix[i+1], cur.Pix[i+2] = uint8(uint32(cur.Pix[i])*a/255), uint8(uint32(cur.Pix[i+1])*a/255), uint8(uint32(cur.Pix[i+2])*a/255)
			}
			draw.Draw(fr, image.Rect(712-ui.CursorHotX, 612-ui.CursorHotY, 712-ui.CursorHotX+ui.CursorSize, 612-ui.CursorHotY+ui.CursorSize), cur, image.Point{}, draw.Over)
		}
		png.Encode(f, fr)
		f.Close()
	}
}
