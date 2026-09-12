-- Triagem clínica automática (6 sinalizadores do documento de funcionalidades)
-- e dose padrão por suplemento, para pré-preencher a prescrição.

alter table patients
  add column clinical_flags text[] not null default '{}';

comment on column patients.clinical_flags is
  'Sinalizadores de triagem clínica: gestante_lactante, doenca_renal_hepatica_cardiaca, diabetes_insulina, cirurgia_bariatrica, transtorno_alimentar. Menor de 18 é calculado a partir de birth_date, não armazenado aqui.';

alter table supplements_catalog
  add column default_dose numeric;

update supplements_catalog set default_dose = v.dose from (values
  ('Whey Protein Isolado', 30),
  ('Creatina Monohidratada', 5),
  ('Ômega 3', 2),
  ('Vitamina D3', 2000),
  ('Magnésio Dimalato', 300),
  ('Multivitamínico', 1),
  ('Glutamina', 5),
  ('Cafeína Anidra', 200),
  ('Zinco Quelato', 15),
  ('Colágeno Hidrolisado', 10),
  ('BCAA 2:1:1', 10),
  ('Probiótico', 1),
  ('Ácido Fólico', 400),
  ('Sulfato Ferroso', 40),
  ('Vitamina B12 (Cianocobalamina)', 500),
  ('Cálcio Citrato', 600),
  ('Vitamina C', 500),
  ('Selênio', 100),
  ('Iodo', 150),
  ('Vitamina K2', 100),
  ('DHA (Óleo de algas/peixe)', 250),
  ('Curcumina', 500),
  ('Coenzima Q10', 100),
  ('Enzimas Digestivas', 1),
  ('Própolis', 250),
  ('Spirulina', 3),
  ('Psyllium', 10),
  ('Beta-glucana', 1),
  ('Beta-alanina', 3),
  ('Citrulina Malato', 6),
  ('Complexo B', 1),
  ('Óleo de Prímula', 1000),
  ('Isoflavona de Soja', 80),
  ('Maca Peruana', 1500),
  ('Cromo Picolinato', 200)
) as v(name, dose)
where supplements_catalog.name = v.name;
