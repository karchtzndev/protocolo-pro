# Robô Tractian — fechamento de OS

Preenche o procedimento padrão e conclui as ordens listadas em `ordens.txt`.
Roda **no seu computador**, num Chrome que abre sozinho, usando o **seu login** (nada de senha é guardado no código).

## Regras de preenchimento
- "Equipamento Substituído?" → **Não**
- Todas as demais perguntas Sim/Não/N/A dos cartões *PREENCHIMENTO EXECUTANTE DA ATIVIDADE* e *PREENCHIMENTO DOS REVISORES* → **Sim**
- Campos de texto/notas opcionais → ficam vazios
- "NOME DO RESPONSAVEL PELA INSPEÇÃO FINAL" → `EDUARDO` (mude com `NOME_RESPONSAVEL=...`)
- Assinaturas: se já estiver "Assinado digitalmente", mantém; se não, tenta assinar
- Qualquer **outro procedimento** com item obrigatório sem preencher → **não conclui** a OS e ela vai para o relatório
- OS sem procedimento → apenas conclui

## Passo a passo
```bash
cd tractian-bot
npm run setup            # 1x: instala Playwright + Chromium
npm run inspect -- 22952 # abre a OS 22952 e salva o que o robô enxerga (output/inspect-22952.*)
npm run plan -- --limit 3   # simula 3 OS sem alterar nada
npm run teste            # processa de verdade só 1 OS (confira no Tractian)
npm start                # processa todas (retoma de onde parou se interromper)
```
Na primeira execução o Chrome abre; faça login no Tractian, deixe a lista visível e aperte ENTER no terminal.

Opções: `--limit N`, `--only 22952,22922`, `--sem-concluir` (preenche mas não clica em Concluída), `--file outra.txt`.

## Saídas (pasta `output/`)
- `relatorio.md` / `relatorio.csv` — concluídas, **pendentes para você verificar**, falhas
- `shots/` — print de cada OS depois de preencher e depois de concluir
- `state.json` — progresso (apague para reprocessar tudo)

## Importante
O robô foi escrito sem acesso à tela real do Tractian. Rode `inspect`, `plan` e `teste` com 1 OS antes do lote completo; se algo não bater, envie `output/inspect-*.json/.png` para ajustar os seletores.
