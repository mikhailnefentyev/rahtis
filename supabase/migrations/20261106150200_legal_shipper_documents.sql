-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: выписка, налоговые справки и право подписи
-- заказчика (6.11.2026)
--
-- Под поведение 20261106150100_shipper_documents. Новые пункты в конце
-- разделов (номер — следующий свободный):
--   TERMS — раздел 8: после пункта о сведениях об оплате заказчика;
--   PRIVACY — раздел 2: в документах о праве подписи и выписках есть
--     имена и личные коды представителей.
-- Черновики, активация — решение пользователя.
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

/* Пункт в конец раздела: следующий свободный номер; повторный прогон не плодит дублей. */
create or replace function pg_temp.append(p_doc uuid, p_section integer, p_marker text, p_fi text, p_en text)
returns void
language plpgsql
as $$
declare
  v_no integer;
begin
  if exists (
    select 1 from public.legal_clauses
    where document_id = p_doc and locale = 'fi' and path[1] = p_section and position(p_marker in body) = 1
  ) then
    return;
  end if;

  select coalesce(max(path[2]), 0) + 1 into v_no
  from public.legal_clauses
  where document_id = p_doc and path[1] = p_section and array_length(path, 1) = 2;

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (p_doc, 'fi', array[p_section, v_no], null, p_fi),
    (p_doc, 'en', array[p_section, v_no], null, p_en);
end;
$$;

do $$
begin
  perform pg_temp.append(pg_temp.draft_of('TERMS'), 8, 'Tilaajan yritysasiakirjat:',
    'Tilaajan yritysasiakirjat: tilaaja voi vapaaehtoisesti toimittaa palveluun otteen kaupparekisteristä tai muusta yritysrekisteristä, todistuksen verovelattomuudesta, todistuksen arvonlisäverorekisteröinnistä sekä asiakirjan, josta ilmenee asiakirjat toimittaneen henkilön oikeus edustaa tilaajaa, kuten valtakirjan. Asiakirjojen toimittaminen ei ole palvelun käytön edellytys. Aivomaa Oy tarkastaa toimitetut asiakirjat ja voi hyväksyä tai hylätä ne. Kun toimeksianto tehdään suoraan tilaajan ja kuljetusliikkeen välisenä sopimuksena, kuljetusliike näkee tilaajan maksutietojen yhteydessä ainoastaan sen, onko asiakirja tarkastettu, asiakirjan antamispäivän ja päivän, johon asti tarkastusmerkintä on voimassa; asiakirjoja tai niiden sisältöä ei luovuteta kuljetusliikkeelle. Tarkastusmerkintä kuvaa asiakirjan sisältöä sen antamispäivänä. Se ei ole Aivomaa Oy:n vakuutus tilaajan taloudellisesta tilanteesta, maksukyvystä tai edustajan toimivallasta eikä takuu rahdin maksamisesta. Tilaaja vastaa siitä, että sen toimittamat asiakirjat ovat aitoja ja ajantasaisia.',
    'Customer''s company documents: the customer may voluntarily provide the service with an extract from the trade register or another company register, a certificate of the absence of tax debts, a certificate of VAT registration and a document showing the right of the person who provided the documents to represent the customer, such as a power of attorney. Providing the documents is not a condition for using the service. Aivomaa Oy checks the documents provided and may approve or reject them. When an assignment is made as a contract directly between a customer and a carrier, the carrier only sees, together with the customer''s payment information, whether a document has been checked, the date of issue of the document and the date until which the check mark is valid; the documents or their contents are not disclosed to the carrier. A check mark reflects the content of the document on its date of issue. It is not a representation by Aivomaa Oy as to the customer''s financial position, solvency or the authority of its representative, nor a guarantee of payment of the freight. The customer is responsible for ensuring that the documents it provides are genuine and up to date.');

  perform pg_temp.append(pg_temp.draft_of('PRIVACY'), 2, 'Tilaajan yritysasiakirjat:',
    'Tilaajan yritysasiakirjat: tilaaja voi tallentaa palveluun kaupparekisteriotteen tai muun yritysrekisterin otteen, verovelattomuustodistuksen, arvonlisäverorekisteröintiä koskevan todistuksen sekä edustamisoikeutta osoittavan asiakirjan, kuten valtakirjan. Otteet ja edustamisoikeutta osoittavat asiakirjat voivat sisältää yrityksen edustajien, kuten hallituksen jäsenten, toimitusjohtajan, prokuristien ja valtuutettujen, nimiä, syntymäaikoja ja henkilötunnuksia tai muita henkilöiden tunnisteita. Käsittelemme näitä tietoja tarkastaaksemme asiakirjan ja sen, että asiakirjat toimittanut käyttäjä on oikeutettu toimimaan yrityksen puolesta; käsittelyn peruste on oikeutettu etu varmistua sopimuskumppanin edustajan toimivallasta. Asiakirjat näkevät vain tilaajan omat käyttäjät ja palvelun ylläpito. Kuljetusliikkeet näkevät ainoastaan tiedon siitä, onko asiakirja tarkastettu ja milloin se on annettu, eivät asiakirjaa eivätkä siinä olevia henkilötietoja. Palveluun ei pidä tallentaa henkilökortteja, passeja tai muita henkilöllisyystodistuksia; edustamisoikeuden osoittamiseen riittää valtakirja tai ote, josta nimenkirjoitusoikeus ilmenee. Jos tällainen asiakirja tallennetaan, voimme poistaa sen. Asiakirjat säilytetään yrityksen asiakkuuden ajan ja sen jälkeen niin kauan kuin niitä tarvitaan niiden perusteella tehtyjen tarkastusten osoittamiseen.',
    'Customer''s company documents: a customer may store in the service an extract from the trade register or another company register, a certificate of the absence of tax debts, a certificate of VAT registration and a document showing the right of representation, such as a power of attorney. Extracts and documents showing the right of representation may contain the names, dates of birth and personal identity codes or other personal identifiers of the company''s representatives, such as members of the board, the managing director, holders of procuration and authorised persons. We process this information in order to check the document and that the user who provided the documents is entitled to act on behalf of the company; the legal basis for the processing is the legitimate interest of verifying the authority of the representative of a contracting party. The documents are visible only to the customer''s own users and to the administrators of the service. Carriers only see whether a document has been checked and when it was issued, not the document or the personal data in it. Identity cards, passports or other identity documents must not be stored in the service; a power of attorney or an extract showing the right to sign on behalf of the company is sufficient to show the right of representation. If such a document is stored, we may delete it. The documents are kept for the duration of the company''s customer relationship and thereafter for as long as they are needed to demonstrate the checks made on their basis.');
end;
$$;
