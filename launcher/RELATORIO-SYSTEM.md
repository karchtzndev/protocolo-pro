# Relatorio da pasta System (cliente L2 Akamanah)

Analise feita sobre o ZIP enviado (158 arquivos, 78 MB). Backup integral: `entregas/System_backup_2026-10-22.zip`.

## O que o cliente e
- `l2.exe` 426 KB, compilado em **03/06/2011**, 32 bits; contem a opcao `-L2ProtocolVersion`. Isso e compativel com cliente da era High Five, mas **o numero do protocolo nao da para confirmar so lendo o arquivo** (veja item 5).
- Todos os `.dat` e o `l2.ini` tem cabecalho `Lineage2Ver413` (criptografados). `Option.ini` e texto puro.
- Nao ha `L2.bat`, `.htm`, `.txt` nem `.xml` na pasta.
- Pode haver referencia a "Gracia Epilogue" em `Option.ini` (caminho de desenvolvedor `s:\games\...`), removida na versao corrigida; nao prova que o cliente seja Gracia - confirme com o teste.

## Tarefa por tarefa
1. **Backup/lista**: feito (zip acima). Principais: `l2.exe`, `l2.ini`, `Option.ini`, `user.ini`, `localization.ini`, 70+ `.dat` (todos `-e` = ingles), `.dll` (engine, nwindow, d3d, audio, npkcrypt = nProtect), `.u` e `.int`.
2. **l2.ini**: estava criptografado (`Lineage2Ver413`, chave do l2encdec, mesma do cliente ja modificado). Descriptografei com a biblioteca open source [acmi/L2crypt](https://github.com/acmi/L2crypt) (MIT), editei como texto, recriptografei como Ver413 e confirmei que descriptografa de volta identico. Antes: `ServerAddr=127.0.0.1`. Agora: `ServerAddr=l2akamanah.com.br` (o dominio resolve para 213.109.169.203; se algum jogador nao resolver, troque pelo IP). **Nao existe chave de porta de login no l2.ini**: a 2106 e padrao do cliente; o `Port=7777` do `[URL]` foi mantido. Conferencia legivel: `entregas/l2.ini_legivel_conferencia.txt`. **Ainda nao testado no jogo.**
3. **L2Journey/Journey**: busquei ASCII e UTF-16 (sem diferenciar maiusculas) em **todos** os 158 arquivos, inclusive `.dat`, `.u`, `.dll` e `l2.exe`: **nenhuma ocorrencia**. Nada foi trocado. Dentro de `l2.ini` e dos `.dat` o texto esta criptografado, entao a busca nao enxerga o conteudo: pode haver "Journey" la dentro.
4. **HWID (RequestHardWareInfo)**: o `l2.ini` tem `NetSendHardWare=true`, o que indica que o cliente foi configurado para enviar os dados de hardware (por isso o `HardWare.ini`). Mas nao da para provar estaticamente que o pacote chega. Os nomes de pacote nao aparecem como texto no `l2.exe` (so existe o texto `HardWare`, ligado ao `HardWare.ini` local, que o cliente escreve com CPU/VGA/RAM). **Teste definitivo**: logar no servidor e ver no log do AkamanahGuard se chega o pacote. Se nao chegar: menor solucao = **launcher** (Fase 2, canal HTTPS proprio com hash do computador), pois uma DLL injetada em `l2.exe` (nProtect/npkcrypt presente) e fragil e sujeita a antivirus.
5. **Aviso de versao**: vem do **servidor** (lista de protocolos aceitos, 267/268) comparada com o que o `l2.exe` informa; nao ha ajuste em `Option.ini` ou atalho que resolva isso se o numero for diferente. `Option.ini` nao tem chave de versao. Se aparecer o aviso, o `l2.exe` e de outro protocolo e precisa ser trocado ou o servidor aceitar o protocolo dele.
6. **Teste de conexao**: **nao foi feito** (ambiente Linux na nuvem, sem Windows/rede para a VPS). Precisa ser feito no seu PC.

## O que mudou arquivo a arquivo (pasta corrigida)
| Arquivo | Acao |
|---|---|
| `Option.ini` | removidas secoes `[UIEditor]` e `[ScenePlayer]` (caminho do dev); audio: mudo desligado e volumes 0.5 (antes tudo mudo/0) |
| `user.ini`, `HardWare.ini`, `WindowsInfo.ini`, `s_info.ini` | **removidos** (dados da maquina de quem preparou: CPU, GPU, versao do Windows; o jogo recria) |
| `l2.log`, `l2Second.log`, `CheckGrp.log` | **removidos** (logs) |
| `l2.ini` | `ServerAddr` 127.0.0.1 -> `l2akamanah.com.br`; `[AutoLogOn]` desligado e login/senha de teste (`zodiac`) apagados; recriptografado Ver413 |
| demais binarios/`.dat` | **intactos** |

## Pendente
Testar no PC: abrir `l2.exe`, ir ate o login e ver se aparece o servidor Akamanah. Se falhar, mande o `l2.log`/print. Se algum aviso de versao aparecer, o `l2.exe` tem outro protocolo (o `l2.ini` tem `L2VersionCheck=false`).
