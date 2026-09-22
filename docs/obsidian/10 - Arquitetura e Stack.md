---
tags: [protocolo-pro, arquitetura, stack]
---

# Arquitetura e Stack

← [[00 - MOC Protocolo.Pro]]

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Estilo | Tailwind CSS v4 (via `@tailwindcss/postcss`) |
| Banco / Auth / Storage | Supabase (`@supabase/ssr` + `supabase-js`) |
| Pagamentos | Stripe 17 (assinatura própria + **Stripe Connect** para o nutricionista cobrar pacientes) |
| PDF | `@react-pdf/renderer` |
| Offline | Dexie (IndexedDB) |
| Push | `web-push` (VAPID) |
| Observabilidade | Sentry (`@sentry/nextjs`) |
| Parsing de exames | `pdf-parse` |
| Deploy | Vercel |

> Nota: o `package.json` declara `next: ^16.3.5` mas o `eslint-config-next` ainda está em `^15.1.0` — desalinhamento a corrigir.

## Organização

```
src/app/
  (app)/          área logada (layout com sidebar)
    dashboard/ pacientes/ crm/ financeiro/ equipe/
    receitas/ agendamentos/ broadcast/ planos/
    links/ configuracoes/
  p/[slug]/       área pública do paciente (PWA)
  captar/[slug]/  landing de captação de leads
  api/
    stripe/       checkout, portal, connect/onboard, webhook, webhook/connect
    pdf/          protocolo, suplementacao, composicao
    exams/extract/
    lgpd/export/
  pwa-icon/[size]/  ícone PWA gerado on-the-fly
src/lib/
  supabase/ (client, server, middleware)
  diet/     (generateProtocol, mealItems, mealMacros, equivalents, shoppingList)
  health/   (energyEquations, indices, skinfolds)
  pdf/      (3 documentos React-PDF)
```

## Padrões observados

- **Server Actions** são o meio principal de mutação — cada rota tem seu `actions.ts` colocalizado (ex.: `pacientes/[id]/protocol-actions.ts`, `exam-actions.ts`, `supplement-actions.ts`). Não há camada de API REST interna.
- **Três clientes Supabase** separados: browser, server (SSR com cookies) e service-role. Ver `src/lib/supabase/`.
- **Middleware** (`middleware.ts` + `lib/supabase/middleware.ts`) faz refresh de sessão.
- **Gate de assinatura** centralizado em `lib/auth/requireActiveSubscription.ts`.
- **Multi-tenant por clínica**: `nutritionists.clinic_id` agrupa profissionais; convites via `clinic_invites`.

## Ver também
- [[20 - Modelo de Dados]]
- [[60 - Offline-first e PWA]]
