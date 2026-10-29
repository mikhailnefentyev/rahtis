-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · GPS: Webfleet и ABAX (29.10.2026)
--
-- Просьба пользователя: «добавь Webfleet и ABAX тоже».
--
-- Webfleet: вход — аккаунт, пользователь, пароль и API-ключ
-- (WEBFLEET.connect), всё одним секретом в Vault (JSON).
--
-- ABAX: OAuth. Перевозчик нажимает «Подключить ABAX», входит у ABAX и
-- даёт доступ; в Vault ложится refresh token. ABAX выдаёт новый refresh
-- token при каждом обновлении — поэтому gps_connection_set_token.
-- Запасной путь — свои client id и secret перевозчика (client credentials,
-- если ABAX включил их для его организации).
--
-- Секрет теперь до 4000 знаков: JSON и токены OAuth длиннее ключа Wialon.
-- ═══════════════════════════════════════════════════════════════════

alter table public.gps_connections drop constraint gps_connections_provider_check;
alter table public.gps_connections add constraint gps_connections_provider_check
  check (provider in ('WIALON', 'MAPON', 'NAVIREC', 'RUPTELA', 'NAVIXY', 'SAMSARA', 'WEBFLEET', 'ABAX'));

create or replace function public.gps_connection_create(
  p_company_id uuid,
  p_user_id uuid,
  p_provider text,
  p_api_host text,
  p_token text,
  p_label text,
  p_account_name text,
  p_account_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_secret uuid;
begin
  if p_token is null or char_length(p_token) not between 16 and 4000 then
    raise exception 'bad token' using errcode = '22023';
  end if;
  v_secret := vault.create_secret(p_token, 'gps:' || v_id::text, 'RAHTIS GPS ' || p_company_id::text);
  insert into public.gps_connections (id, company_id, provider, api_host, secret_id, label, account_name, account_ref, created_by)
  values (v_id, p_company_id, p_provider, lower(p_api_host), v_secret, nullif(trim(p_label), ''), p_account_name,
          nullif(p_account_ref, ''), p_user_id);
  return v_id;
end;
$$;

/* Новый секрет того же подключения (ABAX меняет refresh token при каждом обновлении). */
create or replace function public.gps_connection_set_token(p_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
begin
  if p_token is null or char_length(p_token) not between 16 and 4000 then
    raise exception 'bad token' using errcode = '22023';
  end if;
  select secret_id into v_secret from public.gps_connections where id = p_id;
  if v_secret is null then
    raise exception 'no connection' using errcode = 'P0002';
  end if;
  perform vault.update_secret(v_secret, p_token);
end;
$$;

revoke all on function public.gps_connection_set_token(uuid, text) from public, anon, authenticated;
grant execute on function public.gps_connection_set_token(uuid, text) to service_role;

-- ─── PRIVACY 2.18: Webfleet и ABAX, учётные данные (черновик) ───

create or replace function pg_temp.draft_of(p_kind public.legal_kind)
returns uuid
language plpgsql
as $$
declare
  v_active uuid := public.active_legal_document(p_kind);
  v_draft uuid;
begin
  select d.id into v_draft
  from public.legal_documents d
  where d.kind = p_kind and d.status = 'DRAFT'
    and d.version > (select version from public.legal_documents where id = v_active)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (p_kind, (select max(version) + 1 from public.legal_documents where kind = p_kind), 'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  return v_draft;
end;
$$;

create or replace function pg_temp.swap(p_doc uuid, p_path integer[], p_locale text, p_from text, p_to text)
returns void
language plpgsql
as $$
begin
  update public.legal_clauses
  set body = replace(body, p_from, p_to)
  where document_id = p_doc and path = p_path and locale = p_locale and position(p_from in body) > 0;
  if not found then
    raise exception 'Пункт % (%): фрагмент не найден: %', array_to_string(p_path, '.'), p_locale, left(p_from, 60);
  end if;
end;
$$;

do $$
declare
  v_doc uuid := pg_temp.draft_of('PRIVACY');
begin
  perform pg_temp.swap(v_doc, array[2, 18], 'fi',
    '(Wialon, Mapon, Navirec, Ruptela TrustTrack, Navixy tai Samsara) antamalla sen käyttöavaimen. Avain säilytetään salattuna,',
    '(Wialon, Mapon, Navirec, Ruptela TrustTrack, Navixy, Samsara, Webfleet tai ABAX) antamalla sen käyttöavaimen tai -tunnukset tai hyväksymällä yhteyden järjestelmän omalla kirjautumissivulla. Avain ja tunnukset säilytetään salattuina,');
  perform pg_temp.swap(v_doc, array[2, 18], 'en',
    '(Wialon, Mapon, Navirec, Ruptela TrustTrack, Navixy or Samsara) to the service by providing its access key. The key is stored encrypted,',
    '(Wialon, Mapon, Navirec, Ruptela TrustTrack, Navixy, Samsara, Webfleet or ABAX) to the service by providing its access key or credentials, or by approving the connection on the system''s own sign-in page. The key and credentials are stored encrypted,');
end;
$$;
