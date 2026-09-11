-- Cria a linha em `nutritionists` automaticamente quando um novo usuário se
-- cadastra via Supabase Auth, usando full_name e crn enviados como
-- user_metadata na chamada de signUp (ver src/app/signup/page.tsx).

create function public.handle_new_nutritionist()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.nutritionists (id, full_name, crn)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Nutricionista'),
    coalesce(new.raw_user_meta_data->>'crn', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_nutritionist();
