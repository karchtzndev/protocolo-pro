-- Suplementação avançada: classificação CFN 656/2020, nível de evidência,
-- necessidade de habilitação em fitoterapia, justificativa/assinatura da
-- prescrição, e protocolos pré-montados por caso clínico.

alter table supplements_catalog
  add column cfn_category text
    check (cfn_category in (
      'vitaminas_e_minerais',
      'bioativos_enzimas_probioticos',
      'novos_alimentos_e_apicolas',
      'alegacao_funcional',
      'uso_esportivo',
      'gestantes_e_nutrizes',
      'medicamento_isento_prescricao'
    )),
  add column evidence_level text
    check (evidence_level in ('alta','moderada','baixa','insuficiente')),
  add column requires_fitoterapia_license boolean not null default false;

-- max_daily_dose já existente passa a ser o Limite Superior Tolerável (UL).

alter table patient_supplements
  add column justification text,
  add column signed_at timestamptz,
  add column signed_by uuid references nutritionists(id);

-- Assinatura é imutável: depois de assinada, a prescrição não pode mudar.
create function public.prevent_signed_prescription_edit()
returns trigger
language plpgsql
as $$
begin
  if old.signed_at is not null then
    raise exception 'Prescrição já assinada não pode ser alterada.';
  end if;
  return new;
end;
$$;

create trigger patient_supplements_lock_signed
  before update on patient_supplements
  for each row execute function public.prevent_signed_prescription_edit();

-- ---------------------------------------------------------------------------
-- Protocolos pré-montados de suplementação
-- ---------------------------------------------------------------------------
create table supplement_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text
);

create table supplement_preset_items (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references supplement_presets(id) on delete cascade,
  supplement_id uuid not null references supplements_catalog(id),
  dose numeric not null,
  dose_unit text not null,
  schedule text not null
);

alter table supplement_presets enable row level security;
alter table supplement_preset_items enable row level security;

create policy "anyone reads supplement presets" on supplement_presets for select using (true);
create policy "anyone reads supplement preset items" on supplement_preset_items for select using (true);

-- Atualiza os itens já existentes com classificação e evidência.
update supplements_catalog set cfn_category = 'uso_esportivo', evidence_level = 'alta' where name in ('Whey Protein Isolado','Creatina Monohidratada','Cafeína Anidra','BCAA 2:1:1');
update supplements_catalog set cfn_category = 'uso_esportivo', evidence_level = 'moderada' where name = 'Glutamina';
update supplements_catalog set cfn_category = 'vitaminas_e_minerais', evidence_level = 'alta' where name in ('Vitamina D3','Magnésio Dimalato','Zinco Quelato');
update supplements_catalog set cfn_category = 'vitaminas_e_minerais', evidence_level = 'moderada' where name = 'Multivitamínico';
update supplements_catalog set cfn_category = 'bioativos_enzimas_probioticos', evidence_level = 'moderada' where name = 'Probiótico';
update supplements_catalog set cfn_category = 'alegacao_funcional', evidence_level = 'moderada' where name = 'Ômega 3';
update supplements_catalog set cfn_category = 'novos_alimentos_e_apicolas', evidence_level = 'baixa' where name = 'Colágeno Hidrolisado';

insert into supplements_catalog (name, category, description, max_daily_dose, dose_unit, cfn_category, evidence_level, requires_fitoterapia_license) values
('Ácido Fólico', 'Vitamina', 'Prevenção de defeitos do tubo neural na gestação', 1000, 'mcg', 'gestantes_e_nutrizes', 'alta', false),
('Sulfato Ferroso', 'Mineral', 'Reposição de ferro em anemia ferropriva', 45, 'mg', 'vitaminas_e_minerais', 'alta', false),
('Vitamina B12 (Cianocobalamina)', 'Vitamina', 'Reposição em dietas vegetarianas/veganas e deficiência', 1000, 'mcg', 'vitaminas_e_minerais', 'alta', false),
('Cálcio Citrato', 'Mineral', 'Saúde óssea, prevenção de osteoporose', 2500, 'mg', 'vitaminas_e_minerais', 'alta', false),
('Vitamina C', 'Vitamina', 'Antioxidante, absorção de ferro não-heme', 2000, 'mg', 'vitaminas_e_minerais', 'moderada', false),
('Selênio', 'Mineral', 'Função tireoidiana e antioxidante', 400, 'mcg', 'vitaminas_e_minerais', 'moderada', false),
('Iodo', 'Mineral', 'Síntese de hormônios tireoidianos', 1100, 'mcg', 'vitaminas_e_minerais', 'alta', false),
('Vitamina K2', 'Vitamina', 'Metabolismo ósseo e cardiovascular', 400, 'mcg', 'vitaminas_e_minerais', 'baixa', false),
('DHA (Óleo de algas/peixe)', 'Ácido graxo', 'Desenvolvimento neurológico fetal na gestação', 1000, 'mg', 'gestantes_e_nutrizes', 'alta', false),
('Curcumina', 'Bioativo', 'Anti-inflamatório', 1000, 'mg', 'bioativos_enzimas_probioticos', 'moderada', false),
('Coenzima Q10', 'Bioativo', 'Suporte mitocondrial e cardiovascular', 300, 'mg', 'bioativos_enzimas_probioticos', 'baixa', false),
('Enzimas Digestivas', 'Enzima', 'Suporte à digestão', 1, 'dose', 'bioativos_enzimas_probioticos', 'baixa', false),
('Própolis', 'Apícola', 'Imunomodulador', 500, 'mg', 'novos_alimentos_e_apicolas', 'baixa', false),
('Spirulina', 'Novo alimento', 'Fonte de proteína e antioxidantes', 10, 'g', 'novos_alimentos_e_apicolas', 'insuficiente', false),
('Psyllium', 'Fibra', 'Saciedade e trânsito intestinal', 30, 'g', 'alegacao_funcional', 'alta', false),
('Beta-glucana', 'Fibra', 'Modulação do colesterol e imunidade', 3, 'g', 'alegacao_funcional', 'moderada', false),
('Beta-alanina', 'Aminoácido', 'Performance em exercícios de alta intensidade', 6, 'g', 'uso_esportivo', 'moderada', false),
('Citrulina Malato', 'Aminoácido', 'Performance e recuperação muscular', 8, 'g', 'uso_esportivo', 'moderada', false),
('Complexo B', 'Vitamina', 'Suporte ao metabolismo energético', 1, 'dose', 'medicamento_isento_prescricao', 'baixa', false),
('Óleo de Prímula', 'Fitoterápico', 'Sintomas da menopausa (TPM/climatério)', 3000, 'mg', 'bioativos_enzimas_probioticos', 'baixa', true),
('Isoflavona de Soja', 'Fitoterápico', 'Sintomas vasomotores da menopausa', 100, 'mg', 'bioativos_enzimas_probioticos', 'moderada', true),
('Maca Peruana', 'Fitoterápico', 'Libido e disposição na andropausa', 3000, 'mg', 'bioativos_enzimas_probioticos', 'baixa', true),
('Cromo Picolinato', 'Mineral', 'Sensibilidade à insulina', 1000, 'mcg', 'vitaminas_e_minerais', 'baixa', false);

-- Presets clínicos (id resolvido via subquery pelo nome do suplemento).
insert into supplement_presets (name, description) values
('Gestação', 'Suplementação básica recomendada durante a gestação'),
('Lactação', 'Suporte nutricional para nutrizes'),
('Menopausa', 'Suporte aos sintomas do climatério'),
('Andropausa', 'Suporte à disposição e composição corporal no homem 45+'),
('Terceira idade (60+)', 'Suporte à saúde óssea, cognitiva e imunológica'),
('Vegetarianismo e veganismo estritos', 'Reposição de nutrientes de risco em dietas restritas'),
('Diabetes tipo 2 e resistência insulínica', 'Suporte à sensibilidade insulínica'),
('Hipotireoidismo', 'Suporte à função tireoidiana'),
('Anemia ferropriva', 'Reposição de ferro e cofatores de absorção'),
('Osteoporose e osteopenia', 'Suporte à saúde óssea');

insert into supplement_preset_items (preset_id, supplement_id, dose, dose_unit, schedule)
select p.id, s.id, v.dose, v.dose_unit, v.schedule
from (values
  ('Gestação','Ácido Fólico',400,'mcg','1x ao dia, pela manhã'),
  ('Gestação','Sulfato Ferroso',40,'mg','1x ao dia, em jejum'),
  ('Gestação','DHA (Óleo de algas/peixe)',200,'mg','1x ao dia, com refeição'),
  ('Lactação','Vitamina D3',2000,'UI','1x ao dia'),
  ('Lactação','Cálcio Citrato',500,'mg','2x ao dia'),
  ('Lactação','DHA (Óleo de algas/peixe)',200,'mg','1x ao dia'),
  ('Menopausa','Isoflavona de Soja',80,'mg','1x ao dia'),
  ('Menopausa','Cálcio Citrato',600,'mg','1x ao dia'),
  ('Menopausa','Vitamina K2',100,'mcg','1x ao dia'),
  ('Andropausa','Maca Peruana',1500,'mg','1x ao dia'),
  ('Andropausa','Zinco Quelato',15,'mg','1x ao dia'),
  ('Terceira idade (60+)','Vitamina D3',2000,'UI','1x ao dia'),
  ('Terceira idade (60+)','Cálcio Citrato',600,'mg','1x ao dia'),
  ('Terceira idade (60+)','Vitamina B12 (Cianocobalamina)',500,'mcg','1x ao dia'),
  ('Vegetarianismo e veganismo estritos','Vitamina B12 (Cianocobalamina)',1000,'mcg','1x por semana'),
  ('Vegetarianismo e veganismo estritos','Sulfato Ferroso',30,'mg','1x ao dia'),
  ('Vegetarianismo e veganismo estritos','DHA (Óleo de algas/peixe)',300,'mg','1x ao dia'),
  ('Diabetes tipo 2 e resistência insulínica','Cromo Picolinato',200,'mcg','1x ao dia'),
  ('Diabetes tipo 2 e resistência insulínica','Magnésio Dimalato',300,'mg','1x ao dia'),
  ('Hipotireoidismo','Selênio',100,'mcg','1x ao dia'),
  ('Hipotireoidismo','Iodo',150,'mcg','1x ao dia'),
  ('Anemia ferropriva','Sulfato Ferroso',40,'mg','1x ao dia, em jejum, com vitamina C'),
  ('Anemia ferropriva','Vitamina C',500,'mg','junto ao ferro'),
  ('Osteoporose e osteopenia','Cálcio Citrato',600,'mg','2x ao dia'),
  ('Osteoporose e osteopenia','Vitamina D3',2000,'UI','1x ao dia'),
  ('Osteoporose e osteopenia','Vitamina K2',100,'mcg','1x ao dia')
) as v(preset_name, supplement_name, dose, dose_unit, schedule)
join supplement_presets p on p.name = v.preset_name
join supplements_catalog s on s.name = v.supplement_name;
