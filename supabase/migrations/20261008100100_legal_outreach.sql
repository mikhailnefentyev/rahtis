-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: приглашения от платформы
--
-- Под поведение 20261008100000: Aivomaa Oy сама приглашает компании на
-- их общий адрес с сайта. PRIVACY 2.11 — новый черновик (v18), 8.4 —
-- срок хранения. Активация — решение пользователя.
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
  perform pg_temp.swap(v_doc, array[2, 11], 'fi',
    'Kutsuviestin lähettäminen perustuu',
    'Aivomaa Oy voi myös itse lähettää yhden kutsun yrityksen verkkosivuillaan julkaisemaan yleiseen sähköpostiosoitteeseen; tällöin tallennetaan yrityksen nimi, Y-tunnus, osoite, verkkosivu ja lähetysaika. Jos vastaanottaja kieltää viestit vastaamalla, osoite merkitään kielletyksi, eikä sinne lähetetä enää viestejä. Kutsuviestin lähettäminen perustuu');
  perform pg_temp.swap(v_doc, array[2, 11], 'en',
    'Sending the invitation message is based on',
    'Aivomaa Oy may also itself send one invitation to the general email address a company publishes on its website; the company''s name, business ID, address, website and the time of sending are then stored. If the recipient refuses messages by replying, the address is marked as refused and no further messages are sent to it. Sending the invitation message is based on');

  perform pg_temp.swap(v_doc, array[8, 4], 'fi',
    'kohdan 2.11 kutsut säilytetään 12 kuukautta.',
    'kohdan 2.11 kutsut säilytetään 12 kuukautta; kielletyksi merkitty osoite säilytetään niin kauan kuin kielto on voimassa.');
  perform pg_temp.swap(v_doc, array[8, 4], 'en',
    'the invitations of section 2.11 are retained for 12 months.',
    'the invitations of section 2.11 are retained for 12 months; an address marked as refused is retained for as long as the refusal applies.');
end;
$$;
