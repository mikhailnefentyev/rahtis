-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · политика: пакет tilaajavastuu (3.11.2026)
--
-- Под поведение 20261103060000_verification: перевозчик хранит у нас
-- справки по tilaajavastuulaki (у toiminimi в них персональные данные
-- предпринимателя), реестровые данные берутся из открытых данных PRH,
-- справки видят заказчики-партнёры и те, кому перевозчик дал ссылку.
--
-- Отдельный новый подпункт в разделе 4 (источники данных) — следующим
-- свободным номером: другая доработка в это же время добавляет пункт об
-- автоматическом чтении OpenAI в другое место, и номера не сталкиваются.
-- Черновик PRIVACY, активация — решение пользователя.
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

do $$
declare
  v_doc uuid := pg_temp.draft_of('PRIVACY');
  v_no integer;
begin
  /* Уже добавлен (повторный прогон) — ничего не делаем. */
  if exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and locale = 'fi' and body like 'Tilaajavastuuselvitykset:%'
  ) then
    return;
  end if;

  select coalesce(max(path[2]), 0) + 1 into v_no
  from public.legal_clauses
  where document_id = v_doc and cardinality(path) = 2 and path[1] = 4;

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (v_doc, 'fi', array[4, v_no], null,
     'Tilaajavastuuselvitykset: kuljetusliike voi tallentaa palveluun tilaajavastuulain mukaiset selvitykset, kuten verovelkatodistuksen, eläkevakuutustodistuksen, selvityksen työterveyshuollosta, vakuutustodistuksen tai Luotettava Kumppani -raportin, sekä niiden päivämäärät. Yrityksen Y-tunnus, nimi sekä merkinnät ennakkoperintä-, arvonlisävero- ja kaupparekisterissä haetaan PRH:n avoimesta datasta, kun kuljetusliike hakee palveluun tai päivittää tiedot. Selvitykset näkevät kuljetusliike, palvelun ylläpito, tilaajat, joille kuljetusliike on sallinut suorat tilaukset, sekä ne, joille kuljetusliike antaa jakolinkin; muut tilaajat näkevät vain, onko yritys tarkastettu. Kuljetusliike voi poistaa selvityksen ja perua jakolinkin milloin tahansa. Toiminimen selvityksissä voi olla elinkeinonharjoittajan henkilötietoja.'),
    (v_doc, 'en', array[4, v_no], null,
     'Contractor''s obligations reports: a carrier may store in the service the reports required by the Finnish Act on the Contractor''s Obligations and Liability (tilaajavastuulaki), such as a tax debt certificate, a pension insurance certificate, a report on occupational health care, an insurance certificate or a Reliable Partner (Luotettava Kumppani) report, together with their dates. The company''s business ID, name and its entries in the prepayment, VAT and trade registers are retrieved from the open data of the Finnish Patent and Registration Office (PRH) when the carrier applies to the service or refreshes the data. The reports are visible to the carrier, the service administrators, shippers whom the carrier has allowed to send direct orders, and anyone the carrier gives a share link to; other shippers only see whether the company has been verified. The carrier may delete a report and revoke a share link at any time. The reports of a sole trader may contain the trader''s personal data.');
end;
$$;
