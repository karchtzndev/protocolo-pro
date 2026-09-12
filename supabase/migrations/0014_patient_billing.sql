-- Faturamento recorrente do NUTRICIONISTA para OS PACIENTES DELE, via Stripe
-- Connect (contas Standard — o próprio nutricionista assume o dashboard,
-- KYC e repasses; o Protocolo.Pro não fica no meio do dinheiro).

alter table public.nutritionists
  add column stripe_connect_account_id text,
  add column stripe_connect_onboarded boolean not null default false;

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.nutritionists(id) on delete cascade,
  name text not null,
  description text,
  price_cents int not null check (price_cents > 0),
  interval text not null check (interval in ('month', 'quarter')),
  stripe_product_id text,
  stripe_price_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;

create policy "subscription_plans_owner" on public.subscription_plans
  for all using (nutritionist_id = auth.uid()) with check (nutritionist_id = auth.uid());

create table public.patient_subscriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  nutritionist_id uuid not null references public.nutritionists(id) on delete cascade,
  stripe_subscription_id text,
  stripe_customer_id text,
  status text not null default 'incomplete' check (status in ('incomplete', 'trialing', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

alter table public.patient_subscriptions enable row level security;

create policy "patient_subscriptions_owner" on public.patient_subscriptions
  for all using (nutritionist_id = auth.uid()) with check (nutritionist_id = auth.uid());

create index patient_subscriptions_patient_idx on public.patient_subscriptions(patient_id);
create unique index patient_subscriptions_stripe_sub_idx on public.patient_subscriptions(stripe_subscription_id)
  where stripe_subscription_id is not null;
