---
tags: [protocolo-pro, stripe, monetizacao, saas]
---

# Billing e Monetização

← [[00 - MOC Protocolo.Pro]]

Dois níveis de cobrança — essa é a jogada comercial central do produto.

## Nível 1 — o nutricionista paga o Protocolo.Pro

`src/lib/billingPlans.ts`

| Plano | Preço/mês | Inclui |
|---|---|---|
| **Solo** | R$ 79 | Protocolos ilimitados, composição corporal, suplementação, **até 40 pacientes** |
| **Clínica** | R$ 249 | Tudo do Solo + vários profissionais + exportação em massa + **pacientes ilimitados** |

Intervalos: mensal e anual. Os `price_id` vêm de env vars no padrão
`NEXT_PUBLIC_STRIPE_PRICE_{PLANO}_{INTERVALO}` — e `planForPriceId()` faz o caminho inverso no webhook para sincronizar `nutritionists.plan`.

> Padrão elegante: preços não ficam hardcoded, e o mapeamento reverso varre as env vars em vez de manter um segundo dicionário.

Rotas: `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/webhook`.
Gate: `lib/auth/requireActiveSubscription.ts`. Status possíveis: `trialing | active | past_due | canceled`.

## Nível 2 — o paciente paga o nutricionista (Stripe Connect)

O nutricionista faz onboarding no Connect (`/api/stripe/connect/onboard`) e passa a cobrar mensalidade dos próprios pacientes.

- `nutritionists.stripe_connect_account_id` + `stripe_connect_onboarded`
- Tabelas `subscription_plans` e `patient_subscriptions`
- Rotas próprias: `/api/stripe/connect/checkout`, `/api/stripe/webhook/connect`
- UI: `configuracoes/ConnectStripeButton.tsx`, `connectSync.ts`, `/planos`, `p/[slug]/PlanSubscriptionCard.tsx`

### ⚠️ Armadilha registrada (v13)

A **API Accounts v1 do Stripe foi descontinuada** — o onboarding teve que ser migrado para a **v2**. O código dessa adaptação vive isolado em `src/lib/stripeAccountsV2.ts`. Se o Stripe mudar de novo, é ali que mexe.

## Idempotência

Tabela `stripe_events` guarda os eventos já processados — proteção contra reentrega de webhook. Não remover.

## Financeiro

`/(app)/financeiro` — dashboard financeiro (v22).

## Ver também
- [[70 - Histórico de Versões]]
- [[90 - Aprendizados e Armadilhas]]
