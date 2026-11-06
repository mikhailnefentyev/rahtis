-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: напоминания об оплате, смена реквизитов, правила
--
-- Под поведение 20261106170000_trust_quick_wins:
--   TERMS — раздел 6: правки заказа (адреса, машина, водитель, цена) с
--     автором и временем, видны обеим сторонам и водителю. Раздел 13:
--     ограничение ответственности Aivomaa (прямой ущерб, не больше
--     уплаченного за 12 месяцев, без платы — до 1 000 €; кроме умысла и
--     грубой небрежности).
--   SHIPPER_AGREEMENT, CARRIER_AGREEMENT — раздел 2: правки заказа.
--   TERMS — раздел 8: напоминания об оплате от имени перевозчика (Aivomaa
--     не кредитор), пунктуальность оплаты счетов для перевозчиков в
--     сводке; смена счёта и контактов — уведомления и отметка у
--     контрагента. Раздел 1: страница правил площадки и уведомление об
--     изменениях за 30 дней.
--   SHIPPER_AGREEMENT — раздел 2: напоминания и пунктуальность заказчика.
--   PRIVACY — раздел 2: почта для напоминаний, уведомления о смене.
-- Новые пункты — в конец разделов (pg_temp.append, повторяемо).
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


-- ── TERMS ──────────────────────────────────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('TERMS');
begin
  perform pg_temp.append(v_doc, 8, 'Maksumuistutukset:',
    'Maksumuistutukset: kuljetusliike voi merkitä palvelussa lähettäneensä tilaajalle laskun suoraan sovitusta kuljetuksesta (laskun numero, summa, laskun päivä, eräpäivä ja tilaajan laskutusosoite). Jos laskua ei ole merkitty maksetuksi, palvelu lähettää tilaajalle maksumuistutuksen eräpäivää seuraavana päivänä ja seitsemän päivää eräpäivän jälkeen. Muistutukset lähetetään kuljetusliikkeen puolesta ja nimissä; saatava on kuljetusliikkeen, maksu suoritetaan suoraan kuljetusliikkeelle, eikä Aivomaa Oy ole velkoja, perijä eikä maksun välittäjä. Tilaaja voi merkitä laskun maksetuksi palvelussa, ja kuljetusliike voi vahvistaa tai poistaa merkinnän. Sama koskee kuljetusliikkeen palvelussa laatimia työmaalaskuja. Jos lasku on maksamatta 14 päivää eräpäivän jälkeen, palvelu ehdottaa kuljetusliikkeelle perintää ja esitäyttää kuljetuksen maksuilmoituksen tilaan maksamatta; kuljetusliike voi muuttaa ilmoitusta. Muistutukset ovat maksuttomia.',
    'Payment reminders: the carrier may record in the service that it has sent the shipper an invoice for a transport agreed directly (invoice number, amount, invoice date, due date and the shipper''s invoicing address). If the invoice has not been marked as paid, the service sends the shipper a payment reminder on the day after the due date and seven days after the due date. Reminders are sent on behalf and in the name of the carrier; the claim belongs to the carrier, payment is made directly to the carrier, and Aivomaa Oy is not the creditor, a collector or a payment intermediary. The shipper may mark the invoice as paid in the service, and the carrier may confirm or remove that mark. The same applies to worksite invoices the carrier prepares in the service. If an invoice remains unpaid 14 days after the due date, the service suggests collection to the carrier and pre-fills the payment report for the transport as unpaid; the carrier may change the report. Reminders are free of charge.');

  perform pg_temp.append(v_doc, 8, 'Laskujen maksutäsmällisyys:',
    'Laskujen maksutäsmällisyys: palvelu näyttää kuljetusliikkeille tilaajan maksutietojen osana yhteenvedon kuljetusliikkeiden palvelussa merkitsemistä laskuista viimeisten 12 kuukauden ajalta: laskujen määrän, ajallaan maksettujen osuuden, myöhässä maksettujen keskimääräisen viiveen päivinä ja tällä hetkellä erääntyneiden laskujen määrän. Yksittäisiä laskuja, summia tai laskuttajia ei näytetä. Tilaaja näkee saman yhteenvedon itsestään. Yhteenveto perustuu osapuolten merkintöihin, eikä se ole luottoluokitus.',
    'Invoice payment punctuality: as part of the shipper''s payment information, the service shows carriers a summary of the invoices recorded by carriers in the service over the last 12 months: the number of invoices, the share paid on time, the average delay in days of those paid late and the number of invoices currently overdue. Individual invoices, amounts or invoicing parties are not shown. The shipper sees the same summary about itself. The summary is based on the parties'' own records and is not a credit rating.');

  perform pg_temp.append(v_doc, 8, 'Tili- ja yhteystietojen muutokset:',
    'Tili- ja yhteystietojen muutokset: kun yrityksen tilinumero, yhteys- tai laskutussähköposti tai pääkäyttäjä muuttuu, palvelu tallentaa muutoksen (peitettyinä arvoina, muuttaja ja ajankohta), ilmoittaa siitä palvelussa ja lähettää sähköpostin yrityksen muille käyttäjille sekä aiempaan osoitteeseen. Yrityksen sopimuskumppani näkee 30 päivän ajan merkinnän tilitietojen muuttumisesta ja siitä kuluneista päivistä, mutta ei tietoja itse. Työmaalaskuja ei lähetetä automaattisesti 48 tuntiin tilinumeron muuttumisen jälkeen.',
    'Changes to account and contact details: when a company''s bank account number, contact or invoicing email address or main user changes, the service records the change (as masked values, who made it and when), notifies the company in the service and sends an email to the company''s other users and to the previous address. For 30 days the company''s contracting parties see a note that the account details have changed and how many days ago, but not the details themselves. Worksite invoices are not sent automatically within 48 hours of a change of the account number.');

  perform pg_temp.append(v_doc, 6, 'Toimeksiannon muutokset:',
    'Toimeksiannon muutokset: tilaaja ja toimeksiannon saanut kuljetusliike voivat muuttaa palvelussa toimeksiannon pysähdyspaikkoja (osoitteet, uudet ja poistetut kohteet) kuljetuksen kaikissa vaiheissa ennen sen päättymistä, ja kuljetusliike voi vaihtaa ajoneuvon ja kuljettajan. Kuljettaja ei muuta toimeksiantoa itse, mutta voi ilmoittaa palvelussa poikkeamasta, jonka tilaaja tai kuljetusliike voi muuttaa muutokseksi. Hinta on joko kiinteä tai kilometrihinta: kilometrihinnassa hinta lasketaan uudelleen muuttuneen reitin pituuden mukaan, kiinteässä hinnassa hinta muuttuu vain, jos toinen osapuoli hyväksyy palvelussa tehdyn hintaehdotuksen. Jokainen muutos (ajoneuvo, kuljettaja, osoitteet, matka ja hinta) tallentuu palveluun muuttajan, yrityksen, ajankohdan, aiemman ja uuden arvon sekä mahdollisen perustelun kanssa, ja se näkyy molemmille osapuolille ja kuljettajalle. Tallennettuja muutoksia ei voi jälkikäteen muokata. Puhelimitse tai sähköpostitse ilmoitettuun uuteen osoitteeseen ei pidä luottaa ilman palvelussa tehtyä muutosta.',
    'Changes to a job: the shipper and the carrier to which a job has been assigned may change its stops in the service (addresses, added and removed stops) at any stage of the transport before it ends, and the carrier may change the vehicle and the driver. The driver does not change the job but may report a discrepancy in the service, which the shipper or the carrier may turn into a change. The price is either a fixed price or a price per kilometre: with a price per kilometre the price is recalculated from the length of the changed route; with a fixed price the price changes only if the other party accepts a price proposal made in the service. Every change (vehicle, driver, addresses, distance and price) is recorded in the service with the person and company that made it, the time, the previous and new value and any reason given, and is shown to both parties and to the driver. Recorded changes cannot be edited afterwards. A new address given by telephone or email should not be relied on without a change made in the service.');

  perform pg_temp.append(v_doc, 13, 'Vastuunrajoitus:',
    'Vastuunrajoitus: Aivomaa Oy:n vastuu palvelusta aiheutuneista vahingoista rajoittuu välittömiin vahinkoihin ja enintään määrään, jonka asiakas on maksanut Aivomaa Oy:lle palvelusta vahinkotapahtumaa edeltäneiden 12 kuukauden aikana, ja asiakkaalle, joka ei ole maksanut palvelusta maksuja, enintään 1 000 euroon. Aivomaa Oy ei vastaa välillisistä vahingoista, kuten saamatta jääneestä voitosta, liiketoiminnan menetyksestä tai kolmannelle aiheutuneesta vahingosta. Rajoitukset eivät koske vahinkoa, joka on aiheutettu tahallisesti tai törkeällä huolimattomuudella, eivätkä vastuuta, jota ei voi pakottavan lain mukaan rajoittaa.',
    'Limitation of liability: Aivomaa Oy''s liability for damage arising from the service is limited to direct damage and to no more than the amount the customer has paid to Aivomaa Oy for the service during the 12 months preceding the event giving rise to the damage, and, for a customer that has paid no fees for the service, to no more than EUR 1,000. Aivomaa Oy is not liable for indirect damage, such as loss of profit, loss of business or damage caused to third parties. These limitations do not apply to damage caused intentionally or through gross negligence, nor to liability that cannot be limited under mandatory law.');

  perform pg_temp.append(v_doc, 1, 'Palvelun säännöt:',
    'Palvelun säännöt: palvelun hinnat, toimeksiantojen järjestys tarjouspöydällä, osapuolille näytettävät tiedot, yritysten tarkastus, maksuilmoitukset ja palautteen käsittely kuvataan selkokielisesti julkisella sivulla rahtis.eu/fi/rules, jossa on myös muutoshistoria. Ilmoitamme näiden ehtojen ja sääntöjen muutoksista palvelussa ja sähköpostitse vähintään 30 päivää ennen niiden voimaantuloa, paitsi jos muutos johtuu laista tai viranomaisen määräyksestä tai on välttämätön väärinkäytösten estämiseksi.',
    'Rules of the service: the prices of the service, the order of jobs on the offer table, the information shown to the parties, the checking of companies, payment reports and the handling of complaints are described in plain language on the public page rahtis.eu/en/rules, which also contains a history of changes. We announce changes to these terms and rules in the service and by email at least 30 days before they take effect, unless the change is required by law or an order of an authority or is necessary to prevent abuse.');
end;
$$;


-- ── SHIPPER_AGREEMENT ──────────────────────────────────────────────

do $$
begin
  perform pg_temp.append(pg_temp.draft_of('SHIPPER_AGREEMENT'), 2, 'Maksumuistutukset:',
    'Maksumuistutukset: tilaaja hyväksyy, että palvelu lähettää sen laskutusosoitteeseen kuljetusliikkeen puolesta maksumuistutuksia kuljetusliikkeen palvelussa merkitsemistä erääntyneistä laskuista ja näyttää kuljetusliikkeille yhteenvedon tilaajan laskujen maksutäsmällisyydestä käyttöehtojen mukaisesti. Maksu suoritetaan suoraan kuljetusliikkeelle. Jos lasku on jo maksettu, tilaaja voi merkitä sen maksetuksi palvelussa.',
    'Payment reminders: the customer accepts that the service sends payment reminders to its invoicing address on behalf of a carrier for overdue invoices recorded by the carrier in the service, and shows carriers a summary of the customer''s invoice payment punctuality in accordance with the terms of use. Payment is made directly to the carrier. If an invoice has already been paid, the customer may mark it as paid in the service.');

  perform pg_temp.append(pg_temp.draft_of('SHIPPER_AGREEMENT'), 2, 'Tilauksen muutokset:',
    'Tilauksen muutokset: tilauksen osoitteisiin, ajoneuvoon, kuljettajaan, matkaan ja hintaan tehdyt muutokset tehdään palvelussa käyttöehtojen mukaisesti, ja ne tallentuvat muuttajan, ajankohdan, aiemman ja uuden arvon sekä perustelun kanssa. Muutokset näkyvät tilaajalle, kuljetusliikkeelle ja kuljettajalle. Kiinteä hinta muuttuu vain osapuolten hyväksymällä hintaehdotuksella; kilometrihinta lasketaan muuttuneen reitin pituuden mukaan.',
    'Changes to an order: changes to the addresses, vehicle, driver, distance and price of an order are made in the service in accordance with the terms of use and are recorded with the person who made them, the time, the previous and new value and the reason. The changes are visible to the customer, the carrier and the driver. A fixed price changes only through a price proposal accepted by the parties; a price per kilometre is recalculated from the length of the changed route.');

  perform pg_temp.append(pg_temp.draft_of('CARRIER_AGREEMENT'), 2, 'Tilauksen muutokset:',
    'Tilauksen muutokset: kuljetusliike tekee tilauksen osoitteisiin, ajoneuvoon, kuljettajaan, matkaan ja hintaan liittyvät muutokset palvelussa, jossa ne tallentuvat muuttajan, ajankohdan, aiemman ja uuden arvon sekä perustelun kanssa ja näkyvät tilaajalle ja kuljettajalle. Kuljetusliike ohjeistaa kuljettajiaan noudattamaan vain palvelussa näkyviä osoitteita ja ilmoittamaan poikkeamista palvelun kautta.',
    'Changes to an order: the carrier makes changes to the addresses, vehicle, driver, distance and price of an order in the service, where they are recorded with the person who made them, the time, the previous and new value and the reason, and are shown to the customer and the driver. The carrier instructs its drivers to follow only the addresses shown in the service and to report discrepancies through the service.');
end;
$$;


-- ── PRIVACY ────────────────────────────────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('PRIVACY');
  v_no integer;
begin
  if exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and locale = 'fi' and body like 'Maksumuistutukset ja muutosilmoitukset:%'
  ) then
    return;
  end if;

  select coalesce(max(path[2]), 0) + 1 into v_no
  from public.legal_clauses
  where document_id = v_doc and cardinality(path) = 2 and path[1] = 2;

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (v_doc, 'fi', array[2, v_no], null,
     'Maksumuistutukset ja muutosilmoitukset: käytämme tilaajan laskutussähköpostia (tai kuljetusliikkeen merkitsemää laskutusosoitetta) maksumuistutusten lähettämiseen kuljetusliikkeen puolesta. Kun yrityksen tilinumero, yhteys- tai laskutussähköposti tai pääkäyttäjä muuttuu, tallennamme muutoksen tekijän ja ajankohdan sekä peitetyt arvot (tilinumerosta neljä viimeistä merkkiä, sähköpostista ensimmäinen kirjain ja verkkotunnus) ja lähetämme ilmoituksen yrityksen muiden käyttäjien osoitteisiin sekä aiempaan osoitteeseen. Aiempi osoite poistetaan muutosmerkinnästä, kun ilmoitus on lähetetty. Käsittelyn perusteena on oikeutettu etu palvelun ja sen käyttäjien suojaamiseksi petoksilta.'),
    (v_doc, 'en', array[2, v_no], null,
     'Payment reminders and change notices: we use the customer''s invoicing email address (or the invoicing address recorded by the carrier) to send payment reminders on behalf of the carrier. When a company''s bank account number, contact or invoicing email address or main user changes, we record who made the change and when, together with masked values (the last four characters of the account number; the first letter and domain of an email address), and send a notice to the addresses of the company''s other users and to the previous address. The previous address is deleted from the change record once the notice has been sent. The legal basis is our legitimate interest in protecting the service and its users against fraud.');
end;
$$;
