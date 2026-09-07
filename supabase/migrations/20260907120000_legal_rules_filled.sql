-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · условия и политика описывают то, что платформа делает
--
-- Обе редакции были скелетом: заголовки разделов и под каждым «[Teksti
-- täydennetään juristin kanssa.]». Скелет придумывался до того, как
-- появились контейнеры, Скандинавия, нулевая ставка налога, снятие
-- заказа, отказ перевозчика и пересчёт цены по €/км.
--
-- ЧТО ЗДЕСЬ НАПИСАНО И ЧТО НЕТ.
--
-- Написано — фактическое устройство платформы: кто кому платит, когда
-- заказ становится обязывающим, что происходит при срыве, какие данные
-- собираются и куда уходят. Это то, чего юрист знать не может и что
-- пришлось бы вытаскивать из разработчика вопросами.
--
-- Не написано — правовые решения: пределы ответственности, размер
-- неустойки, сроки претензий. Там, где нужен выбор юриста, стоит прежняя
-- пометка. Заполнить их описанием кода значило бы выдать за
-- согласованное то, что никто не согласовывал.
--
-- Поэтому редакции заводятся ЧЕРНОВИКАМИ и не активируются. Действующими
-- остаются прежние, пока юрист не пройдёт по тексту и оператор не нажмёт
-- «активировать» в разделе документов. Подсунуть компаниям на согласие
-- текст, который никто не проверял, — ровно та ошибка, ради которой
-- версии и заведены.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_terms uuid;
  v_privacy uuid;
  v_marker_fi text := '[Kohta täydennetään juristin kanssa.]';
  v_marker_en text := '[This clause is to be completed with counsel.]';
begin

  -- ── Условия использования ────────────────────────────────────────

  insert into public.legal_documents (kind, version, status)
  values (
    'TERMS',
    coalesce((select max(version) + 1 from public.legal_documents where kind = 'TERMS'), 1),
    'DRAFT'
  )
  returning id into v_terms;

  insert into public.legal_clauses (document_id, locale, path, title, body) values

  -- 1. Soveltamisala
  (v_terms, 'fi', '{1}', 'Soveltamisala', null),
  (v_terms, 'fi', '{1,1}', null,
   'Näitä ehtoja sovelletaan RAHTIS-alustan käyttöön. Alustaa ylläpitää Aivomaa Oy (Y-tunnus 3592993-6), jäljempänä ylläpitäjä.'),
  (v_terms, 'fi', '{1,2}', null,
   'Alusta välittää kahta kuljetuslajia: irtoperävaunujen vaihtoa ja konttikuljetuksia. Muuta rahtia alustan kautta ei tilata.'),
  (v_terms, 'fi', '{1,3}', null,
   'Toiminta-alue on Skandinavian satamat: Suomi, Ruotsi, Norja ja Tanska.'),
  (v_terms, 'fi', '{1,4}', null,
   'Ylläpitäjä ei itse kuljeta eikä omista kalustoa. Kuljetuksen suorittaa kuljetusliike omalla kalustollaan ja omalla liikenneluvallaan.'),

  -- 2. Osapuolet ja roolit
  (v_terms, 'fi', '{2}', 'Osapuolet ja roolit', null),
  (v_terms, 'fi', '{2,1}', null,
   'Alustalla on kolme roolia: tilaaja (huolitsija tai logistiikkaoperaattori), kuljetusliike ja ylläpitäjä.'),
  (v_terms, 'fi', '{2,2}', null,
   'Ylläpitäjä toimii päämiehenä: tilaaja maksaa ylläpitäjälle koko sovitun hinnan, ja ylläpitäjä maksaa kuljetusliikkeelle hinnan vähennettynä palvelumaksulla. Tilaajan sopimuskumppani on ylläpitäjä, ei kuljetusliike.'),
  (v_terms, 'fi', '{2,3}', null,
   'Palveluun ei voi rekisteröityä suoraan. Jokaisen yrityksen tiedot tarkistetaan rekistereistä ennen hyväksyntää, ja kuljetusliikkeeltä tarkistetaan lisäksi liikennelupa ja vakuutus.'),
  (v_terms, 'fi', '{2,4}', null,
   'Jokainen ajoneuvo hyväksytään erikseen. Avoimet kuljetukset näkyvät vain yritykselle, jolla on vähintään yksi hyväksytty ajoneuvo ja voimassa olevat asiakirjat.'),

  -- 3. Kuljetuksen sisältö
  (v_terms, 'fi', '{3}', 'Kuljetettava yksikkö', null),
  (v_terms, 'fi', '{3,1}', null,
   'Tilauksessa ilmoitetaan, vedetäänkö perävaunua vai konttia. Perävaunusta ilmoitetaan tyyppi ja rekisterinumero, kontista pituus jaloissa ja ISO 6346 -tunnus.'),
  (v_terms, 'fi', '{3,2}', null,
   'Konttikuljetuksen voi ottaa vain ajoneuvo, jonka alusta ottaa ilmoitetun pituisen kontin. Alusta estää tarjouksen muilta ajoneuvoilta.'),
  (v_terms, 'fi', '{3,3}', null,
   'Kuorman paino verrataan vetoauton akselimäärän mukaiseen kantavuuteen. Alusta estää tarjouksen ajoneuvolta, jonka kantavuus ei riitä.'),

  -- 4. Tilaaminen ja sopiminen
  (v_terms, 'fi', '{4}', 'Tilaaminen ja sopimuksen syntyminen', null),
  (v_terms, 'fi', '{4,1}', null,
   'Tilaaja julkaisee kuljetuksen. Reitin pisteiden osoitteet valitaan alustan ehdotuksista, jolloin niillä on koordinaatit; matka lasketaan näiden perusteella kuorma-autolle sopivaa reittiä pitkin. Tilaaja voi korjata lasketun matkan.'),
  (v_terms, 'fi', '{4,2}', null,
   'Kuljetukseen otetaan enintään kolme tarjousta. Tilaaja valitsee yhden, ja valittu kuljetusliike vahvistaa työn. Molemmilla päätöksillä on 15 minuutin määräaika, jonka jälkeen kuljetus palaa tarjolle.'),
  (v_terms, 'fi', '{4,3}', null,
   'Sitova sopimus kuljetuksesta syntyy, kun kuljetusliike vahvistaa työn. Sitä ennen kumpi tahansa osapuoli voi peruuttaa ilman seuraamuksia.'),

  -- 5. Muutokset ja keskeytykset
  (v_terms, 'fi', '{5}', 'Muutokset ja keskeytykset', null),
  (v_terms, 'fi', '{5,1}', null,
   'Tilaaja voi kuljetuksen aikana muuttaa, lisätä tai poistaa pisteitä, joilla ei ole vielä käyty. Jokainen muutos kirjataan kuljetuksen muutoslokiin tekijöineen ja aikoineen, ja kuljetusliike saa siitä ilmoituksen.'),
  (v_terms, 'fi', '{5,2}', null,
   'Matka ja hinta eivät muutu pisteitä muuttamalla. Ne muuttuvat vain erillisellä päivityksellä, jonka tilaaja vahvistaa; alusta ehdottaa uutta hintaa alkuperäisellä €/km-hinnalla.'),
  (v_terms, 'fi', '{5,3}', null,
   'Tilaaja tai ylläpitäjä voi peruuttaa kuljetuksen ennen sen valmistumista. Peruutus kirjataan muutoslokiin syineen, ja kuljetusliike saa ilmoituksen.'),
  (v_terms, 'fi', '{5,4}', null,
   'Kuljetusliike voi luopua vahvistamastaan kuljetuksesta. Jos yhtäkään pistettä ei ole vielä käyty, kuljetus palaa tarjolle muille; jos matka on alkanut, kuljetus peruuntuu ja ajojärjestely ottaa yhteyttä. Luopuminen kirjataan lokiin.'),
  (v_terms, 'fi', '{5,5}', null, v_marker_fi),

  -- 6. Hinnat ja maksuehdot
  (v_terms, 'fi', '{6}', 'Hinnat, palvelumaksu ja maksuehdot', null),
  (v_terms, 'fi', '{6,1}', null,
   'Hinta sovitaan kuljetuskohtaisesti ja ilmoitetaan alustalla ilman arvonlisäveroa. Palvelu laskutetaan käännetyllä verovelvollisuudella: myyjä laskuttaa alv 0 %, ja ostaja tilittää veron omassa maassaan.'),
  (v_terms, 'fi', '{6,2}', null,
   'Ylläpitäjän palvelumaksu peritään tilaajan maksamasta hinnasta. Kuljetuksen valmistuessa voimassa oleva palvelumaksuprosentti kirjataan kuljetukseen, eikä myöhempi muutos vaikuta jo valmistuneisiin kuljetuksiin.'),
  (v_terms, 'fi', '{6,3}', null,
   'Valmistuneet kuljetukset, laskutettavat ja tilitettävät summat sekä asiakirjat näkyvät osapuolille viikkoraportissa.'),
  (v_terms, 'fi', '{6,4}', null, v_marker_fi),

  -- 7. Vastuut
  (v_terms, 'fi', '{7}', 'Vastuut', null),
  (v_terms, 'fi', '{7,1}', null,
   'Kuljetusliike vastaa kuljetuksesta, kalustostaan ja kuljettajistaan. Kuljetusta ei voi merkitä valmiiksi ennen kuin rahtikirja on liitetty; mahdolliset vauriot kirjataan kuvineen kuljetukseen.'),
  (v_terms, 'fi', '{7,2}', null,
   'Kukin osapuoli vastaa alustalle syöttämiensä tietojen oikeellisuudesta: osoitteista, painoista, aikatauluista ja yhteystiedoista.'),
  (v_terms, 'fi', '{7,3}', null,
   'Ylläpitäjä ei takaa, että julkaistuun kuljetukseen tulee tarjouksia, eikä vastaa kolmannen osapuolen palvelun — kartta-, reititys- tai sähköpostipalvelun — katkoksista.'),
  (v_terms, 'fi', '{7,4}', null, v_marker_fi),

  -- 8. Käytön päättyminen
  (v_terms, 'fi', '{8}', 'Käytön päättyminen', null),
  (v_terms, 'fi', '{8,1}', null,
   'Ylläpitäjä voi jäädyttää yrityksen pääsyn palveluun. Jäädytys ei poista tietoja: kuljetushistoria, asiakirjat ja summat säilytetään lakisääteisen ajan.'),
  (v_terms, 'fi', '{8,2}', null, v_marker_fi),

  -- 9. Sovellettava laki
  (v_terms, 'fi', '{9}', 'Sovellettava laki ja riidat', null),
  (v_terms, 'fi', '{9,1}', null, v_marker_fi),

  -- ── englanti ──
  (v_terms, 'en', '{1}', 'Scope', null),
  (v_terms, 'en', '{1,1}', null,
   'These terms apply to the use of the RAHTIS platform. The platform is operated by Aivomaa Oy (business ID 3592993-6), hereinafter the operator.'),
  (v_terms, 'en', '{1,2}', null,
   'The platform brokers two kinds of transport: semi-trailer swaps and container haulage. No other freight is ordered through it.'),
  (v_terms, 'en', '{1,3}', null,
   'The operating area is the ports of Scandinavia: Finland, Sweden, Norway and Denmark.'),
  (v_terms, 'en', '{1,4}', null,
   'The operator neither carries goods nor owns vehicles. Transport is performed by the carrier with its own equipment and under its own operating licence.'),

  (v_terms, 'en', '{2}', 'Parties and roles', null),
  (v_terms, 'en', '{2,1}', null,
   'The platform has three roles: the shipper (a forwarder or logistics operator), the carrier, and the operator.'),
  (v_terms, 'en', '{2,2}', null,
   'The operator acts as principal: the shipper pays the operator the full agreed price, and the operator pays the carrier that price less the service fee. The shipper''s counterparty is the operator, not the carrier.'),
  (v_terms, 'en', '{2,3}', null,
   'There is no open sign-up. Every company is checked against public registers before approval, and a carrier is additionally checked for its operating licence and insurance.'),
  (v_terms, 'en', '{2,4}', null,
   'Each vehicle is approved separately. Open jobs are visible only to a company with at least one approved vehicle and valid documents.'),

  (v_terms, 'en', '{3}', 'The unit being hauled', null),
  (v_terms, 'en', '{3,1}', null,
   'The order states whether a trailer or a container is being hauled. For a trailer, the type and registration are given; for a container, the length in feet and the ISO 6346 number.'),
  (v_terms, 'en', '{3,2}', null,
   'A container job can only be taken by a vehicle whose chassis accepts the stated length. The platform blocks offers from other vehicles.'),
  (v_terms, 'en', '{3,3}', null,
   'Cargo weight is checked against the capacity implied by the tractor''s axle count. The platform blocks offers from vehicles without sufficient capacity.'),

  (v_terms, 'en', '{4}', 'Ordering and formation of the contract', null),
  (v_terms, 'en', '{4,1}', null,
   'The shipper publishes the job. Stop addresses are picked from the platform''s suggestions so that they carry coordinates; the distance is computed from them along a route suitable for a truck. The shipper may correct the computed distance.'),
  (v_terms, 'en', '{4,2}', null,
   'At most three offers are accepted per job. The shipper selects one, and the selected carrier confirms the work. Both decisions have a 15-minute deadline, after which the job returns to the board.'),
  (v_terms, 'en', '{4,3}', null,
   'A binding contract of carriage is formed when the carrier confirms the work. Before that, either party may cancel without consequence.'),

  (v_terms, 'en', '{5}', 'Changes and interruptions', null),
  (v_terms, 'en', '{5,1}', null,
   'During the job the shipper may change, add or remove stops that have not been reached. Every change is written to the job''s change log with its author and time, and the carrier is notified.'),
  (v_terms, 'en', '{5,2}', null,
   'Changing stops does not change the distance or the price. Those change only through a separate update confirmed by the shipper; the platform proposes a new price at the originally agreed price per kilometre.'),
  (v_terms, 'en', '{5,3}', null,
   'The shipper or the operator may cancel the job before it is completed. The cancellation is written to the change log with its reason, and the carrier is notified.'),
  (v_terms, 'en', '{5,4}', null,
   'The carrier may step back from a job it has confirmed. If no stop has been reached, the job returns to the board for others; if the run has started, the job is cancelled and dispatch makes contact. Stepping back is written to the log.'),
  (v_terms, 'en', '{5,5}', null, v_marker_en),

  (v_terms, 'en', '{6}', 'Prices, service fee and payment terms', null),
  (v_terms, 'en', '{6,1}', null,
   'The price is agreed per job and shown on the platform excluding value added tax. The service is invoiced under the reverse charge: the seller invoices at 0%, and the buyer accounts for the tax in its own country.'),
  (v_terms, 'en', '{6,2}', null,
   'The operator''s service fee is taken from the price paid by the shipper. The fee percentage in force when the job is completed is recorded on that job, and later changes do not affect jobs already completed.'),
  (v_terms, 'en', '{6,3}', null,
   'Completed jobs, amounts to be invoiced and paid out, and the related documents are shown to the parties in the weekly report.'),
  (v_terms, 'en', '{6,4}', null, v_marker_en),

  (v_terms, 'en', '{7}', 'Responsibilities', null),
  (v_terms, 'en', '{7,1}', null,
   'The carrier is responsible for the transport, its equipment and its drivers. A job cannot be marked complete before the CMR note is attached; any damage is recorded on the job with photographs.'),
  (v_terms, 'en', '{7,2}', null,
   'Each party is responsible for the accuracy of the data it enters: addresses, weights, schedules and contact details.'),
  (v_terms, 'en', '{7,3}', null,
   'The operator does not guarantee that a published job will receive offers, and is not liable for outages of third-party services such as mapping, routing or email.'),
  (v_terms, 'en', '{7,4}', null, v_marker_en),

  (v_terms, 'en', '{8}', 'Ending the use of the service', null),
  (v_terms, 'en', '{8,1}', null,
   'The operator may freeze a company''s access to the service. Freezing does not delete data: transport history, documents and amounts are retained for the period required by law.'),
  (v_terms, 'en', '{8,2}', null, v_marker_en),

  (v_terms, 'en', '{9}', 'Governing law and disputes', null),
  (v_terms, 'en', '{9,1}', null, v_marker_en);


  -- ── Тайтсуоя ─────────────────────────────────────────────────────

  insert into public.legal_documents (kind, version, status)
  values (
    'PRIVACY',
    coalesce((select max(version) + 1 from public.legal_documents where kind = 'PRIVACY'), 1),
    'DRAFT'
  )
  returning id into v_privacy;

  insert into public.legal_clauses (document_id, locale, path, title, body) values

  (v_privacy, 'fi', '{1}', 'Rekisterinpitäjä', null),
  (v_privacy, 'fi', '{1,1}', null,
   'Rekisterinpitäjä on Aivomaa Oy (Y-tunnus 3592993-6), Suomi. Tietosuoja-asioissa yhteydenotot: admin@rahtis.eu.'),

  (v_privacy, 'fi', '{2}', 'Käsiteltävät tiedot', null),
  (v_privacy, 'fi', '{2,1}', null,
   'Yritystiedot: nimi, Y-tunnus, ALV-numero, osoitteet, laskutustiedot, pankkiyhteys ja verkkolaskuosoite.'),
  (v_privacy, 'fi', '{2,2}', null,
   'Käyttäjätiedot: sähköpostiosoite, nimi, puhelinnumero, rooli ja yritys, johon käyttäjä kuuluu.'),
  (v_privacy, 'fi', '{2,3}', null,
   'Kuljettajatiedot: nimi, puhelin- tai WhatsApp-numero ja kielitaito. Nämä tiedot syöttää kuljetusliike ajoneuvon korttiin.'),
  (v_privacy, 'fi', '{2,4}', null,
   'Kuljetustiedot: reitin pisteiden osoitteet ja koordinaatit, aikataulut, kuorman paino, pisteiden yhteyshenkilöiden nimet ja puhelinnumerot sekä kuljetuksen muutosloki.'),
  (v_privacy, 'fi', '{2,5}', null,
   'Asiakirjat: rahtikirjat, lastaus- ja purkukuvat sekä vauriokuvat, jotka kuljetusliike liittää kuljetukseen.'),
  (v_privacy, 'fi', '{2,6}', null,
   'Lokitiedot: kirjautumiset, tilamuutokset, lähetetyt viestit ja häiriötapahtumat.'),

  (v_privacy, 'fi', '{3}', 'Käsittelyn peruste ja tarkoitus', null),
  (v_privacy, 'fi', '{3,1}', null,
   'Sopimuksen täyttäminen: kuljetusten välittäminen, osapuolten yhdistäminen, kuljetuksen seuranta ja asiakirjojen toimittaminen.'),
  (v_privacy, 'fi', '{3,2}', null,
   'Lakisääteinen velvoite: kirjanpito ja laskutus.'),
  (v_privacy, 'fi', '{3,3}', null,
   'Oikeutettu etu: palvelun tietoturva, väärinkäytösten estäminen ja häiriöiden selvittäminen.'),

  (v_privacy, 'fi', '{4}', 'Tietolähteet', null),
  (v_privacy, 'fi', '{4,1}', null,
   'Tiedot saadaan yrityksiltä itseltään: hakemuksesta, yritystiedoista, ajoneuvokorteista ja kuljetustilauksista. Yritystiedot tarkistetaan julkisista rekistereistä.'),

  (v_privacy, 'fi', '{5}', 'Tietojen vastaanottajat', null),
  (v_privacy, 'fi', '{5,1}', null,
   'Kuljetuksen toinen osapuoli saa ne tiedot, joita työn tekeminen edellyttää: kuljetusliike näkee pisteiden osoitteet ja yhteyshenkilöt, tilaaja näkee kuljetuksen etenemisen ja asiakirjat.'),
  (v_privacy, 'fi', '{5,2}', null,
   'Käsittelijöinä toimivat alustan tekniset palveluntarjoajat: konesali ja tietokanta, sovellusalusta, osoite- ja reittipalvelu, karttapalvelu sekä sähköpostin lähetyspalvelu.'),
  (v_privacy, 'fi', '{5,3}', null,
   'Osoitetiedot välitetään osoite- ja reittipalvelulle koordinaattien ja matkan laskemiseksi. Muita henkilötietoja ei välitetä sinne.'),
  (v_privacy, 'fi', '{5,4}', null, v_marker_fi),

  (v_privacy, 'fi', '{6}', 'Säilytysaika', null),
  (v_privacy, 'fi', '{6,1}', null,
   'Kirjanpitoon liittyvät kuljetus- ja laskutustiedot säilytetään kirjanpitolain edellyttämän ajan.'),
  (v_privacy, 'fi', '{6,2}', null,
   'Peruutetut ja koeluontoiset kuljetukset, joita ei ole laskutettu ja joihin ei ole liitetty asiakirjoja, voidaan poistaa.'),
  (v_privacy, 'fi', '{6,3}', null,
   'Häiriölokia säilytetään rajoitetun ajan ja se siivotaan automaattisesti.'),

  (v_privacy, 'fi', '{7}', 'Rekisteröidyn oikeudet', null),
  (v_privacy, 'fi', '{7,1}', null,
   'Rekisteröidyllä on oikeus saada pääsy tietoihinsa, oikaista virheelliset tiedot, pyytää tietojen poistamista tai käsittelyn rajoittamista sekä vastustaa käsittelyä.'),
  (v_privacy, 'fi', '{7,2}', null,
   'Pyynnöt osoitetaan osoitteeseen admin@rahtis.eu. Kuljettajaa koskevat pyynnöt kannattaa osoittaa ensin omalle työnantajalle, joka on syöttänyt tiedot.'),
  (v_privacy, 'fi', '{7,3}', null,
   'Rekisteröidyllä on oikeus tehdä valitus tietosuojavaltuutetun toimistolle.'),

  (v_privacy, 'fi', '{8}', 'Tietojen suojaaminen', null),
  (v_privacy, 'fi', '{8,1}', null,
   'Pääsy tietoihin on rooleittain rajattu, ja rajaus on toteutettu tietokannan tasolla eikä vain käyttöliittymässä. Salaiset avaimet ovat vain palvelinpuolella.'),
  (v_privacy, 'fi', '{8,2}', null,
   'Tilaaja ei näe kuljetusliikkeen henkilöstön yhteystietoja eikä kuljetusliike tilaajan laskutustietoja, ellei työ sitä edellytä.'),

  -- ── englanti ──
  (v_privacy, 'en', '{1}', 'Controller', null),
  (v_privacy, 'en', '{1,1}', null,
   'The controller is Aivomaa Oy (business ID 3592993-6), Finland. For data protection matters: admin@rahtis.eu.'),

  (v_privacy, 'en', '{2}', 'Data processed', null),
  (v_privacy, 'en', '{2,1}', null,
   'Company data: name, business ID, VAT number, addresses, billing details, bank account and e-invoicing address.'),
  (v_privacy, 'en', '{2,2}', null,
   'User data: email address, name, telephone number, role and the company the user belongs to.'),
  (v_privacy, 'en', '{2,3}', null,
   'Driver data: name, telephone or WhatsApp number and languages. This data is entered by the carrier on the vehicle record.'),
  (v_privacy, 'en', '{2,4}', null,
   'Transport data: stop addresses and coordinates, schedules, cargo weight, names and telephone numbers of contacts at the stops, and the job''s change log.'),
  (v_privacy, 'en', '{2,5}', null,
   'Documents: CMR notes, loading and unloading photographs and damage photographs attached to the job by the carrier.'),
  (v_privacy, 'en', '{2,6}', null,
   'Log data: sign-ins, status changes, messages sent and incident records.'),

  (v_privacy, 'en', '{3}', 'Legal basis and purpose', null),
  (v_privacy, 'en', '{3,1}', null,
   'Performance of a contract: brokering transport, bringing the parties together, following the job and delivering the documents.'),
  (v_privacy, 'en', '{3,2}', null, 'Legal obligation: accounting and invoicing.'),
  (v_privacy, 'en', '{3,3}', null,
   'Legitimate interest: security of the service, prevention of misuse and investigation of incidents.'),

  (v_privacy, 'en', '{4}', 'Sources', null),
  (v_privacy, 'en', '{4,1}', null,
   'Data is obtained from the companies themselves: from the application, company details, vehicle records and transport orders. Company details are checked against public registers.'),

  (v_privacy, 'en', '{5}', 'Recipients', null),
  (v_privacy, 'en', '{5,1}', null,
   'The other party to a job receives the data the work requires: the carrier sees stop addresses and contacts, the shipper sees the progress of the job and its documents.'),
  (v_privacy, 'en', '{5,2}', null,
   'The platform''s technical service providers act as processors: hosting and database, application platform, address and routing service, map service, and the email delivery service.'),
  (v_privacy, 'en', '{5,3}', null,
   'Address data is passed to the address and routing service in order to obtain coordinates and compute distance. No other personal data is passed there.'),
  (v_privacy, 'en', '{5,4}', null, v_marker_en),

  (v_privacy, 'en', '{6}', 'Retention', null),
  (v_privacy, 'en', '{6,1}', null,
   'Transport and invoicing data belonging to the accounts is retained for the period required by accounting law.'),
  (v_privacy, 'en', '{6,2}', null,
   'Cancelled and test jobs that were never invoiced and carry no documents may be deleted.'),
  (v_privacy, 'en', '{6,3}', null,
   'The incident log is retained for a limited period and is cleaned automatically.'),

  (v_privacy, 'en', '{7}', 'Rights of the data subject', null),
  (v_privacy, 'en', '{7,1}', null,
   'The data subject has the right of access, the right to have inaccurate data corrected, and the right to request erasure or restriction of processing, and to object to processing.'),
  (v_privacy, 'en', '{7,2}', null,
   'Requests are sent to admin@rahtis.eu. A request concerning a driver is best addressed first to that driver''s own employer, who entered the data.'),
  (v_privacy, 'en', '{7,3}', null,
   'The data subject has the right to lodge a complaint with the Office of the Data Protection Ombudsman.'),

  (v_privacy, 'en', '{8}', 'Security', null),
  (v_privacy, 'en', '{8,1}', null,
   'Access to data is restricted by role, and the restriction is enforced in the database rather than only in the interface. Secret keys exist only on the server side.'),
  (v_privacy, 'en', '{8,2}', null,
   'A shipper does not see the carrier''s personnel contact details, and a carrier does not see the shipper''s billing details, unless the work requires it.');

  raise notice 'Заведены черновики: TERMS и PRIVACY. Активировать после проверки юристом.';
end;
$$;
