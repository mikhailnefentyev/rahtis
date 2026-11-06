-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: сведения об оплате заказчика для перевозчика (6.11.2026)
--
-- Под поведение 20261106140000_shipper_trust. Новые пункты в конце
-- разделов (номер — следующий свободный):
--   TERMS — раздел 8: договор напрямую с перевозчиком описан там же,
--     пункт — после условия о полисе экспедитора;
--   SHIPPER_AGREEMENT — раздел 2: заказчик согласен, что сведения
--     показываются перевозчикам, и может оспорить отметку;
--   CARRIER_AGREEMENT — раздел 2: отметки об оплате — правдиво;
--   PRIVACY — раздел 2: заказчик-toiminimi — это персональные данные.
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
  perform pg_temp.append(pg_temp.draft_of('TERMS'), 8, 'Tilaajan maksutiedot:',
    'Tilaajan maksutiedot: kun toimeksianto tehdään suoraan tilaajan ja kuljetusliikkeen välisenä sopimuksena, kuljetusliike laskuttaa tilaajaa itse, eikä Aivomaa Oy takaa rahdin maksamista. Tällaisen toimeksiannon yhteydessä palvelu näyttää kuljetusliikkeelle tilaajasta seuraavat tiedot: yrityksen ikä kaupparekisterin tai muun yritysrekisterin mukaan tai, jos sitä ei ole saatavilla, palvelun käyttöönoton ajankohta; julkisista rekistereistä ilmenevä tila, kuten konkurssi, yrityssaneeraus tai selvitystila sekä merkinnät ennakkoperintä- ja arvonlisäverorekistereihin; tilaajan maksukäyttäytyminen niissä kuljetuksissa, joista Aivomaa Oy on laskuttanut tilaajaa; kuljetusliikkeiden suorista kuljetuksista tekemien maksuilmoitusten yhteenveto sekä tilaajan toteutuneiden kuljetusten määrä. Kuljetusliikkeiden ilmoitukset näytetään vain yhteenvetona ilman ilmoittajaa tai yksittäistä kuljetusta koskevia tietoja. Tiedot annetaan ainoastaan tiedoksi, eivätkä ne ole luottoluokitus, arvio maksukyvystä eikä takuu. Kuljetusliikkeiden ilmoitukset ovat niiden omia ilmoituksia, joiden oikeellisuutta Aivomaa Oy ei tarkasta etukäteen. Aivomaa Oy voi poistaa ilmoituksen, joka osoitetaan virheelliseksi. Kumpikin osapuoli päättää itse sopimuksen tekemisestä ja maksuehdoista.',
    'Customer''s payment information: when an assignment is made as a contract directly between a customer and a carrier, the carrier invoices the customer itself, and Aivomaa Oy does not guarantee the payment of the freight. In connection with such an assignment the service shows the carrier the following information about the customer: the age of the company according to the trade register or another company register or, where that is not available, the date on which the customer started using the service; its status as shown in public registers, such as bankruptcy, restructuring or liquidation and entries in the prepayment and VAT registers; the customer''s payment record for transports invoiced to it by Aivomaa Oy; a summary of the payment reports made by carriers on direct transports; and the number of transports completed by the customer. Reports by carriers are shown only as a summary, without information on the reporting carrier or on individual transports. The information is provided for information only and is not a credit rating, an assessment of solvency or a guarantee. Reports by carriers are the carriers'' own statements, the accuracy of which Aivomaa Oy does not check in advance. Aivomaa Oy may remove a report that is shown to be incorrect. Each party decides for itself whether to enter into a contract and on the terms of payment.');

  perform pg_temp.append(pg_temp.draft_of('SHIPPER_AGREEMENT'), 2, 'Maksutietojen näyttäminen:',
    'Maksutietojen näyttäminen: tilaaja hyväksyy, että kun se tekee toimeksiannon suoraan kuljetusliikkeen kanssa, palvelu näyttää kuljetusliikkeille käyttöehtojen mukaiset tiedot tilaajan iästä, rekisteritilasta, maksukäyttäytymisestä Aivomaa Oy:n laskuttamissa kuljetuksissa, kuljetusliikkeiden maksuilmoitusten yhteenvedon sekä toteutuneiden kuljetusten määrän. Tilaaja näkee samat tiedot itsestään palvelussa. Tilaaja voi riitauttaa kuljetusliikkeen ilmoituksen palvelun asiakastuen kautta esittämällä selvityksen maksusta; Aivomaa Oy poistaa ilmoituksen, jos se osoittautuu virheelliseksi. Ilmoituksen tehneen kuljetusliikkeen tietoja ei luovuteta tilaajalle.',
    'Display of payment information: the customer accepts that, when it makes an assignment directly with a carrier, the service shows carriers the information provided for in the terms of use on the customer''s age, register status, payment record for transports invoiced by Aivomaa Oy, a summary of the payment reports made by carriers and the number of completed transports. The customer sees the same information about itself in the service. The customer may dispute a report made by a carrier through the customer support of the service by providing an account of the payment; Aivomaa Oy removes the report if it proves to be incorrect. The details of the reporting carrier are not disclosed to the customer.');

  perform pg_temp.append(pg_temp.draft_of('CARRIER_AGREEMENT'), 2, 'Maksuilmoitukset:',
    'Maksuilmoitukset: kuljetusliike voi ilmoittaa suoraan tilaajan kanssa sovitun ja toteutuneen kuljetuksen maksusta (maksettu ajallaan, maksettu myöhässä tai maksamatta) 180 päivän kuluessa kuljetuksen päättymisestä. Kuljetusliike vastaa siitä, että ilmoitus on totuudenmukainen ja perustuu sen omaan kirjanpitoon, ja korjaa ilmoituksen, jos tilanne muuttuu. Ilmoitukset näytetään muille kuljetusliikkeille ja tilaajalle vain yhteenvetona ilman ilmoittajan tietoja. Aivomaa Oy voi poistaa virheelliseksi osoitetun ilmoituksen, ja perättömät tai harhaanjohtavat ilmoitukset voivat johtaa ilmoitusten poistamiseen ja palvelun käytön rajoittamiseen. Tilaajasta näytettävät maksutiedot annetaan ainoastaan tiedoksi, eivätkä ne ole takuu rahdin maksamisesta.',
    'Payment reports: the carrier may report on the payment of a completed transport agreed directly with a customer (paid on time, paid late or unpaid) within 180 days of the end of the transport. The carrier is responsible for ensuring that the report is truthful and based on its own accounts, and corrects the report if the situation changes. Reports are shown to other carriers and to the customer only as a summary, without information on the reporting carrier. Aivomaa Oy may remove a report that is shown to be incorrect, and false or misleading reports may lead to the removal of reports and to restriction of the use of the service. The payment information shown about a customer is provided for information only and is not a guarantee of payment of the freight.');
end;
$$;

/* PRIVACY: отдельный подпункт в конце раздела 2 (как privacy_forwarder_insurance). */
do $$
declare
  v_doc uuid := pg_temp.draft_of('PRIVACY');
  v_no integer;
begin
  if exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and locale = 'fi' and body like 'Tilaajan maksutiedot:%'
  ) then
    return;
  end if;

  select coalesce(max(path[2]), 0) + 1 into v_no
  from public.legal_clauses
  where document_id = v_doc and cardinality(path) = 2 and path[1] = 2;

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (v_doc, 'fi', array[2, v_no], null,
     'Tilaajan maksutiedot: kun tilaaja tekee toimeksiannon suoraan kuljetusliikkeen kanssa, näytämme kuljetusliikkeille yhteenvedon tilaajan iästä, julkisten rekisterien mukaisesta tilasta, maksukäyttäytymisestä Aivomaa Oy:n laskuttamissa kuljetuksissa, kuljetusliikkeiden maksuilmoituksista ja toteutuneiden kuljetusten määrästä. Päivitämme rekisteritiedot säännöllisesti julkisista yritysrekistereistä, kuten Patentti- ja rekisterihallituksen avoimesta datasta ja EU:n VIES-palvelusta. Tiedot koskevat yritystä. Jos tilaaja on yksityinen elinkeinonharjoittaja (toiminimi), tiedot ovat häntä koskevia henkilötietoja; käsittelyn peruste on oikeutettu etu antaa kuljetusliikkeille tietoa sopimuskumppanin maksukäyttäytymisestä, koska Aivomaa Oy ei takaa rahdin maksamista suorissa sopimuksissa. Kuljetusliikkeiden ilmoitukset tallennetaan ilmoittajan tiedoin, mutta tilaaja ja muut kuljetusliikkeet näkevät vain yhteenvedon. Yhteenvedossa käytetään enintään 12 viimeisen kuukauden tietoja. Ilmoitukset säilytetään asiakkuuden ajan ja sen jälkeen niin kauan kuin niitä tarvitaan mahdollisen riidan selvittämiseen. Tilaaja voi vastustaa käsittelyä ja pyytää virheellisen ilmoituksen korjaamista tai poistamista asiakastuen kautta.'),
    (v_doc, 'en', array[2, v_no], null,
     'Customer''s payment information: when a customer makes an assignment directly with a carrier, we show carriers a summary of the customer''s age, its status in public registers, its payment record for transports invoiced by Aivomaa Oy, the payment reports made by carriers and the number of completed transports. We update the register information regularly from public company registers, such as the open data of the Finnish Patent and Registration Office and the EU VIES service. The information concerns the company. If the customer is a sole trader (toiminimi), the information is personal data relating to that person; the legal basis for the processing is the legitimate interest of informing carriers of the payment behaviour of their contracting party, since Aivomaa Oy does not guarantee payment of the freight under direct contracts. Reports by carriers are stored together with the details of the reporting carrier, but the customer and other carriers only see a summary. The summary uses information from at most the last 12 months. Reports are kept for the duration of the customer relationship and thereafter for as long as they are needed to settle any dispute. The customer may object to the processing and request the correction or removal of an incorrect report through customer support.');
end;
$$;
