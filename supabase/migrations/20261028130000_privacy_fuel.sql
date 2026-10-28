-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · политика: топливо (28.10.2026)
--
-- Под поведение 20261028120000_fuel: заправки водителя в приложении
-- (одометр, количество, сумма, фото чека), ручной ввод и месячный отчёт
-- топливной карты, который читает OpenAI через n8n. PRIVACY — тот же
-- черновик, что у работы на объекте: 2.17 (что хранится, кто видит,
-- OpenAI и передача за ЕЭЗ по 6.4), 8.4 (24 месяца). Места заправки не
-- пишем. Активация — решение пользователя.
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
  delete from public.legal_clauses where document_id = v_doc and path = array[2, 17];

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (v_doc, 'fi', array[2, 17], null,
     'Polttoaine: kuljettaja voi kirjata sovelluksessa tankkauksen, jolloin tallennetaan auto, aika, mittarilukema, polttoaine ja määrä sekä hänen halutessaan summa, asema ja kuva kuitista. Kuljetusliike voi kirjata tankkauksia itse ja ladata polttoainekortin kuukausiraportin, josta tallennetaan tankkausten aika, auto tai kortin numero, asema, polttoaine, määrä, summa ja mittarilukema. Raportin rivit luetaan automaattisesti OpenAI:n kielimallilla n8n-palvelun kautta, ja kuljetusliike tarkistaa ne ennen tallennusta; OpenAI voi käsitellä tietoja ETA-alueen ulkopuolella, ja siirtoon sovelletaan kohtaa 6.4. Tiedoista lasketaan autojen polttoaineen kulutus ja kustannukset kuljetusliikkeen omaan käyttöön. Tankkauksia ja kuitteja näkevät kuljettaja (omat tankkauksensa), hänen kuljetusliikkeensä ja palvelun ylläpito; tilaajat eivät näe niitä. Tankkauksen sijaintia ei tallenneta.'),
    (v_doc, 'en', array[2, 17], null,
     'Fuel: a driver may record a refuelling in the app, in which case the vehicle, time, odometer reading, fuel and quantity are stored and, if the driver chooses, the amount, the station and a photo of the receipt. A carrier may record refuelling itself and upload the monthly report of its fuel card, from which the time of each refuelling, the vehicle or card number, the station, the fuel, the quantity, the amount and the odometer reading are stored. The lines of the report are read automatically with OpenAI''s language model through the n8n service, and the carrier checks them before they are saved; OpenAI may process data outside the EEA, and clause 6.4 applies to the transfer. From this data the fuel consumption and costs of the vehicles are calculated for the carrier''s own use. Refuelling records and receipts are visible to the driver (their own refuelling), their carrier and the service administrators; shippers do not see them. The location of a refuelling is not stored.');

  perform pg_temp.swap(v_doc, array[8, 4], 'fi',
    'Määräajan umpeuduttua tiedot poistetaan automaattisesti;',
    'Kohdan 2.17 tankkaukset, kuitit ja polttoaineraportit säilytetään 24 kuukautta tankkauksesta tai raportin lataamisesta. Määräajan umpeuduttua tiedot poistetaan automaattisesti;');
  perform pg_temp.swap(v_doc, array[8, 4], 'en',
    'When the period ends, the data is deleted automatically;',
    'The refuelling records, receipts and fuel reports of clause 2.17 are retained for 24 months from the refuelling or the upload of the report. When the period ends, the data is deleted automatically;');
end;
$$;
