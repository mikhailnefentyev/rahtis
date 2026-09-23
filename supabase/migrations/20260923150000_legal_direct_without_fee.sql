-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: прямой заказ подписчика и кому видно имя
--
-- Миграция direct_without_fee: у подписчика прямой заказ от заказчика,
-- добавившего его машину в свои, идёт без процента и без нашего счёта —
-- стороны рассчитываются сами, а от нас только отчёт о работе. Раз счёт
-- не наш, скрывать стороны друг от друга нельзя: платить будет некому.
--
-- Правятся черновики TERMS v11 (8.5 — деньги, 6.7 — что видит заказчик)
-- и PRIVACY v10 (10.2 — видимость данных). Договор заказчика тоже
-- меняется: у него появляется случай, когда его сопоставник не мы.
--
-- Активация — решение пользователя.
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

create or replace function pg_temp.put(p_doc uuid, p_path integer[], p_fi text, p_en text)
returns void
language sql
as $$
  insert into public.legal_clauses (document_id, locale, path, body)
  values (p_doc, 'fi', p_path, p_fi), (p_doc, 'en', p_path, p_en)
  on conflict (document_id, locale, path) do update set body = excluded.body;
$$;

do $$
declare
  v_terms uuid := pg_temp.draft_of('TERMS');
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
  v_shipper uuid := pg_temp.draft_of('SHIPPER_AGREEMENT');
begin
  /* 8.5 — деньги: у подписчика прямой заказ без процента и без нашего счёта. */
  perform pg_temp.put(v_terms, array[8, 5],
    'Palvelua voi käyttää kahdella tavalla, ja kuljetusliike valitsee kumpaa se käyttää. (a) Alusta kuukausimaksulla: maksu on 29,90 euroa kalenterikuukaudessa jokaisesta ajoneuvosta, jolla on kyseisen kuukauden aikana merkitty valmiiksi vähintään yksi keikka; muista palveluun rekisteröidyistä ajoneuvoista ei makseta. Näin ajetaan sekä kuljetusliikkeen omat asiakkaat että palvelussa olevan tilaajan suorat tilaukset silloin, kun tilaaja on lisännyt ajoneuvon omiin autoihinsa. Näistä keikoista ei peritä prosenttiosuutta: kuljetussopimus on kuljetusliikkeen ja sen asiakkaan välinen, eikä Aivomaa Oy laskuta asiakasta, ota vastaan maksuja tai vastaa kuljetuksesta, vaan toimittaa palvelussa raportin tehdystä työstä. (b) Alihankinta: kuljetusliike toimii Aivomaa Oy:n alihankkijana, jolloin Aivomaa Oy on tilaajan sopimuskumppani, laskuttaa tilaajaa, vastaanottaa rahtikirjat, toimittaa raportit ja käsittelee reklamaatiot. Maksu on 3 prosenttia jokaisen keikan hinnasta, ja se vähennetään kuljetusliikkeelle maksettavasta tilityksestä; kuukausimaksua ajoneuvoista ei tällöin peritä. Tarjouspöydältä otettu keikka ajetaan aina alihankintana riippumatta siitä, kumpaa tapaa kuljetusliike muutoin käyttää: tällaisesta keikasta tilaaja maksaa 3 prosentin palvelumaksun ja kuljetusliike 3 prosenttia keikan hinnasta. Alihankkijana toimivalla kuljetusliikkeellä on oltava voimassa oleva vastuuvakuutus, ja Aivomaa Oy tarkistaa tilaajavastuulain tarkoittamat tiedot ennen sopimusta ja sen jälkeen määräajoin. Keikan valmistumishetkellä voimassa olevat maksut kirjataan kyseiselle keikalle, eivätkä myöhemmät muutokset vaikuta jo valmistuneisiin keikkoihin. Yrityksen hyväksymiskuukauden loppuosa ja sitä seuraava kokonainen kalenterikuukausi ovat maksuttomia; jos yritys hyväksytään kuukauden ensimmäisenä päivänä, maksuton on kyseinen kuukausi. Arvonlisävero määräytyy sopimuskumppanin maan mukaan: suomalaiselle yritykselle lisätään 25,5 prosenttia, muun maan yritykselle sovelletaan käännettyä verovelvollisuutta, jolloin myyjä laskuttaa nollalla ja ostaja tilittää veron omassa maassaan. [Kohta täydennetään juristin kanssa: kuittauksen ehdot, alihankkijan vakuutuksen vähimmäismäärä sekä regressin ehdot.]',
    'The service can be used in two ways, and the carrier chooses which one it uses. (a) The platform for a monthly fee: the fee is 29.90 euros per calendar month for each vehicle that has at least one job marked complete during that month; no fee is charged for the other vehicles registered in the service. This covers both the carrier''s own clients and the direct orders of a shipper in the service where the shipper has added the vehicle to its own vehicles. No percentage is charged on these jobs: the contract of carriage is between the carrier and its client, and Aivomaa Oy does not invoice the client, receive payments or bear liability for the transport, but delivers a report of the work done in the service. (b) Subcontracting: the carrier acts as a subcontractor of Aivomaa Oy, in which case Aivomaa Oy is the shipper''s contracting party, invoices the shipper, receives the consignment notes, delivers the reports and handles the claims. The fee is 3 per cent of the price of every job and is deducted from the settlement paid to the carrier; no monthly vehicle fee is charged in that case. A job taken from the offer table is always performed as subcontracting regardless of which way the carrier otherwise uses: for such a job the shipper pays a 3 per cent service fee and the carrier 3 per cent of the price of the job. A carrier acting as a subcontractor must hold valid liability insurance, and Aivomaa Oy checks the information referred to in the Act on the Contractor''s Obligations before the contract and periodically thereafter. The fees in force at the moment a job is completed are recorded on that job, and later changes do not affect jobs already completed. The remainder of the company''s approval month and the following full calendar month are free of charge; if the company is approved on the first day of a month, that month is free. Value added tax is determined by the country of the contracting party: 25.5 per cent is added for a Finnish company, and the reverse charge applies to a company from another country, whereby the seller invoices at zero and the buyer accounts for the tax in its own country. [This clause is to be completed with counsel: the terms of set-off, the minimum amount of the subcontractor''s insurance and the terms of recourse.]');

  /* 6.7 — что заказчик видит о знакомой машине: зависит от того, кто выставляет счёт. */
  perform pg_temp.put(v_terms, array[6, 7],
    'Kuljetusliike päättää, mitkä tilaajat saavat lähettää suoria tilauksia sen ajoneuvoille, ja voi perua luvan milloin tahansa; peruminen ei vaikuta jo lähetettyihin tilauksiin. Tällaisista ajoneuvoista tilaaja näkee rekisteritunnuksen, ajoneuvon tiedot ja kuljetusliikkeen arvosanan sekä yhteydenpitoa varten kuljettajan nimen, puhelinnumeron ja sähköpostiosoitteen. Jos ajoneuvon kuljetusliike käyttää palvelua kuukausimaksulla, tilaaja näkee lisäksi kuljetusliikkeen nimen ja y-tunnuksen: osapuolet laskuttavat ja maksavat keskenään, eikä laskuttajaa voi jättää tuntemattomaksi. Jos keikka ajetaan alihankintana, kuljetusliikkeen nimi ja muut tiedot eivät näy tilaajalle, koska tilaajan sopimuskumppani ja laskuttaja on Aivomaa Oy. Vastaavasti kuljetusliike näkee tilaajan nimen vain niistä tilaajista, joiden kanssa se laskuttaa suoraan; muutoin tilaajat näkyvät sille koodilla, keikkamäärällä ja viimeisimmällä reitillä. Kuljetuksen suorittamiseen tarvittavat lastaus- ja purkupaikkojen tiedot näkyvät kuljetusliikkeelle ja kuljettajalle.',
    'The carrier decides which shippers may send direct orders to its vehicles and may withdraw that permission at any time; withdrawal does not affect orders already sent. For such vehicles the shipper sees the registration number, the vehicle''s details and the carrier''s rating and, for contact, the driver''s name, telephone number and email address. If the vehicle''s carrier uses the service for a monthly fee, the shipper also sees the carrier''s name and business identity code: the parties invoice and pay each other, and the party issuing the invoice cannot remain unknown. If the job is performed as subcontracting, the carrier''s name and other details are not shown to the shipper, because the shipper''s contracting party and invoicing party is Aivomaa Oy. Likewise, the carrier sees a shipper''s name only for those shippers it invoices directly; otherwise shippers are shown to it by a code, the number of jobs and the latest route. The loading and unloading place details needed to perform the transport are visible to the carrier and the driver.');

  /* 10.2 — то же в политике: видимость идёт за тем, кто с кем рассчитывается. */
  perform pg_temp.put(v_privacy, array[10, 2],
    'Kun Aivomaa Oy on tilaajan sopimuskumppani, tilaaja ei näe kuljetusliikkeen nimeä eikä sen henkilöstön yhteystietoja, eikä kuljetusliike näe tilaajan nimeä, yhteystietoja eikä laskutustietoja; kuljetusliikkeelle tilaaja näkyy koodilla. Kun osapuolet laskuttavat ja maksavat keskenään — kuukausimaksulla palvelua käyttävän kuljetusliikkeen suorat keikat — he näkevät toisensa nimeltä, koska muuten laskua ei voi osoittaa eikä maksaa. Tarjouspöydällä kuljetusliike näkee pisteistä vain kaupungin, ja kartalla ne esitetään noin kymmenen kilometrin tarkkuudella; paikan nimi, tarkka osoite, varausnumero, huomautukset ja yhteyshenkilöt avautuvat vasta, kun keikka on osoitettu sille. Lastaus- ja purkupaikkojen tiedot näkyvät kuljetusliikkeelle ja kuljettajalle siltä osin kuin kuljetus sitä edellyttää. Kuljetusliike ei näe muiden kuljetusliikkeiden kalustoa eikä niiden sijaintia. Ajoneuvoista, jotka ovat ajaneet tilaajan keikkoja ja joiden kuljetusliike on sallinut suorat tilaukset, tilaaja näkee rekisteritunnuksen ja kuljetusliikkeen arvosanan sekä yhteydenpitoa varten kuljettajan nimen, puhelinnumeron ja sähköpostiosoitteen. [Kohta täydennetään juristin kanssa: kuljettajan yhteystietojen luovuttamisen peruste ja kuljettajalle annettava tieto.]',
    'When Aivomaa Oy is the shipper''s contracting party, the shipper does not see the carrier''s name or its personnel contact details, and the carrier does not see the shipper''s name, contact details or billing details; the shipper is shown to the carrier by a code. When the parties invoice and pay each other — the direct jobs of a carrier that uses the service for a monthly fee — they see each other by name, because otherwise an invoice can neither be addressed nor paid. On the offer table a carrier sees only the city of the points, and on the map they are presented with an accuracy of about ten kilometres; the name of the place, the exact address, the booking reference, notes and contact persons open only once the job has been assigned to it. Loading and unloading place details are visible to the carrier and the driver to the extent the transport requires. A carrier does not see other carriers'' vehicles or their locations. For vehicles that have performed the shipper''s jobs and whose carrier has allowed direct orders, the shipper sees the registration number and the carrier''s rating and, for contact, the driver''s name, telephone number and email address. [This clause is to be completed with counsel: the basis for disclosing the driver''s contact details and the information given to the driver.]');

  /* Договор заказчика: у прямого заказа сопоставником может быть сам перевозчик. */
  perform pg_temp.put(v_shipper, array[2, 5],
    'Tilaaja voi lähettää toimeksiannon suoraan tutulle ajoneuvolle käyttöehtojen kohdan 6.6 mukaisesti. Suora tilaus odottaa vahvistusta ilman määräaikaa, ja sopimus syntyy, kun ajoneuvon kuljetusliike tai kuljettaja vahvistaa sen. Siihen asti tilaaja voi siirtää toimeksiannon tarjouspöydälle. Suorasta tilauksesta ei peritä palvelumaksua. Jos ajoneuvon kuljetusliike käyttää palvelua kuukausimaksulla, suora tilaus tehdään tilaajan ja kyseisen kuljetusliikkeen välillä: kuljetusliike näkyy tilaajalle nimeltä, laskuttaa tilaajaa itse ja vastaa kuljetuksesta, ja Aivomaa Oy välittää tiedot sekä raportin tehdystä työstä. Muissa tapauksissa Aivomaa Oy on tilaajan sopimuskumppani myös suorissa tilauksissa.',
    'The shipper may send an assignment directly to a known vehicle in accordance with clause 6.6 of the terms of use. A direct order waits for confirmation without a deadline, and the contract is formed when the vehicle''s carrier or driver confirms it. Until then the shipper may move the assignment to the offer table. No service fee is charged on a direct order. If the vehicle''s carrier uses the service for a monthly fee, the direct order is made between the shipper and that carrier: the carrier is shown to the shipper by name, invoices the shipper itself and is liable for the transport, while Aivomaa Oy passes on the data and a report of the work done. In other cases Aivomaa Oy is the shipper''s contracting party also in direct orders.');
end;
$$;
