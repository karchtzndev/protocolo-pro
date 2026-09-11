-- Log de auditoria (LGPD) e solicitação de exclusão de conta.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references nutritionists(id) on delete cascade,
  action_type text not null check (action_type in (
    'paciente.arquivar','antropometria.registrar','plano.criar','protocolo.trocar_item',
    'protocolo.publicar','protocolo.revogar_link','exame.enviar','exame.reprocessar',
    'exame.confirmar','suplementacao.salvar','suplementacao.assinar','perfil.atualizar',
    'dados.exportar','conta.solicitar_exclusao'
  )),
  target_type text,
  target_id uuid,
  ip_truncated text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_nutritionist_idx on audit_log(nutritionist_id, created_at desc);

alter table audit_log enable row level security;

create policy "nutritionist reads own audit log" on audit_log
  for select using (nutritionist_id = auth.uid());
create policy "nutritionist writes own audit log" on audit_log
  for insert with check (nutritionist_id = auth.uid());

create table account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references nutritionists(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente','cancelada','concluida')),
  cancelled_at timestamptz
);

alter table account_deletion_requests enable row level security;

create policy "nutritionist manages own deletion request" on account_deletion_requests
  for all using (nutritionist_id = auth.uid()) with check (nutritionist_id = auth.uid());
