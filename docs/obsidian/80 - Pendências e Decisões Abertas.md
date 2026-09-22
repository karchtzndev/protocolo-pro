---
tags: [protocolo-pro, backlog, decisoes, todo]
---

# Pendências e Decisões Abertas

← [[00 - MOC Protocolo.Pro]]

## Em aberto de verdade

### 1. OCR de exames — ainda não resolvido
`src/lib/exams/extract.ts` é o ponto de integração. O fluxo upload → tabela de resultados → destaque de valores fora da faixa funciona ponta a ponta, mas com dados de exemplo. `pdf-parse` está instalado (extrai texto de PDF nativo), mas **foto de exame** exige OCR de verdade.
Opções: AWS Textract · Google Document AI · visão da Anthropic.
→ **Decisão sua.**

### 2. PIN do paciente = 4 dígitos derivados do nascimento
Mês+dia de nascimento. É adivinhável por qualquer pessoa próxima e o espaço é de só 366 combinações. O link é público.
→ Avaliar PIN numérico independente, ou rate-limit + bloqueio por tentativas. **Segurança real, não cosmético.** Ver [[40 - Segurança Clínica]].

### 3. Catálogo de suplementos incompleto
O README fala em 12 itens de exemplo de um alvo de 35. Confirmar o que está de fato em `supplements_catalog` hoje.

### 4. Casamento de interações por substring
`interactionCheck.ts` usa substring bidirecional — falsos positivos com nomes curtos. Ver [[40 - Segurança Clínica]].

### 5. Desalinhamento de versões
`next: ^16.3.5` com `eslint-config-next: ^15.1.0`.

### 6. README desatualizado
Descreve uma estrutura muito menor que a real e ainda diz que o código "nunca foi compilado nem rodado". Ver [[90 - Aprendizados e Armadilhas]].

## Já resolvido (o README ainda lista como pendente — ignorar)

- ~~Log de atividades / tabela de auditoria~~ → existe: `audit_log` + `src/lib/audit.ts` (migration `0008`)
- ~~Tela de edição do cardápio semanal~~ → existe: `ProtocolEditorDialog.tsx`
- ~~Atribuição de suplementos ao paciente~~ → existe: `SupplementPrescribeDialog.tsx` + `supplement-actions.ts`

## Ver também
- [[90 - Aprendizados e Armadilhas]]
