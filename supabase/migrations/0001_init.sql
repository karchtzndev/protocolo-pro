-- Protocolo.Pro — schema inicial
-- Rode com: supabase db push  (ou cole no SQL editor do painel Supabase)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Nutricionistas (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table nutritionists (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  crn text not null,
  clinic_name text,
  clinic_phone text,
  brand_primary_color text default '#1F4B3F',
  brand_accent_color text default '#A6761E',
  logo_url text,
  consent_document_url text,
  privacy_document_url text,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text default 'trialing'
    check (subscription_status in ('trialing','active','past_due','canceled')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Pacientes
-- ---------------------------------------------------------------------------
create table patients (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references nutritionists(id) on delete cascade,
  full_name text not null,
  birth_date date not null,
  sex text check (sex in ('feminino','masculino','outro')),
  phone text,
  email text,
  objective text,
  restrictions text[] default '{}',
  clinical_history text,
  status text not null default 'ativo' check (status in ('ativo','pendente','inativo')),
  created_at timestamptz not null default now()
);

create index patients_nutritionist_idx on patients(nutritionist_id);

-- ---------------------------------------------------------------------------
-- Protocolo alimentar (antropometria + cardápio semanal em jsonb)
-- ---------------------------------------------------------------------------
create table protocols (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  weight_kg numeric(5,1),
  height_m numeric(3,2),
  body_fat_pct numeric(4,1),
  waist_cm numeric(5,1),
  -- { "seg": { "cafe_da_manha": {"descricao": "...", "kcal": 340}, "almoco": {...}, ... }, "ter": {...}, ... }
  weekly_menu jsonb not null default '{}',
  shopping_list text[] default '{}',
  guidance text[] default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index protocols_patient_idx on protocols(patient_id);

-- ---------------------------------------------------------------------------
-- Catálogo de suplementos (compartilhado entre nutricionistas)
-- ---------------------------------------------------------------------------
create table supplements_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  max_daily_dose numeric,
  dose_unit text
);

-- ---------------------------------------------------------------------------
-- Suplementos prescritos a um paciente
-- ---------------------------------------------------------------------------
create table patient_supplements (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  supplement_id uuid not null references supplements_catalog(id),
  dose numeric not null,
  dose_unit text not null,
  schedule text not null,
  created_at timestamptz not null default now()
);

create index patient_supplements_patient_idx on patient_supplements(patient_id);

-- ---------------------------------------------------------------------------
-- Exames
-- ---------------------------------------------------------------------------
create table exams (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  file_url text not null,
  exam_date date,
  status text not null default 'processando' check (status in ('processando','concluido','erro')),
  created_at timestamptz not null default now()
);

create table exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  test_name text not null,
  result_value text not null,
  reference_range text,
  out_of_range boolean not null default false
);

create index exam_results_exam_idx on exam_results(exam_id);

-- ---------------------------------------------------------------------------
-- Links públicos de acesso do paciente
-- ---------------------------------------------------------------------------
create table patient_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  slug text not null unique,
  pin_last4_birthdate text not null, -- ddmm ou ddmmyyyy, comparado no server
  expires_at timestamptz,
  revoked_at timestamptz,
  consent_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index patient_links_slug_idx on patient_links(slug);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table nutritionists enable row level security;
alter table patients enable row level security;
alter table protocols enable row level security;
alter table patient_supplements enable row level security;
alter table exams enable row level security;
alter table exam_results enable row level security;
alter table patient_links enable row level security;
alter table supplements_catalog enable row level security;

create policy "nutritionist reads own row" on nutritionists
  for select using (auth.uid() = id);
create policy "nutritionist updates own row" on nutritionists
  for update using (auth.uid() = id);

create policy "nutritionist manages own patients" on patients
  for all using (auth.uid() = nutritionist_id);

create policy "nutritionist manages own protocols" on protocols
  for all using (
    auth.uid() = (select nutritionist_id from patients where patients.id = protocols.patient_id)
  );

create policy "nutritionist manages own patient supplements" on patient_supplements
  for all using (
    auth.uid() = (select nutritionist_id from patients where patients.id = patient_supplements.patient_id)
  );

create policy "nutritionist manages own exams" on exams
  for all using (
    auth.uid() = (select nutritionist_id from patients where patients.id = exams.patient_id)
  );

create policy "nutritionist manages own exam results" on exam_results
  for all using (
    auth.uid() = (
      select p.nutritionist_id from exams e
      join patients p on p.id = e.patient_id
      where e.id = exam_results.exam_id
    )
  );

create policy "nutritionist manages own links" on patient_links
  for all using (
    auth.uid() = (select nutritionist_id from patients where patients.id = patient_links.patient_id)
  );

create policy "anyone reads the supplement catalog" on supplements_catalog
  for select using (true);

-- Acesso do paciente (rota pública /p/[slug]) é feito via service role
-- no servidor, nunca direto do browser — por isso nenhuma policy "anon" é
-- necessária aqui. Ver src/app/p/[slug]/actions.ts.

-- ---------------------------------------------------------------------------
-- Seed: catálogo inicial de suplementos (amostra — expanda até os 35 itens)
-- ---------------------------------------------------------------------------
insert into supplements_catalog (name, category, description, max_daily_dose, dose_unit) values
  ('Whey Protein Isolado', 'Proteína', 'Recuperação e síntese muscular', 60, 'g'),
  ('Creatina Monohidratada', 'Performance', 'Força e volume muscular', 5, 'g'),
  ('Ômega 3', 'Ácidos graxos', 'Saúde cardiovascular e anti-inflamatório', 3, 'g'),
  ('Vitamina D3', 'Vitamina', 'Saúde óssea e imunidade', 4000, 'UI'),
  ('Magnésio Dimalato', 'Mineral', 'Recuperação muscular e sono', 400, 'mg'),
  ('Multivitamínico', 'Vitamina', 'Suporte nutricional geral', 1, 'dose'),
  ('Glutamina', 'Aminoácido', 'Imunidade e saúde intestinal', 10, 'g'),
  ('Cafeína Anidra', 'Estimulante', 'Pré-treino e foco', 400, 'mg'),
  ('Zinco Quelato', 'Mineral', 'Imunidade', 40, 'mg'),
  ('Colágeno Hidrolisado', 'Proteína', 'Pele, cabelo e articulações', 15, 'g'),
  ('BCAA 2:1:1', 'Aminoácido', 'Anticatabólico', 15, 'g'),
  ('Probiótico', 'Suplemento intestinal', 'Saúde intestinal', 1, 'dose');
