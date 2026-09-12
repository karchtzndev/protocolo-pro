-- Modularidade por nicho de atendimento (esportiva, materno-infantil,
-- clínico) e prescrição avançada de fórmulas manipuladas com checagem de
-- interações entre substâncias.

alter table public.nutritionists
  add column enabled_modules text[] not null default '{esportiva,materno_infantil,clinico}';

create table public.substance_interactions (
  id uuid primary key default gen_random_uuid(),
  substance_a text not null,
  substance_b text not null,
  severity text not null check (severity in ('leve', 'moderada', 'grave')),
  description text not null
);

-- Seed de referência com interações amplamente documentadas entre
-- nutrientes/fitoterápicos comuns em manipulados — lista de apoio à decisão,
-- não substitui julgamento clínico do profissional responsável.
insert into public.substance_interactions (substance_a, substance_b, severity, description) values
  ('cálcio', 'ferro', 'moderada', 'Cálcio reduz a absorção de ferro não-heme — separar os horários de administração.'),
  ('cálcio', 'zinco', 'leve', 'Doses altas de cálcio podem reduzir a absorção de zinco.'),
  ('ferro', 'zinco', 'moderada', 'Ferro e zinco competem pelo mesmo transportador de absorção intestinal.'),
  ('vitamina d', 'vitamina k2', 'leve', 'Combinação geralmente sinérgica, mas doses altas de vitamina D sem K2 podem favorecer calcificação vascular.'),
  ('vitamina e', 'vitamina k', 'moderada', 'Vitamina E em altas doses pode antagonizar a função da vitamina K na coagulação.'),
  ('5-htp', 'triptofano', 'grave', 'Combinação de precursores serotoninérgicos aumenta risco de síndrome serotoninérgica.'),
  ('erva de são joão', 'anticoncepcional', 'grave', 'Erva de São João induz enzimas hepáticas e pode reduzir a eficácia de anticoncepcionais.'),
  ('cafeína', 'efedrina', 'grave', 'Associação estimulante com risco cardiovascular aumentado (arritmia, hipertensão).'),
  ('cafeína', 'sinefrina', 'moderada', 'Efeito estimulante aditivo — risco cardiovascular em doses altas.'),
  ('magnésio', 'zinco', 'leve', 'Doses altas de zinco podem reduzir a absorção de magnésio.'),
  ('l-tirosina', 'iodo', 'leve', 'Ambos atuam na síntese de hormônios tireoidianos — monitorar em disfunção tireoidiana.'),
  ('melatonina', 'cafeína', 'moderada', 'Cafeína antagoniza o efeito indutor de sono da melatonina.'),
  ('picolinato de cromo', 'ferro', 'leve', 'Podem competir pela mesma via de absorção em doses elevadas.'),
  ('ômega 3', 'vitamina e', 'leve', 'Vitamina E é frequentemente associada para proteger o ômega 3 da oxidação — sem risco, apenas nota informativa.');

create table public.compounded_formulas (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.nutritionists(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null,
  ingredients jsonb not null default '[]',
  interaction_warnings text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.compounded_formulas enable row level security;

create policy "compounded_formulas_owner" on public.compounded_formulas
  for all using (nutritionist_id = auth.uid()) with check (nutritionist_id = auth.uid());

create index compounded_formulas_patient_idx on public.compounded_formulas(patient_id);
