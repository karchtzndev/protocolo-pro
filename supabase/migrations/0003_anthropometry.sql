-- Composição corporal — histórico de aferições por paciente.
-- Guarda as medidas brutas (peso, dobras, circunferências); os cálculos
-- (gasto energético, % de gordura, índices) são feitos em TypeScript a
-- partir desses valores, nunca armazenados prontos, para não desatualizar
-- se o profissional revisar o protocolo de cálculo.
create table anthropometry_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  recorded_at date not null default current_date,
  activity_level text not null default 'moderado'
    check (activity_level in ('sedentario','leve','moderado','ativo','muito_ativo')),
  weight_kg numeric(5,1) not null,
  height_m numeric(3,2) not null,
  lean_mass_kg numeric(5,1),
  neck_cm numeric(5,1),
  waist_cm numeric(5,1),
  hip_cm numeric(5,1),
  skinfold_chest_mm numeric(4,1),
  skinfold_midaxillary_mm numeric(4,1),
  skinfold_triceps_mm numeric(4,1),
  skinfold_subscapular_mm numeric(4,1),
  skinfold_abdominal_mm numeric(4,1),
  skinfold_suprailiac_mm numeric(4,1),
  skinfold_thigh_mm numeric(4,1),
  skinfold_bicep_mm numeric(4,1),
  notes text,
  created_at timestamptz not null default now()
);

create index anthropometry_records_patient_idx on anthropometry_records(patient_id, recorded_at desc);

alter table anthropometry_records enable row level security;

create policy "nutritionist manages own patients' anthropometry"
  on anthropometry_records
  for all
  using (
    exists (
      select 1 from patients
      where patients.id = anthropometry_records.patient_id
        and patients.nutritionist_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from patients
      where patients.id = anthropometry_records.patient_id
        and patients.nutritionist_id = auth.uid()
    )
  );
