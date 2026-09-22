---
tags: [protocolo-pro, dominio, seguranca-clinica, compliance]
---

# Segurança Clínica

← [[00 - MOC Protocolo.Pro]]

O produto automatiza prescrição nutricional — então os freios clínicos são parte do núcleo, não um detalhe de UI.

## Triagem automática

`src/lib/clinicalScreening.ts → screenPatient()`

**6 sinalizadores** que marcam o caso como "avaliação individual" e **bloqueiam a geração automática de dieta**:

1. Menor de 18 anos — *calculado* da data de nascimento
2. Gestante ou lactante
3. Doença renal, hepática ou cardíaca
4. Diabetes em uso de insulina
5. Cirurgia bariátrica
6. Histórico ou suspeita de transtorno alimentar

Os itens 2–6 vêm de `patients.clinical_flags` (marcados no cadastro); o item 1 é derivado. Retorna `{ flagged, reasons[] }` — a UI mostra os motivos.

> **Princípio de design**: automação desliga sozinha diante de complexidade clínica. Vale preservar isso em qualquer refactor.

## Piso calórico

O motor recusa planos abaixo de 1500 kcal (M) / 1200 kcal (F). Ver [[30 - Motor de Dieta]].

## Interações medicamentosas

`src/lib/interactionCheck.ts` — compara ingredientes de fórmula manipulada contra `substance_interactions`.

Casamento por **substring bidirecional, case-insensitive**: "sulfato ferroso" na fórmula casa com regra cadastrada de "ferro".

⚠️ **Risco conhecido**: substring bidirecional gera falsos positivos com nomes curtos. Uma regra sobre a substância `"K"` ou `"B6"` casaria com quase tudo. Vale considerar limite mínimo de tamanho ou casamento por token.

Severidade vem da regra (`rule.severity`), mensagem é formatada como `A + B: descrição`.

## Assinatura de prescrição

`SignPrescriptionButton.tsx` — há fluxo de assinatura do documento prescrito.

## LGPD

- `audit_log` — trilha de auditoria (migration `0008`)
- `account_deletion_requests` — pedido de exclusão de conta
- `/api/lgpd/export` — exportação de dados do titular
- `configuracoes/LgpdSection.tsx` + `lgpd-actions.ts`
- Documentos de consentimento e privacidade por nutricionista (`consent_document_url`, `privacy_document_url`)
- Área do paciente começa por **tela de consentimento** antes do PIN

## Ver também
- [[80 - Pendências e Decisões Abertas]] — o PIN de 4 dígitos é ponto fraco conhecido
