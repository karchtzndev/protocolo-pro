-- CRM Kanban (funil de captação), tags de paciente, link público de captação
-- de leads e broadcast (comunicados em lote filtrados por tag).

create table public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.nutritionists(id) on delete cascade,
  key text not null,
  label text not null,
  position int not null,
  color text not null default 'neutral',
  created_at timestamptz not null default now(),
  unique (nutritionist_id, key)
);

alter table public.crm_stages enable row level security;

create policy "crm_stages_owner" on public.crm_stages
  for all using (nutritionist_id = auth.uid()) with check (nutritionist_id = auth.uid());

alter table public.patients
  add column stage_id uuid references public.crm_stages(id) on delete set null,
  add column tags text[] not null default '{}';

create index patients_stage_id_idx on public.patients(stage_id);
create index patients_tags_idx on public.patients using gin(tags);

alter table public.nutritionists
  add column booking_slug text unique;

-- Seed dos estágios padrão para nutricionistas já existentes.
insert into public.crm_stages (nutritionist_id, key, label, position, color)
select n.id, s.key, s.label, s.position, s.color
from public.nutritionists n
cross join (values
  ('lead', 'Leads', 0, 'neutral'),
  ('agendado', 'Agendados', 1, 'neutral'),
  ('acompanhamento', 'Em acompanhamento', 2, 'success'),
  ('alerta_evasao', 'Alerta de evasão', 3, 'warning'),
  ('inativo', 'Inativos', 4, 'neutral')
) as s(key, label, position, color)
on conflict (nutritionist_id, key) do nothing;

-- Encaixa pacientes já cadastrados num estágio coerente com o status atual.
update public.patients p
set stage_id = cs.id
from public.crm_stages cs
where p.stage_id is null
  and cs.nutritionist_id = p.nutritionist_id
  and cs.key = case
    when p.status = 'inativo' then 'inativo'
    when p.status = 'pendente' then 'lead'
    else 'acompanhamento'
  end;

update public.nutritionists
set booking_slug = lower(regexp_replace(full_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 5)
where booking_slug is null;

-- Estende o trigger de signup para novos nutricionistas já nascerem com
-- estágios padrão e um slug de captação público.
create or replace function public.handle_new_nutritionist()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', 'Nutricionista');
begin
  insert into public.nutritionists (id, full_name, crn, booking_slug)
  values (
    new.id,
    v_full_name,
    coalesce(new.raw_user_meta_data->>'crn', ''),
    lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 5)
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

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.nutritionists(id) on delete cascade,
  title text not null,
  body text not null,
  filter_tags text[] not null default '{}',
  recipient_count int not null default 0,
  sent_at timestamptz not null default now()
);

alter table public.broadcasts enable row level security;

create policy "broadcasts_owner" on public.broadcasts
  for all using (nutritionist_id = auth.uid()) with check (nutritionist_id = auth.uid());
