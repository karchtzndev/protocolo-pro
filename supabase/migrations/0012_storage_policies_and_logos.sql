-- Bucket para logo da clínica (upload de white-label) + políticas de escrita
-- no Storage. `storage.objects` tem RLS habilitada sem nenhuma política
-- ainda — sem isso, uploads autenticados (inclusive os de exames, já em
-- produção) são negados por padrão.

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "authenticated users manage exam files" on storage.objects
  for all
  using (bucket_id = 'exams' and auth.role() = 'authenticated')
  with check (bucket_id = 'exams' and auth.role() = 'authenticated');

create policy "authenticated users manage logo files" on storage.objects
  for all
  using (bucket_id = 'logos' and auth.role() = 'authenticated')
  with check (bucket_id = 'logos' and auth.role() = 'authenticated');
