# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📋 Quick Start Commands

```bash
# Install dependencies
npm install

# Development (starts Next.js dev server)
npm run dev

# Build for production
npm run build

# Lint code
npm lint

# Run migrations (Supabase)
node scripts/run-migrations.mjs
node scripts/create-storage-bucket.mjs
```

Access dev server at `http://localhost:3000`.

## 🏗️ Architecture Overview

**Protocolo.Pro** is a nutritionist platform (SaaS) built with Next.js 15 App Router. Three main areas:

### Public Routes (No Auth)
- `/login`, `/signup` — Nutritionist authentication
- `/p/[slug]` — Patient public views (read-only: meal plans, protocols, supplements)
- `/captar/[slug]` — Lead capture forms
- `/recuperar`, `/redefinir-senha` — Password recovery

### Protected Routes `(app)/`
All require auth header + nutritionist role. Sidebar layout with 10+ sections:
- **dashboard** — Quick stats, engagement metrics, activity log
- **pacientes/[id]** — Ficha (record) with 6 tabs: Cadastro, Protocolo, Composição, Suplementação, Exames, Agendamentos
- **pacientes/importar** — CSV bulk patient import
- **receitas** — Recipe library (CRUD)
- **configuracoes** — Team settings, profile, brand colors, documents
- **equipe** — Staff management + clinic invites
- **links** — Shareable patient links admin
- **financeiro** — Revenue dashboard, Stripe payouts
- **planos** — Meal plan templates
- **broadcast** — Bulk messaging to patients
- **agendamentos** — Appointment scheduling
- **crm** — Patient interactions log

### API Routes (`/api/`)
- **stripe/** — Checkout, portal, webhooks (subscription & Connect payouts)
- **pdf/** — Dynamic PDF generation for protocols, meal plans, supplement lists
- **exams/extract** — OCR integration point (currently stub)
- **lgpd/export** — GDPR-style data export
- **auth/callback** — OAuth redirect handler
- **pwa-icon/[size]** — Dynamic PWA icon generation

## 🗄️ Data Model (Supabase)

Key tables in `supabase/migrations/`:

| Table | Purpose |
|-------|---------|
| `nutritionists` | Accounts, plans (solo/clinica), branding |
| `clinics` | Clinic profiles when plan="clinica" |
| `clinic_invites` | Team member invitations with tokens |
| `patients` | Full patient records linked to nutritionist |
| `protocols` | Active protocol per patient (weight, goals, etc.) |
| `patient_supplements` | Prescribed supplements + dosage |
| `supplements_catalog` | Ingredient library (35+ items) |
| `recipes` | Nutritionist's recipe templates |
| `weekly_menus` | Serialized meal plans (JSONB) |
| `meals_checkins` | Patient adherence tracking |
| `exams` | Uploaded test results |
| `exam_results` | Parsed lab values + flags |
| `anthropometry_records` | Weight, BMI, measurements |
| `appointments` | Scheduling + patient links |
| `meal_presets` | Meal slot templates by nutrition module |
| `anamnesisresponses` | Screening questionnaires |
| `compounded_formulas` | Custom supplement recipes |
| `activity_logs` | Audit trail (optional—currently stub) |

Storage buckets: `exams` (public, for PDF/image uploads).

## 📱 Frontend Patterns

### Server vs. Client
- **Layout, page shells, data fetching** → async Server Components
- **Interactions (forms, tabs, filtering)** → `"use client"` Client Components
- **Server Actions** → Mutations (create/update/delete). See `src/app/(app)/pacientes/[id]/actions.ts` pattern.

### UI Kit (`src/components/ui/`)
Minimalist design system: Button, Card, Badge, Tabs. Built with Tailwind v4 (`@tailwindcss/postcss`). No external component library.

### PDF Generation
Route: `/api/pdf/protocolo/[patientId]`, `/api/pdf/composicao/[patientId]`, `/api/pdf/suplementacao/[patientId]`

Uses `@react-pdf/renderer`. PDFs are streamed as `application/pdf` responses (not stored).

### Offline & PWA
- **Service Worker** registered at `/p/[slug]` (patient view only)
- **IndexedDB** via Dexie.js for meal checkins, offline queuing
- **Push notifications** via Web Push API (subscription stored in DB)
- `PushOptIn` component asks for browser permission; `ServiceWorkerRegistrar` handles registration

## 🔑 Environment Setup

Copy `.env.example` to `.env.local` and fill:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

NEXT_PUBLIC_STRIPE_PRICE_SOLO_MENSAL=price_...
NEXT_PUBLIC_STRIPE_PRICE_SOLO_ANUAL=price_...
NEXT_PUBLIC_STRIPE_PRICE_CLINICA_MENSAL=price_...
NEXT_PUBLIC_STRIPE_PRICE_CLINICA_ANUAL=price_...

NEXT_PUBLIC_APP_URL=http://localhost:3000  (or production URL)
```

## 🔐 Auth & Permissions

**Supabase Row-Level Security (RLS)** gates all queries. Policies in migration files:

- Nutritionists see only their own patients, recipes, etc.
- Clinic admins see their clinic's staff + patients.
- Patients (via public link) see only their own protocols/supplements/meals (read-only).
- Staff (clinic) see patients but not financials.

**Server Actions** assume authenticated user from `@supabase/ssr` — run server-side with full perms.

## 💳 Stripe Integration

**Two modes:**

1. **Direct (solo)**: Nutritionist → Stripe (standard SaaS).
2. **Connect (clinica)**: Nutritionist → Our account → Clinic's Stripe Connect account (splits revenue).

Routes: `/api/stripe/connect/*` for clinic onboarding; `/api/stripe/webhook/connect/*` for Connect events.

Subscriptions in `nutritionists` table columns: `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `stripe_connect_account_id`, `stripe_connect_onboarded`.

## 🎯 Common Tasks

### Add a New Module/Feature
1. Create page in `src/app/(app)/feature-name/page.tsx`
2. Add navigation to `Sidebar.tsx` if user-facing
3. Use server actions in `actions.ts` for mutations
4. Check Supabase RLS policies

### Query Patient Data
```ts
const { data: patient } = await supabase.from("patients").select("*").eq("id", patientId).single<Patient>();
```
Always check `enabled_modules` on nutritionist to conditionally show features.

### Add a PDF Export
1. Create route: `/api/pdf/new-report/[patientId]/route.tsx`
2. Build React component with `@react-pdf/renderer`
3. Stream as PDF response
4. Link from patient page

### Handle File Uploads
Use Supabase Storage. Bucket: `exams` (public). After upload, store URL in DB.

## 🧪 Testing & Quality

- **Linting**: `npm lint` (ESLint + Next.js config)
- **Type checking**: Built into dev server; `npx tsc --noEmit` to check
- No test runner pre-configured yet (but TypeScript + server/client split + RLS provides safety)

## 📚 Key Files to Know

| File | Purpose |
|------|---------|
| `src/lib/types.ts` | All TypeScript interfaces (MealSlot, Patient, Protocol, etc.) |
| `src/lib/supabase/server.ts` | Server-side Supabase client (auth context) |
| `src/lib/mealPresets.ts` | Meal slot library by nutrition module |
| `src/lib/pdf/` | PDF document components |
| `src/components/dashboard/Sidebar.tsx` | Main navigation (protected routes) |
| `src/app/(app)/pacientes/[id]/page.tsx` | Patient record main page (hub) |
| `supabase/migrations/` | DB schema (apply in order) |

## ⚠️ Known Limitations

- **OCR**: `src/lib/exams/extract.ts` is a stub—currently accepts exam data only; real PDF/image parsing not implemented
- **Activity log**: Dashboard "Últimas ações" uses fake data; no audit table yet
- **Email templates**: Uses `nodemailer` stub (email.ts)—configure SMTP creds in production
- **Email confirmation**: Supabase default requires email verification on signup (disable in dev if needed)

## 🚀 Deployment

- **Vercel** (recommended): Auto-deploys from main branch
- **Environment vars**: Set in Vercel project settings
- **Database**: Supabase (persistent; use different project for staging)
- **Storage**: Supabase buckets (images, PDFs, uploads)
- **Cron jobs**: None yet (but structure supports NextJS scheduled functions if needed)

## 🛠️ Tech Stack Reference

- **Framework**: Next.js 15 (App Router, Server Components)
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.7
- **Styling**: Tailwind CSS v4 + @tailwindcss/postcss
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (email/password)
- **API**: REST (Supabase, Stripe webhooks)
- **Payments**: Stripe (subscriptions, Connect)
- **Error tracking**: Sentry
- **PDF**: @react-pdf/renderer
- **Offline**: Service Worker + Dexie.js (IndexedDB)
- **Notifications**: Web Push API
