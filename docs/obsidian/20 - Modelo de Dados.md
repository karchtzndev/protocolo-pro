---
tags: [protocolo-pro, banco-de-dados, supabase, schema]
---

# Modelo de Dados (Supabase)

← [[00 - MOC Protocolo.Pro]]

27 tabelas, construídas em 18 migrations incrementais em `supabase/migrations/`.

## Núcleo

| Tabela | Papel |
|---|---|
| `nutritionists` | perfil do profissional: CRN, marca (cores/logo), Stripe, plano, `clinic_id`, `enabled_modules` |
| `patients` | paciente, com `clinical_flags` (array) e `status` (ativo/pendente/inativo) |
| `patient_links` | link público + PIN de acesso do paciente |
| `protocols` | protocolo alimentar; `weekly_menu` em **jsonb** |
| `anthropometry_records` | histórico de composição corporal |

## Exames

`exams` → upload (bucket `exams`) · `exam_results` → valores extraídos com faixa de referência

## Suplementação e fórmulas

`supplements_catalog` · `supplement_presets` + `supplement_preset_items` · `patient_supplements` · `compounded_formulas` (fórmulas manipuladas) · `substance_interactions` (tabela de interações — ver [[40 - Segurança Clínica]])

## Alimentos e receitas

`foods_catalog` (categorias + porção usual, base do motor de geração) · `recipes`

## Engajamento

`meal_checkins` (paciente marca feito/parcial/pulado) · `push_subscriptions` · `anamnesis_responses` · `appointments`

## Comercial

`subscription_plans` · `patient_subscriptions` (cobrança recorrente via Connect) · `stripe_events` (idempotência de webhook) · `crm_stages` (Kanban) · `broadcasts`

## Compliance

`audit_log` · `account_deletion_requests` (LGPD) — migration `0008_audit_and_lgpd.sql`

## Equipe

`clinic_invites` — convite por token com expiração (`0017_clinic_team.sql`)

## Observações

- Migrations posteriores usam prefixo `public.` explícito; as primeiras não. Inconsistência cosmética.
- `weekly_menu` como jsonb evita tabela de refeições, mas tira validação do banco — a tipagem vive só em `src/lib/types.ts` (`WeeklyMenu` → `DayMenu` → `MealSlot`).

## Ver também
- [[30 - Motor de Dieta]]
- [[50 - Billing e Monetização]]
