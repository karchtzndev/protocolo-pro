-- Agendamento de consultas e anamnese enviada automaticamente ao paciente
-- junto do agendamento (via o mesmo portal público /p/[slug] que ele já usa).

create table appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  nutritionist_id uuid not null references nutritionists(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'agendado' check (status in ('agendado','concluido','cancelado')),
  notes text,
  created_at timestamptz not null default now()
);

create index appointments_patient_idx on appointments(patient_id, scheduled_at desc);
create index appointments_nutritionist_idx on appointments(nutritionist_id, scheduled_at desc);

alter table appointments enable row level security;

create policy "nutritionist manages own appointments" on appointments
  for all
  using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

create table anamnesis_responses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente','preenchido')),
  responses jsonb not null default '{}',
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create index anamnesis_responses_patient_idx on anamnesis_responses(patient_id, created_at desc);

alter table anamnesis_responses enable row level security;

create policy "nutritionist manages own patients' anamnesis" on anamnesis_responses
  for all
  using (
    exists (
      select 1 from patients
      where patients.id = anamnesis_responses.patient_id
        and patients.nutritionist_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from patients
      where patients.id = anamnesis_responses.patient_id
        and patients.nutritionist_id = auth.uid()
    )
  );

-- O portal público do paciente (/p/[slug]) usa o cliente service-role, então
-- não passa pela RLS acima — o controle de acesso ali é feito pelo cookie de
-- PIN, no mesmo padrão já usado para consent_accepted_at.

alter table audit_log drop constraint audit_log_action_type_check;
alter table audit_log add constraint audit_log_action_type_check check (action_type in (
  'paciente.arquivar','antropometria.registrar','plano.criar','protocolo.trocar_item',
  'protocolo.publicar','protocolo.revogar_link','exame.enviar','exame.reprocessar',
  'exame.confirmar','suplementacao.salvar','suplementacao.assinar','perfil.atualizar',
  'dados.exportar','conta.solicitar_exclusao','consulta.agendar','consulta.cancelar'
));
