-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · значок «Tarkastettu»: принимать только увиденные файлы (3.11.2026)
--
-- grant_verification принимал все непринятые справки компании на момент
-- нажатия. Файл, загруженный, пока оператор читал страницу, считался бы
-- принятым без просмотра. Теперь форма передаёт время открытия страницы
-- (p_seen_at), и принимаются только файлы, загруженные до него.
-- ═══════════════════════════════════════════════════════════════════

drop function public.grant_verification(uuid, text);

create or replace function public.grant_verification(p_company_id uuid, p_seen_at timestamptz, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_seen_at is null then
    raise exception 'Нужно время, когда оператор открыл пакет.' using errcode = '22023';
  end if;

  if not (select app.is_admin()) then
    raise exception 'Значок ставит только оператор.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.companies where id = p_company_id and kind = 'CARRIER') then
    raise exception 'Значок — только перевозчику.' using errcode = '22023';
  end if;

  insert into public.verification_grants (company_id, granted_at, granted_by, note, revoked_at, revoked_by, revoke_note)
  values (p_company_id, now(), auth.uid(), nullif(trim(p_note), ''), null, null, null)
  on conflict (company_id) do update
    set granted_at = excluded.granted_at,
        granted_by = excluded.granted_by,
        note = excluded.note,
        revoked_at = null,
        revoked_by = null,
        revoke_note = null;

  /* Решение оператора принимает все файлы, которые он видел на странице.
     Новый файл после этого продлит значок только после повторного решения. */
  /* Только то, что было загружено до открытия страницы оператором:
     файл, пришедший, пока он читал, ждёт следующего решения. */
  update public.verification_documents
  set reviewed_at = now()
  where company_id = p_company_id and reviewed_at is null
    and created_at <= least(p_seen_at, now());
end;
$$;

revoke all on function public.grant_verification(uuid, timestamptz, text) from public, anon;
grant execute on function public.grant_verification(uuid, timestamptz, text) to authenticated;
