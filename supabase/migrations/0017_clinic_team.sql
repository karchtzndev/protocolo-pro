-- Multi-profissional (plano Clínica): vários nutricionistas compartilhando
-- a mesma carteira de pacientes.
--
-- Estratégia: cada nutricionista pertence a uma "clínica", identificada pelo
-- id do dono (por padrão ele mesmo — todo mundo nasce dono da própria
-- clínica de uma pessoa só). Uma função central decide o acesso, e todas as
-- policies passam a chamá-la em vez de comparar com auth.uid() direto.

alter table public.nutritionists
  add column clinic_id uuid references public.nutritionists(id);

update public.nutritionists set clinic_id = id where clinic_id is null;

alter table public.nutritionists
  alter column clinic_id set not null;

create index nutritionists_clinic_idx on public.nutritionists(clinic_id);

-- security definer é obrigatório: a função lê `nutritionists`, que tem RLS.
-- Sem isso, avaliar a policy de uma tabela dispararia a policy de
-- nutritionists recursivamente.
create or replace function public.can_access_nutritionist(target uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select target = auth.uid()
      or exists (
        select 1
        from public.nutritionists me
        join public.nutritionists peer on peer.clinic_id = me.clinic_id
        where me.id = auth.uid() and peer.id = target
      );
$$;

-- ---------------------------------------------------------------------------
-- Reescreve as policies de dados de paciente para respeitarem a clínica.

drop policy "nutritionist manages own patients" on public.patients;
create policy "clinic manages patients" on public.patients
  for all using (public.can_access_nutritionist(nutritionist_id));

drop policy "nutritionist manages own protocols" on public.protocols;
create policy "clinic manages protocols" on public.protocols
  for all using (
    public.can_access_nutritionist((select nutritionist_id from public.patients where patients.id = protocols.patient_id))
  );

drop policy "nutritionist manages own patient supplements" on public.patient_supplements;
create policy "clinic manages patient supplements" on public.patient_supplements
  for all using (
    public.can_access_nutritionist((select nutritionist_id from public.patients where patients.id = patient_supplements.patient_id))
  );

drop policy "nutritionist manages own exams" on public.exams;
create policy "clinic manages exams" on public.exams
  for all using (
    public.can_access_nutritionist((select nutritionist_id from public.patients where patients.id = exams.patient_id))
  );

drop policy "nutritionist manages own exam results" on public.exam_results;
create policy "clinic manages exam results" on public.exam_results
  for all using (
    public.can_access_nutritionist((
      select p.nutritionist_id from public.exams e
      join public.patients p on p.id = e.patient_id
      where e.id = exam_results.exam_id
    ))
  );

drop policy "nutritionist manages own links" on public.patient_links;
create policy "clinic manages links" on public.patient_links
  for all using (
    public.can_access_nutritionist((select nutritionist_id from public.patients where patients.id = patient_links.patient_id))
  );

drop policy "nutritionist manages own patients' anthropometry" on public.anthropometry_records;
create policy "clinic manages anthropometry" on public.anthropometry_records
  for all using (
    public.can_access_nutritionist((select nutritionist_id from public.patients where patients.id = anthropometry_records.patient_id))
  );

drop policy "nutritionist manages own appointments" on public.appointments;
create policy "clinic manages appointments" on public.appointments
  for all using (public.can_access_nutritionist(nutritionist_id));

drop policy "nutritionist manages own patients' anamnesis" on public.anamnesis_responses;
create policy "clinic manages anamnesis" on public.anamnesis_responses
  for all using (
    public.can_access_nutritionist((select nutritionist_id from public.patients where patients.id = anamnesis_responses.patient_id))
  );

drop policy "compounded_formulas_owner" on public.compounded_formulas;
create policy "clinic manages compounded formulas" on public.compounded_formulas
  for all using (public.can_access_nutritionist(nutritionist_id))
  with check (public.can_access_nutritionist(nutritionist_id));

drop policy "nutritionist manages own patients' checkins" on public.meal_checkins;
create policy "clinic manages checkins" on public.meal_checkins
  for all using (
    public.can_access_nutritionist((select nutritionist_id from public.patients where patients.id = meal_checkins.patient_id))
  );

drop policy "recipes_owner" on public.recipes;
create policy "clinic manages recipes" on public.recipes
  for all using (public.can_access_nutritionist(nutritionist_id))
  with check (public.can_access_nutritionist(nutritionist_id));

-- Funil, planos de acompanhamento e assinaturas são compartilhados na clínica.
drop policy "crm_stages_owner" on public.crm_stages;
create policy "clinic manages crm stages" on public.crm_stages
  for all using (public.can_access_nutritionist(nutritionist_id))
  with check (public.can_access_nutritionist(nutritionist_id));

drop policy "subscription_plans_owner" on public.subscription_plans;
create policy "clinic manages subscription plans" on public.subscription_plans
  for all using (public.can_access_nutritionist(nutritionist_id))
  with check (public.can_access_nutritionist(nutritionist_id));

drop policy "patient_subscriptions_owner" on public.patient_subscriptions;
create policy "clinic manages patient subscriptions" on public.patient_subscriptions
  for all using (public.can_access_nutritionist(nutritionist_id))
  with check (public.can_access_nutritionist(nutritionist_id));

-- Cada profissional continua lendo só o próprio perfil, mas passa a enxergar
-- os colegas da clínica (necessário para listar a equipe).
drop policy "nutritionist reads own row" on public.nutritionists;
create policy "nutritionist reads clinic peers" on public.nutritionists
  for select using (public.can_access_nutritionist(id));

-- Faturamento da plataforma e LGPD continuam estritamente individuais
-- (audit_log, account_deletion_requests e broadcasts ficam como estavam).

-- ---------------------------------------------------------------------------
-- Convites para entrar na clínica.
create table public.clinic_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.nutritionists(id) on delete cascade,
  email text not null,
  token text not null unique,
  accepted_at timestamptz,
  accepted_by uuid references public.nutritionists(id),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create index clinic_invites_clinic_idx on public.clinic_invites(clinic_id);

alter table public.clinic_invites enable row level security;

create policy "clinic owner manages invites" on public.clinic_invites
  for all using (clinic_id = auth.uid()) with check (clinic_id = auth.uid());

-- ---------------------------------------------------------------------------
-- O limite de pacientes do plano Solo passa a olhar o plano do DONO da
-- clínica e a contar a carteira inteira — senão um profissional convidado
-- (que nasce com plan='solo') esbarraria no limite dentro de uma Clínica.
create or replace function public.enforce_patient_limit()
returns trigger
language plpgsql
as $$
declare
  owner_plan text;
  owner_id uuid;
  current_count integer;
  patient_limit integer := public.solo_plan_patient_limit();
begin
  select n.clinic_id into owner_id from public.nutritionists n where n.id = new.nutritionist_id;
  select n.plan into owner_plan from public.nutritionists n where n.id = owner_id;

  if owner_plan = 'clinica' then
    return new;
  end if;

  select count(*) into current_count
  from public.patients p
  join public.nutritionists n on n.id = p.nutritionist_id
  where n.clinic_id = owner_id and p.status != 'inativo';

  if current_count >= patient_limit then
    raise exception 'Limite de % pacientes do plano Solo atingido. Faça upgrade para o plano Clínica para cadastrar mais.', patient_limit;
  end if;

  return new;
end;
$$;

-- Novos cadastros nascem donos da própria clínica.
create or replace function public.handle_new_nutritionist()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', 'Nutricionista');
begin
  insert into public.nutritionists (id, full_name, crn, booking_slug, clinic_id)
  values (
    new.id,
    v_full_name,
    coalesce(new.raw_user_meta_data->>'crn', ''),
    lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 5),
    new.id
  );

  insert into public.crm_stages (nutritionist_id, key, label, position, color) values
    (new.id, 'lead', 'Leads', 0, 'neutral'),
    (new.id, 'agendado', 'Agendados', 1, 'neutral'),
    (new.id, 'acompanhamento', 'Em acompanhamento', 2, 'success'),
    (new.id, 'alerta_evasao', 'Alerta de evasão', 3, 'warning'),
    (new.id, 'inativo', 'Inativos', 4, 'neutral');

  return new;
end;
$$;
