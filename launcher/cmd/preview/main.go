// preview: gera PNGs do visual do launcher (para conferir sem abrir o Windows).
package main

import (
	"image/png"
	"os"
	"path/filepath"

	"l2akamanah/launcher/internal/ui"
)

func main() {
	out := "preview"
	if len(os.Args) > 1 {
		out = os.Args[1]
	}
	os.MkdirAll(out, 0o755)
	cases := map[string]ui.State{
		"1-verificando":   {Status: "Verificando arquivos (84/156)", File: -1, Total: .54, Busy: true, Tick: 6},
		"2-baixando":      {Status: "Baixando Engine.dll (12/31)", File: .42, Total: .27, Busy: true},
		"3-pronto":        {Status: "Cliente atualizado.", Kind: ui.StatusOK, File: 1, Total: 1, CanPlay: true, Hover: ui.Play},
		"4-erro-internet": {Status: "Sem conexao com a internet ou com o servidor de atualizacao. Verifique sua internet e clique em Verificar arquivos.", Kind: ui.StatusError, CanPlay: false, Hover: ui.Check},
	}
	for n, s := range cases {
		f, _ := os.Create(filepath.Join(out, n+".png"))
		png.Encode(f, ui.Render(s))
		f.Close()
	}
}
