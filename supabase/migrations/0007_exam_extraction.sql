-- Rastreia como cada marcador foi extraído e exige confirmação do
-- profissional antes de considerá-lo válido.
alter table exam_results
  add column metodo_extracao text
    check (metodo_extracao in ('texto_pdf','ia_visao')),
  add column confirmed boolean not null default false;
