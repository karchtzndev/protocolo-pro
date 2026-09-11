-- Dois planos (Solo / Clínica), limite de pacientes por trigger no banco
-- (não dá pra burlar pela interface), e deduplicação de eventos do Stripe.

alter table nutritionists
  add column plan text not null default 'solo' check (plan in ('solo','clinica'));

-- Limite do plano Solo. Ajuste aqui se o número comercial mudar — é a única
-- fonte de verdade, tanto para o trigger quanto para a mensagem de erro.
create function public.solo_plan_patient_limit()
returns integer
language sql
immutable
as $$ select 40 $$;

create function public.enforce_patient_limit()
returns trigger
language plpgsql
as $$
declare
  nutritionist_plan text;
  current_count integer;
  patient_limit integer := public.solo_plan_patient_limit();
begin
  select plan into nutritionist_plan from public.nutritionists where id = new.nutritionist_id;

  if nutritionist_plan = 'clinica' then
    return new;
  end if;

  -- Pacientes arquivados (inativo) não contam contra o limite — arquivar libera espaço.
  select count(*) into current_count
  from public.patients
  where nutritionist_id = new.nutritionist_id and status != 'inativo';

  if current_count >= patient_limit then
    raise exception 'Limite de % pacientes do plano Solo atingido. Faça upgrade para o plano Clínica para cadastrar mais.', patient_limit;
  end if;

  return new;
end;
$$;

create trigger patients_enforce_limit
  before insert on patients
  for each row execute function public.enforce_patient_limit();

-- Deduplicação de eventos do webhook do Stripe — processar o mesmo evento
-- duas vezes (reentrega) não deve duplicar efeitos colaterais.
create table stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);
