-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · политика: документы сервисной книжки (15.11.2026)
--
-- Под поведение 20261115100000_maintenance_documents. В счёте
-- мастерской или протоколе katsastus могут быть имена (мастер,
-- владелец), поэтому подпункт «Kaluston huolto ja vikailmoitukset»
-- (2.29 в PRIVACY v24) дополняется: какие файлы, кто видит, сколько
-- хранятся. Черновик PRIVACY; активация — решение пользователя.
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
  v_rows integer;
begin
  /* Уже дополнен (повторный прогон) — ничего не делаем. */
  if exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and locale = 'fi' and body like 'Kaluston huolto ja vikailmoitukset:%' and body like '%asiakirj%'
  ) then
    return;
  end if;

  update public.legal_clauses
  set body = replace(replace(body,
      'sekä tehdyt huollot ja korjaukset (päivä, mittarilukema, korjaamo, summa ja lisätiedot); huoltokirjaan tallennetaan myös, kuka merkinnän teki.',
      'sekä tehdyt huollot ja korjaukset (päivä, mittarilukema, korjaamo, summa ja lisätiedot) ja niihin liittyvät asiakirjat, kuten laskut ja kuitit, katsastus- ja tarkastuspöytäkirjat, todistukset, rekisteriotteet ja valokuvat; huoltokirjaan tallennetaan myös, kuka merkinnän tai asiakirjan tallensi. Asiakirjoissa voi olla esimerkiksi korjaamon yhteyshenkilön tai ajoneuvon omistajan nimi. Asiakirjoja näkevät vain kuljetusliike ja palvelun ylläpito.'),
      'Huoltokirja säilytetään niin kauan kuin auto tai perävaunu on kuljetusliikkeen kalustossa palvelussa.',
      'Huoltokirja ja sen asiakirjat säilytetään niin kauan kuin auto tai perävaunu on kuljetusliikkeen kalustossa palvelussa tai kunnes kuljetusliike poistaa ne; kun auto tai perävaunu poistetaan, sen asiakirjatiedostot poistetaan automaattisesti viimeistään kahden vuorokauden kuluessa.')
  where document_id = v_doc and locale = 'fi' and body like 'Kaluston huolto ja vikailmoitukset:%';
  get diagnostics v_rows = row_count;

  update public.legal_clauses
  set body = replace(replace(body,
      'and the services and repairs carried out (date, odometer reading, workshop, amount and notes); the service log also records who made the entry.',
      'and the services and repairs carried out (date, odometer reading, workshop, amount and notes) together with related documents, such as invoices and receipts, roadworthiness test and inspection reports, certificates, registration certificates and photos; the service log also records who made the entry or stored the document. The documents may contain, for example, the name of a workshop contact person or of the vehicle owner. Documents are visible only to the carrier and the service administrators.'),
      'The service log is kept for as long as the vehicle or trailer is in the carrier''s fleet in the service.',
      'The service log and its documents are kept for as long as the vehicle or trailer is in the carrier''s fleet in the service or until the carrier deletes them; when a vehicle or trailer is removed, its document files are deleted automatically within two days at the latest.')
  where document_id = v_doc and locale = 'en' and body like 'Fleet maintenance and defect reports:%';
  get diagnostics v_rows = row_count;

  /* Текст подпункта не тот, что ожидался, — лучше упасть, чем молча оставить политику без документов. */
  if not exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and locale = 'fi' and body like 'Kaluston huolto ja vikailmoitukset:%' and body like '%asiakirjatiedostot%'
  ) or not exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and locale = 'en' and body like 'Fleet maintenance and defect reports:%' and body like '%document files%'
  ) then
    raise exception 'PRIVACY: подпункт об обслуживании парка не найден или изменён.';
  end if;
end;
$$;
