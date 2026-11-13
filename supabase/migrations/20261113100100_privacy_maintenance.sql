-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · политика: обслуживание парка и дефекты (13.11.2026)
--
-- Под поведение 20261113100000_maintenance. Новое для персональных
-- данных — дефект от водителя: кто сообщил, когда, описание, пробег и
-- фото. Сервисная книжка — сведения о машине, а не о человеке; в ней
-- остаётся только, кто из кабинета внёс запись. Срок хранения — в том
-- же подпункте: закрытые дефекты с фото — 24 месяца после закрытия
-- (удаляет /api/retention/photos), сервисная книжка — пока машина в
-- парке. Отдельный подпункт в конце раздела 2. Черновик PRIVACY,
-- активация — решение пользователя.
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
  v_doc uuid := pg_temp.draft_of('PRIVACY');
  v_no integer;
begin
  /* Уже добавлен (повторный прогон) — ничего не делаем. */
  if exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and locale = 'fi' and body like 'Kaluston huolto ja vikailmoitukset:%'
  ) then
    return;
  end if;

  select coalesce(max(path[2]), 0) + 1 into v_no
  from public.legal_clauses
  where document_id = v_doc and cardinality(path) = 2 and path[1] = 2;

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (v_doc, 'fi', array[2, v_no], null,
     'Kaluston huolto ja vikailmoitukset: kuljetusliike voi tallentaa autojensa ja perävaunujensa huolto-ohjelman, määräajat (esimerkiksi huolto, katsastus ja ajopiirturin tarkastus) sekä tehdyt huollot ja korjaukset (päivä, mittarilukema, korjaamo, summa ja lisätiedot); huoltokirjaan tallennetaan myös, kuka merkinnän teki. Kuljettaja voi ilmoittaa sovelluksessa autossa tai perävaunussa havaitsemansa vian, jolloin tallennetaan ilmoittaja, aika, auto tai perävaunu, vian kohde, voiko autolla ajaa, kuvaus ja hänen halutessaan mittarilukema ja valokuva. Ilmoituksen sijaintia ei tallenneta. Tietoja käytetään kaluston kunnossapitoon ja liikenneturvallisuuteen: kuljetusliike saa ilmoituksen viasta ja muistutuksia lähestyvistä määräajoista, ja auton kuljettaja saa muistutuksen oman autonsa määräajoista. Vikailmoituksia näkevät ilmoittanut kuljettaja, saman auton kuljettajat (avoimet viat), kuljetusliike ja palvelun ylläpito; tilaajat eivät näe niitä. Korjatut tai suljetut vikailmoitukset kuvineen poistetaan automaattisesti 24 kuukauden kuluttua sulkemisesta. Huoltokirja säilytetään niin kauan kuin auto tai perävaunu on kuljetusliikkeen kalustossa palvelussa.'),
    (v_doc, 'en', array[2, v_no], null,
     'Fleet maintenance and defect reports: a carrier may store the maintenance programme of its vehicles and trailers, due dates (for example service, periodic roadworthiness test and tachograph inspection) and the services and repairs carried out (date, odometer reading, workshop, amount and notes); the service log also records who made the entry. A driver may report in the app a defect found in a vehicle or trailer, in which case the reporter, the time, the vehicle or trailer, the part concerned, whether the vehicle may be driven, a description and, if the driver chooses, the odometer reading and a photo are stored. The location of the report is not stored. The data is used for keeping the fleet in good repair and for road safety: the carrier is notified of the defect and reminded of approaching due dates, and the driver of a vehicle is reminded of the due dates of their own vehicle. Defect reports are visible to the reporting driver, the drivers of the same vehicle (open defects), the carrier and the service administrators; shippers do not see them. Repaired or closed defect reports and their photos are deleted automatically 24 months after they were closed. The service log is kept for as long as the vehicle or trailer is in the carrier''s fleet in the service.');
end;
$$;
