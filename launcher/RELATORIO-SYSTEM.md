# Relatorio da pasta System (cliente L2 Akamanah)

Analise feita sobre o ZIP enviado (158 arquivos, 78 MB). Backup integral: `entregas/System_backup_2026-10-22.zip`.

## O que o cliente e
- `l2.exe` 426 KB, compilado em **03/06/2011**, 32 bits; contem a opcao `-L2ProtocolVersion`. Isso e compativel com cliente da era High Five, mas **o numero do protocolo nao da para confirmar so lendo o arquivo** (veja item 5).
- Todos os `.dat` e o `l2.ini` tem cabecalho `Lineage2Ver413` (criptografados). `Option.ini` e texto puro.
- Nao ha `L2.bat`, `.htm`, `.txt` nem `.xml` na pasta.
- Pode haver referencia a "Gracia Epilogue" em `Option.ini` (caminho de desenvolvedor `s:\games\...`), removida na versao corrigida; nao prova que o cliente seja Gracia - confirme com o teste.

## Tarefa por tarefa
1. **Backup/lista**: feito (zip acima). Principais: `l2.exe`, `l2.ini`, `Option.ini`, `user.ini`, `localization.ini`, 70+ `.dat` (todos `-e` = ingles), `.dll` (engine, nwindow, d3d, audio, npkcrypt = nProtect), `.u` e `.int`.
2. **l2.ini**: **esta criptografado** (`Lineage2Ver413`). NAO foi editado. Nao e possivel ler daqui para onde ele aponta hoje (ServerAddr/ServerPort). Veja "O que voce precisa fazer".
3. **L2Journey/Journey**: busquei ASCII e UTF-16 (sem diferenciar maiusculas) em **todos** os 158 arquivos, inclusive `.dat`, `.u`, `.dll` e `l2.exe`: **nenhuma ocorrencia**. Nada foi trocado. Dentro de `l2.ini` e dos `.dat` o texto esta criptografado, entao a busca nao enxerga o conteudo: pode haver "Journey" la dentro.
4. **HWID (RequestHardWareInfo)**: nao da para provar estaticamente. Os nomes de pacote nao aparecem como texto no `l2.exe` (so existe o texto `HardWare`, ligado ao `HardWare.ini` local, que o cliente escreve com CPU/VGA/RAM). **Teste definitivo**: logar no servidor e ver no log do AkamanahGuard se chega o pacote. Se nao chegar: menor solucao = **launcher** (Fase 2, canal HTTPS proprio com hash do computador), pois uma DLL injetada em `l2.exe` (nProtect/npkcrypt presente) e fragil e sujeita a antivirus.
5. **Aviso de versao**: vem do **servidor** (lista de protocolos aceitos, 267/268) comparada com o que o `l2.exe` informa; nao ha ajuste em `Option.ini` ou atalho que resolva isso se o numero for diferente. `Option.ini` nao tem chave de versao. Se aparecer o aviso, o `l2.exe` e de outro protocolo e precisa ser trocado ou o servidor aceitar o protocolo dele.
6. **Teste de conexao**: **nao foi feito** (ambiente Linux na nuvem, sem Windows/rede para a VPS). Precisa ser feito no seu PC.

## O que mudou arquivo a arquivo (pasta corrigida)
| Arquivo | Acao |
|---|---|
| `Option.ini` | removidas secoes `[UIEditor]` e `[ScenePlayer]` (caminho do dev); audio: mudo desligado e volumes 0.5 (antes tudo mudo/0) |
| `user.ini`, `HardWare.ini`, `WindowsInfo.ini`, `s_info.ini` | **removidos** (dados da maquina de quem preparou: CPU, GPU, versao do Windows; o jogo recria) |
| `l2.log`, `l2Second.log`, `CheckGrp.log` | **removidos** (logs) |
| `l2.ini` e todos os binarios/`.dat` | **intactos** |

## O que voce precisa fazer (l2.ini)
O `l2.ini` precisa conter `ServerAddr=l2akamanah.com.br` (ou `213.109.169.203`) e `ServerPort=2106`. Como o formato `Lineage2Ver413` e criptografado, use uma ferramenta comunitaria de L2 que leia/grave esse formato (da familia "L2 Encdec"/"L2 File Edit"; **nao testei nenhuma aqui**, baixe de fonte confiavel e passe antivirus): descriptografe, ajuste as duas linhas, criptografe de novo como Ver413 e substitua o arquivo. Depois rode `gerar-manifesto` para publicar o `l2.ini` pelo launcher. Me envie o `l2.ini` descriptografado (sem senhas) e eu confiro.
