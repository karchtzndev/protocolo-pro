-- Diário alimentar (check-in do paciente), biblioteca de receitas e as
-- colunas de engajamento que alimentam o alerta preditivo de evasão.

-- ---------------------------------------------------------------------------
-- Diário alimentar: o paciente marca no portal o que realmente comeu.
create table public.meal_checkins (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  checkin_date date not null default current_date,
  meal_key text not null check (meal_key in ('cafe_da_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar')),
  status text not null check (status in ('feito', 'parcial', 'pulado')),
  notes text,
  created_at timestamptz not null default now(),
  unique (patient_id, checkin_date, meal_key)
);

create index meal_checkins_patient_date_idx on public.meal_checkins(patient_id, checkin_date desc);

alter table public.meal_checkins enable row level security;

-- O paciente grava pelo portal público via service role (mesmo padrão da
-- anamnese); a policy aqui cobre só a leitura/gestão pelo profissional.
create policy "nutritionist manages own patients' checkins" on public.meal_checkins
  for all using (
    auth.uid() = (select nutritionist_id from public.patients where patients.id = meal_checkins.patient_id)
  );

-- ---------------------------------------------------------------------------
-- Biblioteca de receitas — modo de preparo vinculável a uma refeição do cardápio.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.nutritionists(id) on delete cascade,
  name text not null,
  description text,
  instructions text not null,
  ingredients jsonb not null default '[]',
  prep_time_min int,
  created_at timestamptz not null default now()
);

create index recipes_nutritionist_idx on public.recipes(nutritionist_id);

alter table public.recipes enable row level security;

create policy "recipes_owner" on public.recipes
  for all using (nutritionist_id = auth.uid()) with check (nutritionist_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Engajamento: base do alerta preditivo de evasão.
alter table public.patients
  add column last_portal_access_at timestamptz,
  add column engagement_score int not null default 100;
