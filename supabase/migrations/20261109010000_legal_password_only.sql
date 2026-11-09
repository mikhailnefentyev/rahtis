-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: вход только по паролю (9.11.2026)
--
-- Под 20261109000000_password_only. PRIVACY, черновик, раздел 10
-- («Kirjautumisen suojaus»): убраны предложения о двухэтапном входе и
-- кодах приложения. Запись устройств входа и письмо о новом устройстве
-- остаются. Если черновика нет — он создаётся копией действующей версии
-- (как в 20261106190100_legal_two_step). Активация — решение пользователя.
-- ═══════════════════════════════════════════════════════════════════

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
    and d.version > coalesce((select version from public.legal_documents where id = v_active), 0)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (p_kind, (select coalesce(max(version), 0) + 1 from public.legal_documents where kind = p_kind), 'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  return v_draft;
end;
$$;

do $$
declare
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
  v_fi integer;
  v_en integer;
begin
  update public.legal_clauses
  set body = replace(body,
    'Kirjautumisen suojaus: käyttäjä voi ottaa käyttöön kaksivaiheisen kirjautumisen, jolloin salasanan lisäksi kysytään puhelimen todennussovelluksen kertakäyttöinen koodi. Palvelun ylläpitäjille se on pakollinen. Sovelluksen avain säilytetään kirjautumispalvelussa (Supabase), eikä Aivomaa Oy näe koodeja. ',
    'Kirjautumisen suojaus: palveluun kirjaudutaan sähköpostiosoitteella ja salasanalla. ')
  where document_id = v_privacy and locale = 'fi' and position('Kirjautumisen suojaus:' in body) = 1;
  get diagnostics v_fi = row_count;

  update public.legal_clauses
  set body = replace(body,
    'Sign-in protection: a user may turn on two-step sign-in, in which case a one-time code from an authenticator app on the phone is asked in addition to the password. It is mandatory for the administrators of the service. The app key is stored by the sign-in service (Supabase), and Aivomaa Oy does not see the codes. ',
    'Sign-in protection: users sign in to the service with their email address and password. ')
  where document_id = v_privacy and locale = 'en' and position('Sign-in protection:' in body) = 1;
  get diagnostics v_en = row_count;

  raise notice 'Черновик PRIVACY v%: пункт о входе fi %, en %',
    (select version from public.legal_documents where id = v_privacy), v_fi, v_en;
end;
$$;
