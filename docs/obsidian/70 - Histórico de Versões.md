---
tags: [protocolo-pro, historico, changelog]
---

# Histórico de Versões

← [[00 - MOC Protocolo.Pro]]

26 commits, de 11/09/2026 a 14/09/2026 — o projeto inteiro foi construído em **4 dias**.

## Linha do tempo

### 11/09 — fundação e incêndios de deploy
- `a43e93f` **v1** — plataforma completa de prescrição nutricional (commit inicial, já grande)
- `1f35900` **v2** — build da Vercel quebrando na inicialização do Stripe
- `6cf83c2` **v3** — automações clínicas, agendamento, anamnese automática
- `a5dd249` **v4** — automações de dieta/suplementação, agendamento global, segurança
- `d2d651d` **v5** — travamento na grade do protocolo + diagnóstico de PDF
- `18022b4` **v6** — geração de PDF quebrada na Vercel
- `3c6de1a` **v7** — força inclusão das fontes do pdfkit no bundle serverless

> Três commits seguidos (v5→v7) para fazer PDF funcionar em serverless. Ver [[90 - Aprendizados e Armadilhas]].

### 12/09 — comercial e clínico
- `db22f77` **v8** — CRM Kanban, captação pública de leads, broadcast por tag
- `894c0ba` **v9** — faturamento recorrente do paciente via Stripe Connect
- `f1d5ae2` **v10** — modularidade por nicho + fórmulas manipuladas com checagem de interações
- `70e1f6f` **v11** — quantidades explícitas no protocolo + PDFs com logo/marca
- `a8cf88b` **v12** — corrige lista de compras da geração automática
- `d2176f0` **v13** — Stripe Connect migrado para **Accounts API v2** (v1 descontinuada)
- `e4323e9` **v14** — campos separados de alimento + quantidade no editor
- `4910fb8` **v15** — quantidade em destaque também na visão do paciente
- `dbf19bc` **v16** — acesso do paciente criado automaticamente no cadastro

### 13/09 — engajamento e polimento
- `7e05af4` **v17** — diário alimentar, gráficos, receitas, equipe, PWA, e-mail automático *(commit grande)*
- `334ad4d` **v18** — corta `short_name` do PWA por palavra
- `ca41fa7` **v19** — limpar protocolo inteiro/por refeição + reorganiza navegação
- `14af0d0` **v20** — preenche peso/altura/cintura automaticamente no editor
- `0e23fe4` **v21** — preenche gramatura pela porção usual do catálogo
- `7155e00` **v22** — dashboard financeiro, push real, importador CSV de pacientes

> v19–v21 são todos **redução de atrito no editor de protocolo**. Sinal de que essa tela é o coração do uso diário.

### 13–14/09 — offline-first
- `d6e5293` → `522f87a` (fix import Dexie) → `0992421` → `909583b` (completa + correção de build)

## Padrão observado

Metade dos commits de correção são **problemas de build/deploy na Vercel**, não bugs de lógica: Stripe na inicialização, fontes do pdfkit, imports do Dexie. Ver [[90 - Aprendizados e Armadilhas]].
