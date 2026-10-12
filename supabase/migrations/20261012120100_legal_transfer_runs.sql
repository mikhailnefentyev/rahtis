-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: перегон закрывается фото при сдаче
--
-- Под поведение 20261012120000. Три документа говорят, что рейс не
-- закрыть без накладной; у перегона (забрать единицу и оставить в другом
-- месте, без погрузки и выгрузки) накладной обычно нет, и он закрывается
-- фото при сдаче. Новые черновики (действующие редакции не меняются,
-- активация — решение пользователя):
--
--   TERMS             8.2, 6.9
--   CARRIER_AGREEMENT 11.1
--   SHIPPER_AGREEMENT 8.1
-- ═══════════════════════════════════════════════════════════════════

create or replace function pg_temp.draft_of(p_kind public.legal_kind)
returns uuid
language plpgsql
as $$
declare
  v_active uuid := public.active_legal_document(p_kind);
  v_draft uuid;
begin
  if v_active is null then
    raise exception 'Нет действующей редакции %.', p_kind using errcode = '55007';
  end if;

  select d.id into v_draft
  from public.legal_documents d
  where d.kind = p_kind and d.status = 'DRAFT'
    and d.version > (select version from public.legal_documents where id = v_active)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (p_kind, (select max(version) + 1 from public.legal_documents where kind = p_kind),
            'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  return v_draft;
end;
$$;

/* Дописать предложение к пункту; пункта нет — ошибка, повтор — без изменений. */
create or replace function pg_temp.append(p_doc uuid, p_path integer[], p_locale text, p_mark text, p_text text)
returns void
language plpgsql
as $$
begin
  update public.legal_clauses
  set body = body || ' ' || p_text
  where document_id = p_doc and path = p_path and locale = p_locale and position(p_mark in body) = 0;

  if not found and not exists (
    select 1 from public.legal_clauses
    where document_id = p_doc and path = p_path and locale = p_locale
  ) then
    raise exception 'Пункт % (%) не найден.', array_to_string(p_path, '.'), p_locale;
  end if;
end;
$$;

do $$
declare
  v_terms uuid := pg_temp.draft_of('TERMS');
  v_carrier uuid := pg_temp.draft_of('CARRIER_AGREEMENT');
  v_shipper uuid := pg_temp.draft_of('SHIPPER_AGREEMENT');
  v_fi text := 'Siirtoajo — kuljetettavan yksikön nouto ja jättäminen toiseen paikkaan ilman lastausta tai purkua — päätetään rahtikirjan sijasta luovutuskuvalla, joka otetaan yksiköstä paikassa, johon se jätetään.';
  v_en text := 'A transfer run — picking up the transported unit and leaving it at another place without loading or unloading — is closed, instead of a waybill, with a handover photo taken of the unit at the place where it is left.';
begin
  perform pg_temp.append(v_terms, array[8, 2], 'fi', 'Siirtoajo', v_fi);
  perform pg_temp.append(v_terms, array[8, 2], 'en', 'transfer run', v_en);
  perform pg_temp.append(v_terms, array[6, 9], 'fi', 'siirtoajossa',
    'Rahtikirjan lataamisen osuudessa siirtoajossa otetaan huomioon luovutuskuva.');
  perform pg_temp.append(v_terms, array[6, 9], 'en', 'transfer run',
    'For a transfer run, the handover photo counts towards the share of uploaded waybills.');

  perform pg_temp.append(v_carrier, array[11, 1], 'fi', 'Siirtoajo', v_fi);
  perform pg_temp.append(v_carrier, array[11, 1], 'en', 'transfer run', v_en);

  perform pg_temp.append(v_shipper, array[8, 1], 'fi', 'Siirtoajo', v_fi);
  perform pg_temp.append(v_shipper, array[8, 1], 'en', 'transfer run', v_en);
end;
$$;
