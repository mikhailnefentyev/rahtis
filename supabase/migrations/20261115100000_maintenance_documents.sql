-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы машины и сервисной книжки (15.11.2026)
--
-- К машине или прицепу — архив файлов: счёт мастерской, протокол
-- katsastus, калибровка тахографа, регистрационная справка, фото.
-- Файл можно привязать к строке книжки (приложить счёт к ремонту).
--
-- Файл кладёт сервер служебным ключом, но только после того, как строка
-- прошла RLS и триггеры под сессией перевозчика: в хранилище не попадает
-- ничего, на что у компании нет права. Читают — своя компания (первый
-- сегмент пути, политика fleet_docs_read_own) и ссылки, подписанные
-- сервером для строк, которые сессия уже увидела.
--
-- Хранятся, пока машина в парке или пока перевозчик сам не удалит.
-- Строки уходят каскадом вместе с машиной или строкой книжки; файлы без
-- строки (и фото дефектов без дефекта) через сутки убирает ежедневная
-- уборка /api/retention/photos (public.retention_fleet_orphans).
-- ═══════════════════════════════════════════════════════════════════

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'fleet-docs';

create table public.maintenance_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete cascade,
  trailer_id uuid references public.trailers (id) on delete cascade,
  /* Строка книжки, к которой приложен файл (счёт к ремонту); пусто — просто в архиве машины. */
  record_id uuid references public.maintenance_records (id) on delete cascade,
  kind text not null constraint maintenance_documents_kind
    check (kind in ('RECEIPT', 'PROTOCOL', 'CERTIFICATE', 'REGISTRATION', 'PHOTO', 'OTHER')),
  title text constraint maintenance_documents_title check (char_length(btrim(title)) between 2 and 80),
  file_name text not null constraint maintenance_documents_file_name check (char_length(file_name) between 1 and 120),
  mime_type text not null constraint maintenance_documents_mime
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null constraint maintenance_documents_size check (size_bytes between 1 and 10485760),
  storage_path text not null unique,
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint maintenance_documents_asset check (num_nonnulls(vehicle_id, trailer_id) = 1),
  /* Путь собирает сервер, но своя папка компании проверяется здесь. */
  constraint maintenance_documents_path check (storage_path like company_id::text || '/docs/%')
);

comment on table public.maintenance_documents is
  'Документы машины или прицепа (счета, протоколы, справки, фото), при желании — к строке сервисной книжки. Файлы в fleet-docs.';

create index maintenance_documents_vehicle_idx on public.maintenance_documents (vehicle_id, created_at desc) where vehicle_id is not null;
create index maintenance_documents_trailer_idx on public.maintenance_documents (trailer_id, created_at desc) where trailer_id is not null;
create index maintenance_documents_record_idx on public.maintenance_documents (record_id) where record_id is not null;
create index maintenance_documents_company_idx on public.maintenance_documents (company_id);

create trigger maintenance_documents_asset_check
  before insert or update of vehicle_id, trailer_id, company_id on public.maintenance_documents
  for each row execute function app.fleet_asset_check();

/* Строка книжки — той же машины или прицепа: чужой ремонт к своему файлу не привязать. */
create or replace function app.maintenance_document_record_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.record_id is not null and not exists (
    select 1 from public.maintenance_records r
    where r.id = new.record_id
      and r.company_id = new.company_id
      and r.vehicle_id is not distinct from new.vehicle_id
      and r.trailer_id is not distinct from new.trailer_id
  ) then
    raise exception 'Запись книжки другой машины.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger maintenance_documents_record_check
  before insert or update of record_id, vehicle_id, trailer_id, company_id on public.maintenance_documents
  for each row execute function app.maintenance_document_record_check();

alter table public.maintenance_documents enable row level security;

create policy maintenance_documents_own
  on public.maintenance_documents for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy maintenance_documents_insert_own
  on public.maintenance_documents for insert to authenticated
  with check (company_id = (select app.current_company_id()));

create policy maintenance_documents_delete_own
  on public.maintenance_documents for delete to authenticated
  using (company_id = (select app.current_company_id()));

create policy maintenance_documents_admin
  on public.maintenance_documents for select to authenticated using ((select app.is_admin()));

grant select, delete on public.maintenance_documents to authenticated;
grant insert (company_id, vehicle_id, trailer_id, record_id, kind, title, file_name, mime_type, size_bytes, storage_path)
  on public.maintenance_documents to authenticated;

-- ── Уборка: файлы без строки ──────────────────────────────────────

/*
 * Файлы fleet-docs, на которые не ссылается ни документ, ни дефект:
 * машину удалили (строки ушли каскадом), загрузка оборвалась между
 * файлом и строкой. Сутки запаса — водитель кладёт фото дефекта раньше,
 * чем строку.
 */
create or replace function public.retention_fleet_orphans(p_limit integer default 500)
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'fleet-docs'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.maintenance_documents d where d.storage_path = o.name)
    and not exists (select 1 from public.vehicle_defects d where d.photo_path = o.name)
  order by o.created_at
  limit p_limit;
$$;

revoke all on function public.retention_fleet_orphans(integer) from public, anon, authenticated;
grant execute on function public.retention_fleet_orphans(integer) to service_role;
