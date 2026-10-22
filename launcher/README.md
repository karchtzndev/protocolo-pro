# Launcher L2 Akamanah

Launcher para Windows (Go, executavel unico, sem instalar nada). Atualiza a pasta `System`, bloqueia
programas da lista negra e abre o `l2.exe`.

> Honestidade: o launcher **dificulta, mas nao garante** protecao contra trapaca. Detecta so o obvio.
> O servidor continua sendo a autoridade (limite de janelas, banimentos).

## Para o jogador
Extraia `L2Akamanah_Cliente_com_Launcher.zip`, abra `launcher.exe` e clique em **Jogar**.
Estrutura: `launcher.exe`, `launcher.json`, `blacklist.txt`, `System\`. O log fica em `launcher.log`
(sem dados pessoais: so nomes de arquivos do jogo e mensagens do launcher).

### Antivirus / "falso positivo"
O `.exe` **nao e assinado digitalmente**, entao o Windows SmartScreen ("Windows protegeu seu PC": clique
em *Mais informacoes* > *Executar assim mesmo*) ou o antivirus podem reclamar. O launcher e um programa
novo que baixa arquivos e abre outro programa, o que parece suspeito para heuristicas. Para liberar:
adicione a pasta do jogo em *Seguranca do Windows > Protecao contra virus > Exclusoes*. Assinar o `.exe`
com certificado de code signing reduz o problema (nao incluido). Publique tambem o SHA-256 do `launcher.exe`.

## Compilar (precisa de Go 1.24+; pode ser feito no Linux ou Windows)
```
go test ./...
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w -H windowsgui" -o dist/launcher.exe ./cmd/launcher
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o dist/gerar-manifesto.exe ./cmd/gerar-manifesto
```
(`cmd/launcher/rsrc_windows_amd64.syso` ja traz o manifesto visual; para refazer: `rsrc -manifest cmd/launcher/launcher.manifest -arch amd64 -o cmd/launcher/rsrc_windows_amd64.syso`.)

## Gerar o patch
1. Deixe a pasta `System` aprovada (a que os jogadores devem ter).
2. `gerar-manifesto.bat "C:\caminho\System"` (ou `gerar-manifesto -system System -out patch`).
3. Sai a pasta `patch\` com `manifest.json` + copia dos arquivos (caminho, tamanho, SHA-256).
   Arquivos do jogador (`ignoreFiles` em `launcher.json`: `Option.ini`, `user.ini`, logs...) ficam de fora e nunca sao tocados.

## Publicar no site
Suba o **conteudo** de `patch\` para `https://l2akamanah.com.br/patch/` (de modo que existam
`/patch/manifest.json` e `/patch/<caminho>`). Precisa ser **HTTPS**; o launcher recusa HTTP, rejeita
caminhos com `..` e so troca um arquivo se o SHA-256 baixado bater. A cada mudanca no cliente, gere de novo e suba.
Tipos `.dat`/`.u`/`.dll` devem ser servidos como arquivo binario comum.

## Configuracao (`launcher.json`, `blacklist.txt`)
`manifestUrl`, `patchBaseUrl`, `gameExe`, `gameArgs` (argumentos do l2.exe; vazio por padrao),
`allowPlayIfUpdateFails`. A lista negra e um nome de processo por linha (sem `.exe`, `*` no fim = prefixo).

## Limitacoes conhecidas
- Nao testado em Windows real (compilado e testado por unit tests no Linux).
- Nao se atualiza sozinho; para trocar o launcher, distribua um novo `.exe`.
- Instancia unica do launcher e 1 `l2.exe` por launcher; o limite real e do servidor.
- Fase 2 (HWID): so estrutura, desligada. Veja `docs/FASE2-HWID.md`.
