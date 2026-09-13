-- Push notifications do portal do paciente (Web Push).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_patient_idx on public.push_subscriptions(patient_id);

alter table public.push_subscriptions enable row level security;

create policy "clinic manages push subscriptions" on public.push_subscriptions
  for all using (
    public.can_access_nutritionist((select nutritionist_id from public.patients where patients.id = push_subscriptions.patient_id))
  );
