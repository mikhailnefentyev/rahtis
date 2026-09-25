-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · договор перевозчика, редакция 1 (черновик)
--
-- Текст пользователя от 25.09.2026 с правками после разбора:
--
--   · приведено к действующим TERMS v15: стол всегда подряд (2.4, 3.3),
--     перевозчик сам меняет ветку — в подряд сразу, обратно с нового
--     месяца (2.1), прямые заказы и 0 % на них (2.3, 2.5, 3.2), первый
--     месяц бесплатно (3.4), сбор вычитается из выплаты (3.5), ставки
--     фиксируются на момент завершения рейса (3.6);
--   · self-billing — отдельное явное соглашение, которого требует
--     TERMS 8.6 (12.7);
--   · tilaajavastuulaki: перечень сведений, срок годности, 7 дней на
--     запрос (4.3, 4.4); полис до допуска первой машины (4.2);
--   · ожидание: отметка прибытия в приложении — условие оплаты, 45 €
--     проходят без 3 %, раздел не касается своих клиентов (9);
--   · рынок (sennder, Saloodo, TIMOCOM, Trans.eu): уведомление об
--     изменении цены и право уйти (3.8), Aivomaa не использует клиентов
--     самостоятельного перевозчика (16.3), рейтинги (17), данные
--     водителей (5.5), сбор за месяц расторжения (19.4).
--
-- Под маркером юриста: сумма страховки, возмещение при позднем отказе,
-- роли в обработке данных водителей, запрет переманивать клиентов стола,
-- правила рейтинга, сроки претензий, зачёт и регресс, приоритет языка.
--
-- Черновик. Активация — решение пользователя. После активации
-- перевозчики принимают его вместе с TERMS и PRIVACY (accept_legal).
-- ═══════════════════════════════════════════════════════════════════

create or replace function pg_temp.c(
  p_doc uuid, p_locale text, p_path integer[], p_title text, p_body text
)
returns void
language sql
as $$
  insert into public.legal_clauses (document_id, locale, path, title, body)
  values (p_doc, p_locale, p_path, p_title, p_body);
$$;

do $$
declare
  d uuid;
  jur_fi constant text := '[Kohta täydennetään juristin kanssa: ';
  jur_en constant text := '[To be completed with a lawyer: ';
begin
  if exists (select 1 from public.legal_documents where kind = 'CARRIER_AGREEMENT') then
    raise exception 'Договор перевозчика уже заведён — новую редакцию делать от него.' using errcode = '55000';
  end if;

  insert into public.legal_documents (kind, version, status, effective_from)
  values ('CARRIER_AGREEMENT', 1, 'DRAFT', current_date)
  returning id into d;

  -- ── 1 ──────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{1}', 'Osapuolet ja sopimuksen tarkoitus', null);
  perform pg_temp.c(d, 'en', '{1}', 'Parties and purpose of the agreement', null);

  perform pg_temp.c(d, 'fi', '{1,1}', null, $b$Tämä sopimus koskee Aivomaa Oy:n ja RAHTIS-palvelua käyttävän kuljetusliikkeen välistä yhteistyötä.

Aivomaa Oy, Y-tunnus 3592993-6, Kankarepolku 5F B335, 00770 Helsinki, sähköposti admin@rahtis.eu (jäljempänä Aivomaa Oy, RAHTIS tai palveluntarjoaja).

Kuljetusliike on yritys tai ammatinharjoittaja, joka käyttää RAHTIS-palvelua kuljetustoimeksiantojen vastaanottamiseen, hallintaan, dokumentointiin, raportointiin tai laskutukseen.$b$);
  perform pg_temp.c(d, 'en', '{1,1}', null, $b$This agreement governs the cooperation between Aivomaa Oy and a carrier using the RAHTIS service.

Aivomaa Oy, business ID 3592993-6, Kankarepolku 5F B335, 00770 Helsinki, Finland, email admin@rahtis.eu (hereinafter Aivomaa Oy, RAHTIS or the service provider).

A carrier is a company or self-employed professional that uses the RAHTIS service to receive, manage, document, report or invoice transport assignments.$b$);

  perform pg_temp.c(d, 'fi', '{1,2}', null, $b$Sopimus on puitesopimus eikä velvoita Aivomaa Oy:tä tarjoamaan kuljetusliikkeelle tiettyä määrää toimeksiantoja, liikevaihtoa, ajosuoritetta tai jatkuvaa työtä. Yksittäinen kuljetustoimeksianto syntyy, kun kuljetusliike tai sen kuljettaja vahvistaa sen RAHTIS-palvelussa tai muulla Aivomaa Oy:n hyväksymällä tavalla.$b$);
  perform pg_temp.c(d, 'en', '{1,2}', null, $b$This is a framework agreement and does not oblige Aivomaa Oy to offer the carrier any particular number of assignments, turnover, mileage or continuous work. An individual transport assignment is formed when the carrier or its driver confirms it in the RAHTIS service or in another manner accepted by Aivomaa Oy.$b$);

  perform pg_temp.c(d, 'fi', '{1,3}', null, $b$Kuljetusliikkeeseen sovelletaan tämän sopimuksen lisäksi RAHTIS-palvelun käyttöehtoja, tietosuojaselostetta sekä yksittäisessä toimeksiannossa vahvistettuja ehtoja. Pakottava laki ja sovellettavat kansainväliset yleissopimukset ovat ensisijaisia.

Jos asiakirjojen välillä on ristiriita, etusijajärjestys on:
1. pakottava laki ja sovellettavat kansainväliset yleissopimukset;
2. osapuolten yksittäiseen toimeksiantoon erikseen sopimat muutokset;
3. vahvistettu toimeksianto ja sen erityisehdot;
4. tämä kuljetusliikkeen sopimus;
5. RAHTIS-käyttöehdot.$b$);
  perform pg_temp.c(d, 'en', '{1,3}', null, $b$In addition to this agreement, the carrier is subject to the RAHTIS terms of use, the privacy policy and the terms confirmed in each individual assignment. Mandatory law and applicable international conventions take precedence.

In the event of conflict between documents, the order of precedence is:
1. mandatory law and applicable international conventions;
2. changes separately agreed by the parties for an individual assignment;
3. the confirmed assignment and its special terms;
4. this carrier agreement;
5. the RAHTIS terms of use.$b$);

  -- ── 2 ──────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{2}', 'Yhteistyömallit', null);
  perform pg_temp.c(d, 'en', '{2}', 'Cooperation models', null);

  perform pg_temp.c(d, 'fi', '{2,1}', null, $b$Kuljetusliike käyttää RAHTIS-palvelua joko Alihankkija-mallissa tai Itsenäinen kuljetusliike -mallissa ja valitsee mallin itse. Mallia voi vaihtaa palvelussa. Siirtyminen Alihankkija-malliin tulee voimaan heti. Paluu Itsenäinen kuljetusliike -malliin tulee voimaan seuraavan kalenterikuukauden alusta, koska alihankintana otettu työ ajetaan loppuun sen ehdoilla. Vaihto koskee vaihdon jälkeen vahvistettuja toimeksiantoja; jo vahvistettujen ja valmistuneiden toimeksiantojen ehdot ja maksut eivät muutu.$b$);
  perform pg_temp.c(d, 'en', '{2,1}', null, $b$The carrier uses the RAHTIS service either under the Subcontractor model or under the Independent carrier model and chooses the model itself. The model can be changed in the service. A move to the Subcontractor model takes effect immediately. A return to the Independent carrier model takes effect from the beginning of the next calendar month, because work taken as subcontracting is completed on its terms. The change applies to assignments confirmed after it; the terms and fees of assignments already confirmed or completed do not change.$b$);

  perform pg_temp.c(d, 'fi', '{2,2}', null, $b$Alihankkija-mallissa kuljetusliike toimii Aivomaa Oy:n alihankkijana. Aivomaa Oy ottaa asiakkaan kuljetustilauksen vastaan omissa nimissään ja antaa sen kuljetusliikkeen suoritettavaksi: asiakkaan sopimuskumppani on Aivomaa Oy ja kuljetusliikkeen sopimuskumppani on Aivomaa Oy. Tämä koskee myös kuljetusliikkeen omia asiakkaita, joiden kuljetukset se tuo Alihankkija-mallissa palveluun: asiakkaasta tulee Aivomaa Oy:n asiakas, joka hyväksyy tilaajan sopimuksen, ja Aivomaa Oy laskuttaa sitä.

Alihankkija-mallissa RAHTIS voi hoitaa muun muassa:
- asiakkaiden ja toimeksiantojen liittämisen palveluun;
- kuljetusten raportoinnin;
- kuljetusasiakirjojen käsittelyn ja toimittamisen asiakkaalle;
- asiakkaiden laskutuksen ja maksujen vastaanottamisen;
- kuljetusliikkeelle tehtävät tilitykset;
- asiakkaiden ja muiden sopimusosapuolten taustatarkastukset;
- erikseen tarjottavat factoring- tai muut rahoituspalvelut;
- kuljettajasovelluksen ja muun RAHTIS-järjestelmän käytön.

Kuljetusliike vastaa siitä, että sen palveluun antamat asiakas-, kuljetus- ja laskutustiedot ovat oikeita.$b$);
  perform pg_temp.c(d, 'en', '{2,2}', null, $b$Under the Subcontractor model the carrier acts as a subcontractor of Aivomaa Oy. Aivomaa Oy accepts the customer's transport order in its own name and assigns it to the carrier for performance: the customer's contracting party is Aivomaa Oy and the carrier's contracting party is Aivomaa Oy. This also applies to the carrier's own customers whose transports it brings into the service under the Subcontractor model: the customer becomes a customer of Aivomaa Oy, accepts the shipper agreement and is invoiced by Aivomaa Oy.

Under the Subcontractor model RAHTIS may handle, among other things:
- connecting customers and assignments to the service;
- transport reporting;
- processing transport documents and delivering them to the customer;
- invoicing customers and receiving their payments;
- settlements to the carrier;
- background checks of customers and other contracting parties;
- separately offered factoring or other financing services;
- use of the driver app and the rest of the RAHTIS system.

The carrier is responsible for the accuracy of the customer, transport and invoicing data it enters into the service.$b$);

  perform pg_temp.c(d, 'fi', '{2,3}', null, $b$Itsenäinen kuljetusliike toimii suoraan omien asiakkaidensa sopimuskumppanina. Sama koskee palvelussa olevan tilaajan suoria tilauksia silloin, kun tilaaja on lisännyt kuljetusliikkeen ajoneuvon omiin autoihinsa ja kuljetusliike on sallinut siltä suorat tilaukset. Aivomaa Oy ei tällaisessa kuljetuksessa ole kuljetussopimuksen osapuoli eikä kuljetusmaksun vastaanottaja, vaan toimittaa palvelussa raportin tehdystä työstä.

Itsenäiselle kuljetusliikkeelle RAHTIS voi tarjota muun muassa asiakkaiden ja toimeksiantojen liittämisen järjestelmään, kuljettajasovelluksen, työvaiheiden seurannan, sähköisen dokumentoinnin, raportoinnin, rahtikirjojen ja muiden asiakirjojen käsittelyn, laskujen teknisen muodostamisen sekä laskujen lähettämisen kuljetusliikkeen puolesta asiakkaalle.

Aivomaa Oy ei vastaa kuljetusliikkeen asiakkaan maksukyvystä, maksun perinnästä tai laskun suorittamisesta, ellei siitä ole erikseen kirjallisesti sovittu.$b$);
  perform pg_temp.c(d, 'en', '{2,3}', null, $b$An independent carrier acts directly as the contracting party of its own customers. The same applies to direct orders from a shipper in the service where the shipper has added the carrier's vehicle to its own vehicles and the carrier has allowed direct orders from that shipper. In such a transport Aivomaa Oy is not a party to the contract of carriage nor the recipient of the freight charge; it provides a report of the work done in the service.

For an independent carrier RAHTIS may offer, among other things, connecting customers and assignments to the system, the driver app, tracking of work steps, electronic documentation, reporting, handling of consignment notes and other documents, technical creation of invoices and sending invoices to the customer on the carrier's behalf.

Aivomaa Oy is not responsible for the solvency of the carrier's customer, for collecting payment or for settlement of the invoice unless separately agreed in writing.$b$);

  perform pg_temp.c(d, 'fi', '{2,4}', null, $b$RAHTIS-keikkalistalta (tarjouspöydältä) otettu toimeksianto ajetaan aina Alihankkija-mallin ehdoilla riippumatta siitä, kumpaa mallia kuljetusliike muutoin käyttää. Tilaajan sopimuskumppani on Aivomaa Oy, joka laskuttaa tilaajaa, ja kuljetusliikkeelle maksetaan tilityksessä luvun 12 mukaisesti. Kuljetusliike ei laskuta keikkalistan tilaajaa suoraan.$b$);
  perform pg_temp.c(d, 'en', '{2,4}', null, $b$An assignment taken from the RAHTIS job list (the offer desk) is always performed on the terms of the Subcontractor model, whichever model the carrier otherwise uses. The shipper's contracting party is Aivomaa Oy, which invoices the shipper, and the carrier is paid in the settlement under section 12. The carrier does not invoice a job-list shipper directly.$b$);

  perform pg_temp.c(d, 'fi', '{2,5}', null, $b$Kuljetusliike päättää, mitkä tilaajat saavat lähettää suoria tilauksia sen ajoneuvoille, ja voi perua luvan milloin tahansa; peruminen ei vaikuta jo lähetettyihin tilauksiin. Suora tilaus ei mene keikkalistalle eikä sillä ole määräaikaa: se odottaa, kunnes kuljetusliike tai sen kuljettaja vahvistaa sen. Jos kuljetusliike kieltäytyy, toimeksianto julkaistaan keikkalistalla.$b$);
  perform pg_temp.c(d, 'en', '{2,5}', null, $b$The carrier decides which shippers may send direct orders to its vehicles and may withdraw the permission at any time; withdrawal does not affect orders already sent. A direct order does not go to the job list and has no deadline: it waits until the carrier or its driver confirms it. If the carrier declines, the assignment is published on the job list.$b$);

  -- ── 3 ──────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{3}', 'Palvelumaksut', null);
  perform pg_temp.c(d, 'en', '{3}', 'Service fees', null);

  perform pg_temp.c(d, 'fi', '{3,1}', null, $b$Alihankkija-mallissa RAHTIS-palvelumaksu on 3 prosenttia jokaisen RAHTIS-palvelun kautta käsitellyn toimeksiannon kuljetushinnasta ilman arvonlisäveroa. Maksu koskee myös kuljetusliikkeen omille asiakkaille palvelun kautta tehtyjä kuljetuksia ja keikkalistalta vastaanotettuja toimeksiantoja, ellei osapuolten välillä ole kirjallisesti sovittu toisin. Palvelumaksu vähennetään kuljetusliikkeelle tehtävästä tilityksestä. Ajoneuvokohtaista kuukausimaksua ei tällöin peritä.$b$);
  perform pg_temp.c(d, 'en', '{3,1}', null, $b$Under the Subcontractor model the RAHTIS service fee is 3 per cent of the freight price, excluding value added tax, of each assignment handled through the RAHTIS service. The fee also applies to transports carried out for the carrier's own customers through the service and to assignments taken from the job list, unless otherwise agreed in writing. The service fee is deducted from the settlement to the carrier. No monthly vehicle fee is charged in this case.$b$);

  perform pg_temp.c(d, 'fi', '{3,2}', null, $b$Itsenäinen kuljetusliike maksaa RAHTIS-palvelusta 29,90 euroa ilman arvonlisäveroa kalenterikuukaudessa jokaisesta ajoneuvosta, jolla on kyseisen kuukauden aikana merkitty valmiiksi vähintään yksi RAHTIS-palvelussa käsitelty toimeksianto. Pelkästään palveluun rekisteröidystä ajoneuvosta ei makseta. Kuljetusliikkeen omien asiakkaiden kuljetuksista ja kohdan 2.3 mukaisista suorista tilauksista ei peritä prosenttiosuutta.$b$);
  perform pg_temp.c(d, 'en', '{3,2}', null, $b$An independent carrier pays for the RAHTIS service 29.90 euros excluding value added tax per calendar month for each vehicle that has at least one assignment handled in the RAHTIS service marked as completed during that month. No fee is paid for a vehicle merely registered in the service. No percentage is charged on transports for the carrier's own customers or on direct orders under section 2.3.$b$);

  perform pg_temp.c(d, 'fi', '{3,3}', null, $b$Itsenäisellä kuljetusliikkeellä on pääsy keikkalistalle. Keikkalistalta vastaanotettuun toimeksiantoon sovelletaan kohdan 2.4 mukaisesti Alihankkija-mallin ehtoja ja 3 prosentin palvelumaksua toimeksiannon kuljetushinnasta. Kuukausimaksu ei poista tätä palvelumaksua.$b$);
  perform pg_temp.c(d, 'en', '{3,3}', null, $b$An independent carrier has access to the job list. An assignment taken from the job list is subject, under section 2.4, to the terms of the Subcontractor model and to a service fee of 3 per cent of its freight price. The monthly fee does not remove this service fee.$b$);

  perform pg_temp.c(d, 'fi', '{3,4}', null, $b$Kuljetusliikkeen hyväksymiskuukauden loppuosa ja sitä seuraava kokonainen kalenterikuukausi ovat maksuttomia. Jos kuljetusliike hyväksytään kuukauden ensimmäisenä päivänä, maksuton on kyseinen kuukausi.$b$);
  perform pg_temp.c(d, 'en', '{3,4}', null, $b$The remainder of the month in which the carrier is approved and the following full calendar month are free of charge. If the carrier is approved on the first day of a month, that month is free of charge.$b$);

  perform pg_temp.c(d, 'fi', '{3,5}', null, $b$Kuukausimaksu vähennetään kuljetusliikkeelle maksettavasta tilityksestä, jos tilitystä on. Jos tilitystä ei ole tai se ei riitä, kattamaton osa laskutetaan kuukauden päätyttyä 14 päivän maksuajalla.$b$);
  perform pg_temp.c(d, 'en', '{3,5}', null, $b$The monthly fee is deducted from the settlement payable to the carrier, if there is one. If there is no settlement or it is insufficient, the uncovered part is invoiced after the end of the month with 14 days' payment terms.$b$);

  perform pg_temp.c(d, 'fi', '{3,6}', null, $b$Toimeksiannon valmistumishetkellä voimassa olevat maksut kirjataan kyseiselle toimeksiannolle, eivätkä myöhemmät muutokset vaikuta jo valmistuneisiin toimeksiantoihin. Luvun 9 mukaisesta odotusaikalisästä ei peritä palvelumaksua.$b$);
  perform pg_temp.c(d, 'en', '{3,6}', null, $b$The fees in force when an assignment is completed are recorded on that assignment, and later changes do not affect assignments already completed. No service fee is charged on the waiting time surcharge under section 9.$b$);

  perform pg_temp.c(d, 'fi', '{3,7}', null, $b$Arvonlisävero määräytyy sopimuskumppanin maan mukaan: suomalaiselle yritykselle lisätään 25,5 prosenttia, muun maan yritykselle sovelletaan käännettyä verovelvollisuutta, jolloin myyjä laskuttaa nollalla ja ostaja tilittää veron omassa maassaan.$b$);
  perform pg_temp.c(d, 'en', '{3,7}', null, $b$Value added tax is determined by the country of the contracting party: 25.5 per cent is added for a Finnish company, and the reverse charge applies to a company from another country, in which case the seller invoices at zero and the buyer accounts for the tax in its own country.$b$);

  perform pg_temp.c(d, 'fi', '{3,8}', null, $b$Aivomaa Oy ilmoittaa palvelumaksujen muutoksista palvelussa ja sähköpostitse vähintään 30 päivää ennen niiden voimaantuloa. Jos kuljetusliike ei hyväksy korotusta, se voi päättää sopimuksen ennen muutoksen voimaantuloa ilman kuluja. Muutos ei koske ennen voimaantuloa vahvistettuja toimeksiantoja.$b$);
  perform pg_temp.c(d, 'en', '{3,8}', null, $b$Aivomaa Oy announces changes to service fees in the service and by email at least 30 days before they take effect. If the carrier does not accept an increase, it may terminate the agreement before the change takes effect at no cost. A change does not apply to assignments confirmed before it takes effect.$b$);

  -- ── 4 ──────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{4}', 'Luvat, vakuutukset ja tilaajavastuu', null);
  perform pg_temp.c(d, 'en', '{4}', 'Licences, insurance and contractor''s liability', null);

  perform pg_temp.c(d, 'fi', '{4,1}', null, $b$Kuljetusliike vastaa siitä, että sillä on koko sopimussuhteen ajan toimintansa edellyttämät luvat, vakuutukset, kalusto ja ammatilliset valmiudet. Kuljetusliikkeellä tulee olla vähintään:
- voimassa oleva tavaraliikenteen liikennelupa silloin, kun laki sitä edellyttää;
- voimassa oleva liikennevakuutus;
- voimassa oleva CMR-/kuljetusvastuuvakuutus, jonka vakuutusmäärä kattaa vähintään kuljetusliikkeen lain mukaisen enimmäisvastuun yhdestä kuormasta;
- ADR-luvat ja muut erityisluvat silloin, kun kyseinen kuljetus niitä edellyttää;
- lain edellyttämät kuljettajien ajo-oikeudet, ammattipätevyydet ja muut pätevyydet.

$b$ || jur_fi || $b$vastuuvakuutuksen vähimmäismäärä euroina.]$b$);
  perform pg_temp.c(d, 'en', '{4,1}', null, $b$The carrier is responsible for holding, throughout the contractual relationship, the licences, insurance, equipment and professional competence required for its operations. The carrier must have at least:
- a valid goods transport licence where required by law;
- valid motor liability insurance;
- valid CMR/carrier's liability insurance with a sum insured covering at least the carrier's maximum statutory liability for one load;
- ADR and other special permits where the transport in question requires them;
- the driving licences, professional qualifications and other competences of drivers required by law.

$b$ || jur_en || $b$minimum sum insured of the liability insurance in euros.]$b$);

  perform pg_temp.c(d, 'fi', '{4,2}', null, $b$Kuljetusliike lataa palveluun liikenneluvan sekä liikenne- ja vastuuvakuutuksen todistukset ennen kuin sen ensimmäinen ajoneuvo hyväksytään. Jokainen ajoneuvo hyväksytään erikseen, ja keikkalista näkyy vain kuljetusliikkeelle, jolla on vähintään yksi hyväksytty ajoneuvo ja voimassa olevat asiakirjat.$b$);
  perform pg_temp.c(d, 'en', '{4,2}', null, $b$The carrier uploads its transport licence and certificates of motor and liability insurance to the service before its first vehicle is approved. Each vehicle is approved separately, and the job list is visible only to a carrier with at least one approved vehicle and valid documents.$b$);

  perform pg_temp.c(d, 'fi', '{4,3}', null, $b$Tilaajavastuulain edellyttäessä kuljetusliike toimittaa Aivomaa Oy:lle enintään kolme kuukautta vanhat selvitykset:
- merkinnästä ennakkoperintärekisteriin, työnantajarekisteriin ja arvonlisäverorekisteriin;
- verojen maksamisesta (verovelkatodistus tai selvitys verovelan määrästä);
- eläkevakuutusten ottamisesta ja maksamisesta;
- työterveyshuollon järjestämisestä;
- sovellettavasta työehtosopimuksesta tai keskeisistä työehdoista.

Selvitykset päivitetään vähintään 12 kuukauden välein. Aivomaa Oy voi hankkia julkisista rekistereistä (esimerkiksi PRH, YTJ, verovelkarekisteri) saatavat tiedot itse.$b$);
  perform pg_temp.c(d, 'en', '{4,3}', null, $b$Where the Contractor's Liability Act requires it, the carrier provides Aivomaa Oy with reports no older than three months on:
- registration in the prepayment register, the employer register and the VAT register;
- payment of taxes (tax debt certificate or a report on the amount of tax debt);
- taking out and paying pension insurance;
- arranging occupational health care;
- the applicable collective agreement or the key terms of employment.

The reports are updated at least every 12 months. Aivomaa Oy may obtain information available from public registers (for example the Finnish Patent and Registration Office, the Business Information System and the tax debt register) itself.$b$);

  perform pg_temp.c(d, 'fi', '{4,4}', null, $b$Kuljetusliike toimittaa pyydetyt luvat, vakuutustodistukset, pätevyydet ja kohdan 4.3 selvitykset seitsemän päivän kuluessa pyynnöstä. Jos vaadittu asiakirja ei ole voimassa tai sitä ei toimiteta määräajassa, Aivomaa Oy voi keskeyttää uusien toimeksiantojen tarjoamisen, kunnes asia on selvitetty.$b$);
  perform pg_temp.c(d, 'en', '{4,4}', null, $b$The carrier provides the requested licences, insurance certificates, qualifications and the reports under section 4.3 within seven days of the request. If a required document is not valid or is not provided in time, Aivomaa Oy may suspend offering new assignments until the matter is resolved.$b$);

  perform pg_temp.c(d, 'fi', '{4,5}', null, $b$Kuljetusliike vastaa käyttämänsä kaluston liikennekelpoisuudesta, turvallisuudesta ja soveltuvuudesta hyväksyttyyn toimeksiantoon.$b$);
  perform pg_temp.c(d, 'en', '{4,5}', null, $b$The carrier is responsible for the roadworthiness, safety and suitability of its equipment for the accepted assignment.$b$);

  -- ── 5 ──────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{5}', 'Kuljettajat ja RAHTIS-sovellus', null);
  perform pg_temp.c(d, 'en', '{5}', 'Drivers and the RAHTIS app', null);

  perform pg_temp.c(d, 'fi', '{5,1}', null, $b$Kuljetusliike ilmoittaa palveluun kuljettajansa ja liittää heidät ajoneuvoihin. Ajoneuvo, jolla ei ole kuljettajaa, ei voi ottaa toimeksiantoja. Kuljettajan vaihtaminen ei poista ajoneuvon hyväksyntää.$b$);
  perform pg_temp.c(d, 'en', '{5,1}', null, $b$The carrier registers its drivers in the service and assigns them to vehicles. A vehicle without a driver cannot take assignments. Changing the driver does not remove the vehicle's approval.$b$);

  perform pg_temp.c(d, 'fi', '{5,2}', null, $b$Kuljetusliike vastaa siitä, että sen kuljettajat noudattavat RAHTIS-sovelluksessa toimeksiannolle määriteltyjä työvaiheita. Niihin voivat kuulua muun muassa:
- saapumisen kirjaaminen;
- noudon tai vastaanoton vahvistaminen;
- sijaintitiedon tallentaminen;
- lastauksen tai purun työvaiheet;
- perävaunun tai kontin vastaanotto ja luovutus;
- valokuvien ottaminen ja olemassa olevien vaurioiden dokumentointi;
- sinetin tai muiden tunnistetietojen kirjaaminen;
- rahtikirjan, CMR:n, POD:n tai muun asiakirjan lataaminen;
- toimeksiannon valmistumisen vahvistaminen.$b$);
  perform pg_temp.c(d, 'en', '{5,2}', null, $b$The carrier is responsible for its drivers following the work steps defined for the assignment in the RAHTIS app. These may include, among other things:
- recording arrival;
- confirming pick-up or receipt;
- saving location data;
- loading or unloading steps;
- receiving and handing over the trailer or container;
- taking photographs and documenting existing damage;
- recording the seal or other identifiers;
- uploading the consignment note, CMR, POD or other document;
- confirming completion of the assignment.$b$);

  perform pg_temp.c(d, 'fi', '{5,3}', null, $b$Jos työvaiheeseen kuuluu perävaunun tai kontin kunnon dokumentointi, sovelluksessa voidaan edellyttää kuvia yksikön kaikilta neljältä sivulta sekä havaituista vaurioista. Toimeksiannolle pakollisiksi määritetyt dokumentointivaiheet on suoritettava.$b$);
  perform pg_temp.c(d, 'en', '{5,3}', null, $b$Where a work step includes documenting the condition of the trailer or container, the app may require photographs of all four sides of the unit and of any damage found. Documentation steps defined as mandatory for the assignment must be completed.$b$);

  perform pg_temp.c(d, 'fi', '{5,4}', null, $b$Sovelluksen työvaiheita voidaan kehittää ja teknisesti muuttaa ilman tämän sopimuksen muuttamista, kun muutos ei olennaisesti muuta jo vahvistetun toimeksiannon hintaa tai oikeudellista sisältöä.$b$);
  perform pg_temp.c(d, 'en', '{5,4}', null, $b$The app's work steps may be developed and technically changed without amending this agreement where the change does not materially alter the price or legal content of an assignment already confirmed.$b$);

  perform pg_temp.c(d, 'fi', '{5,5}', null, $b$Aivomaa Oy käsittelee kuljettajien henkilötietoja (nimi, puhelinnumero, sijainti kuittaushetkillä, valokuvat, työaikamerkinnät) tietosuojaselosteensa mukaisesti. Kuljetusliike kertoo kuljettajilleen käsittelystä ja ohjaa heidät tietosuojaselosteeseen ennen sovelluksen käyttöönottoa. $b$ || jur_fi || $b$osapuolten roolit rekisterinpitäjänä tai käsittelijänä ja mahdollinen käsittelysopimus.]$b$);
  perform pg_temp.c(d, 'en', '{5,5}', null, $b$Aivomaa Oy processes drivers' personal data (name, phone number, location at confirmation moments, photographs, working time entries) in accordance with its privacy policy. The carrier informs its drivers of the processing and refers them to the privacy policy before they start using the app. $b$ || jur_en || $b$the parties' roles as controller or processor and any data processing agreement.]$b$);

  -- ── 6 ──────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{6}', 'Toimeksiannon vastaanottaminen', null);
  perform pg_temp.c(d, 'en', '{6}', 'Accepting an assignment', null);

  perform pg_temp.c(d, 'fi', '{6,1}', null, $b$Kuljetusliike arvioi ennen toimeksiannon vahvistamista, että kalusto soveltuu tehtävään, kuljettaja voi suorittaa tehtävän lainmukaisesti, ilmoitetut aikataulut ovat realistisia, tarvittavat luvat ja pätevyydet ovat voimassa ja toimeksiannon erityisvaatimukset voidaan täyttää.$b$);
  perform pg_temp.c(d, 'en', '{6,1}', null, $b$Before confirming an assignment the carrier assesses that the equipment is suitable, the driver can perform the task lawfully, the stated schedules are realistic, the necessary licences and qualifications are valid and the special requirements of the assignment can be met.$b$);

  perform pg_temp.c(d, 'fi', '{6,2}', null, $b$Sitova kuljetussopimus syntyy, kun kuljetusliike tai sen kuljettaja vahvistaa toimeksiannon. Keikkalistalla tilaajan valinnalla ja kuljetusliikkeen vahvistuksella on kummallakin palvelussa ilmoitettu määräaika, jonka jälkeen toimeksianto palaa tarjottavaksi.$b$);
  perform pg_temp.c(d, 'en', '{6,2}', null, $b$A binding contract of carriage is formed when the carrier or its driver confirms the assignment. On the job list the shipper's choice and the carrier's confirmation each have a deadline stated in the service, after which the assignment returns to the offer.$b$);

  perform pg_temp.c(d, 'fi', '{6,3}', null, $b$Kuljetusliike ei saa suorittaa toimeksiantoa tavalla, joka edellyttää ylikuormaa, ajo- ja lepoaikasääntöjen tai muun työaikalainsäädännön rikkomista, liikenneturvallisuuden vaarantamista, puutteellisilla luvilla toimimista tai muuta lainvastaista tai ilmeisen vaarallista menettelyä.$b$);
  perform pg_temp.c(d, 'en', '{6,3}', null, $b$The carrier must not perform an assignment in a manner requiring overloading, breach of driving and rest time rules or other working time legislation, endangering road safety, operating with deficient licences or any other unlawful or obviously dangerous conduct.$b$);

  -- ── 7 ──────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{7}', 'Toimeksiannon peruminen ja keskeytyminen', null);
  perform pg_temp.c(d, 'en', '{7}', 'Cancellation and interruption of an assignment', null);

  perform pg_temp.c(d, 'fi', '{7,1}', null, $b$Kuljetusliike voi perua vahvistamansa toimeksiannon ennen kuorman, perävaunun tai kontin tosiasiallista vastaanottamista. Toimeksianto palautetaan keikkalistalle uuden suorittajan löytämiseksi. Pelkästä perumisesta ei peritä sopimussakkoa. Tilaaja voi ottaa perumisen huomioon kuljetusliikkeen arvioinnissa. $b$ || jur_fi || $b$myöhäisen perumisen (esimerkiksi alle 12 tuntia ennen noutoa) osoitettujen korvaavan suorittajan lisäkulujen korvaaminen.]$b$);
  perform pg_temp.c(d, 'en', '{7,1}', null, $b$The carrier may cancel an assignment it has confirmed before actually receiving the cargo, trailer or container. The assignment is returned to the job list to find a new performer. No contractual penalty is charged for cancellation alone. The shipper may take the cancellation into account in its rating of the carrier. $b$ || jur_en || $b$compensation of proven additional costs of a replacement performer in the event of late cancellation (for example less than 12 hours before pick-up).]$b$);

  perform pg_temp.c(d, 'fi', '{7,2}', null, $b$Kun kuljetusliike on tosiasiallisesti vastaanottanut kuorman, perävaunun tai kontin, toimeksiantoa ei saa keskeyttää siten, että kuorma tai yksikkö jätetään ilman asianmukaista säilytystä, valvontaa tai luovutusta.$b$);
  perform pg_temp.c(d, 'en', '{7,2}', null, $b$Once the carrier has actually received the cargo, trailer or container, the assignment must not be interrupted in a way that leaves the cargo or unit without proper storage, supervision or handover.$b$);

  perform pg_temp.c(d, 'fi', '{7,3}', null, $b$Jos kuljetuksen jatkaminen estyy esimerkiksi ajoneuvon rikkoutumisen, liikenneonnettomuuden, kuljettajan sairastumisen, viranomaismääräyksen, tien sulkeutumisen, lauttaliikenteen häiriön tai muun vakavan ja perustellun syyn vuoksi, kuljetusliike ilmoittaa tilanteesta viipymättä Aivomaa Oy:lle. Jatkotoimista, mahdollisesta suorittajan vaihdosta, kuorman tai yksikön luovutuksesta sekä kustannuksista sovitaan tapauskohtaisesti olosuhteet ja sovellettava laki huomioon ottaen.$b$);
  perform pg_temp.c(d, 'en', '{7,3}', null, $b$If continuing the transport is prevented, for example by a vehicle breakdown, a traffic accident, the driver falling ill, an order of an authority, a road closure, a ferry disruption or another serious and justified reason, the carrier notifies Aivomaa Oy without delay. Further measures, any change of performer, handover of the cargo or unit and costs are agreed case by case taking into account the circumstances and the applicable law.$b$);

  -- ── 8 ──────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{8}', 'Muutokset toimeksiantoon', null);
  perform pg_temp.c(d, 'en', '{8}', 'Changes to an assignment', null);

  perform pg_temp.c(d, 'fi', '{8,1}', null, $b$Kuljettaja ei saa itsenäisesti sopia asiakkaan kanssa kuljetushinnan, reitin, lisätyön tai muiden kaupallisten ehtojen muutoksesta Aivomaa Oy:tä sitovasti.$b$);
  perform pg_temp.c(d, 'en', '{8,1}', null, $b$A driver must not independently agree with the customer on changes to the freight price, route, additional work or other commercial terms in a manner binding on Aivomaa Oy.$b$);

  perform pg_temp.c(d, 'fi', '{8,2}', null, $b$Jos tilaaja pyytää reitin muutosta, lisänoutoa tai lisäpurkua, ylimääräisiä kilometrejä, lisätyötä tai muuta alkuperäisestä toimeksiannosta poikkeavaa suoritusta, kuljetusliike tai kuljettaja ilmoittaa pyynnöstä RAHTIS-palvelussa tai Aivomaa Oy:lle ennen muutoksen suorittamista, mikäli se olosuhteet huomioon ottaen on mahdollista. Aivomaa Oy vahvistaa tarvittaessa, voidaanko muutos toteuttaa, sen hinnan, vaikutuksen aikatauluun ja muut muuttuneet ehdot.$b$);
  perform pg_temp.c(d, 'en', '{8,2}', null, $b$If the shipper requests a route change, an additional pick-up or drop, extra kilometres, additional work or other performance deviating from the original assignment, the carrier or driver reports the request in the RAHTIS service or to Aivomaa Oy before carrying out the change, where possible in the circumstances. Aivomaa Oy confirms where necessary whether the change can be made, its price, its effect on the schedule and other changed terms.$b$);

  perform pg_temp.c(d, 'fi', '{8,3}', null, $b$Välittömässä turvallisuustilanteessa kuljettaja saa ryhtyä tarpeellisiin toimiin vahingon estämiseksi tai rajoittamiseksi ilman ennakkovahvistusta. Tilanteesta ilmoitetaan Aivomaa Oy:lle viipymättä.$b$);
  perform pg_temp.c(d, 'en', '{8,3}', null, $b$In an immediate safety situation the driver may take the measures necessary to prevent or limit damage without prior confirmation. Aivomaa Oy is notified of the situation without delay.$b$);

  -- ── 9 ──────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{9}', 'Lastaus, purku ja odotusaika', null);
  perform pg_temp.c(d, 'en', '{9}', 'Loading, unloading and waiting time', null);

  perform pg_temp.c(d, 'fi', '{9,1}', null, $b$Tämä luku koskee toimeksiantoja, joissa Aivomaa Oy on tilaajan sopimuskumppani (Alihankkija-malli ja keikkalista). Itsenäisen kuljetusliikkeen omien asiakkaiden kuljetuksissa odotusajasta sovitaan kuljetusliikkeen ja asiakkaan kesken.$b$);
  perform pg_temp.c(d, 'en', '{9,1}', null, $b$This section applies to assignments in which Aivomaa Oy is the shipper's contracting party (the Subcontractor model and the job list). For transports of an independent carrier's own customers, waiting time is agreed between the carrier and the customer.$b$);

  perform pg_temp.c(d, 'fi', '{9,2}', null, $b$Kuljetuksen hintaan sisältyy erikseen 1 tunti lastaukseen ja erikseen 1 tunti purkuun. Toisen työvaiheen käyttämätöntä aikaa ei siirretä toiseen. Kun maksuton aika ylittyy, kuljetusliikkeelle maksetaan 45 euroa ilman arvonlisäveroa jokaiselta alkavalta ylitystunnilta, lastaus ja purku erikseen laskien. Lisä maksetaan tilityksessä kokonaisuudessaan ilman palvelumaksua.$b$);
  perform pg_temp.c(d, 'en', '{9,2}', null, $b$The freight price includes 1 hour for loading and, separately, 1 hour for unloading. Unused time from one operation is not carried over to the other. When the free time is exceeded, the carrier is paid 45 euros excluding value added tax for each hour of excess begun, calculated separately for loading and unloading. The surcharge is paid in full in the settlement without a service fee.$b$);

  perform pg_temp.c(d, 'fi', '{9,3}', null, $b$Esimerkiksi: lastaus 1 h 15 min - 45 euroa; lastaus 2 h 15 min - 90 euroa; lastaus 1 h 15 min ja purku 1 h 10 min - yhteensä 90 euroa.$b$);
  perform pg_temp.c(d, 'en', '{9,3}', null, $b$For example: loading 1 h 15 min - 45 euros; loading 2 h 15 min - 90 euros; loading 1 h 15 min and unloading 1 h 10 min - 90 euros in total.$b$);

  perform pg_temp.c(d, 'fi', '{9,4}', null, $b$Aika lasketaan siitä, kun kyseiseen työvaiheeseen valmis ajoneuvo on saapunut paikalle, kuitenkin aikaisintaan sovitusta saapumisajasta, siihen asti, kun työvaihe on tosiasiallisesti valmis. Kuljetusliikkeen, kuljettajan tai kaluston vastuulla olevasta syystä aiheutunutta viivettä ei lasketa maksulliseksi odotusajaksi.$b$);
  perform pg_temp.c(d, 'en', '{9,4}', null, $b$Time is counted from the arrival of a vehicle ready for the operation concerned, but no earlier than the agreed arrival time, until the operation is actually completed. Delay caused by reasons for which the carrier, the driver or the equipment is responsible is not counted as chargeable waiting time.$b$);

  perform pg_temp.c(d, 'fi', '{9,5}', null, $b$Odotusaikalisän edellytys on, että kuljettaja on kirjannut saapumisen ja työvaiheen valmistumisen RAHTIS-sovellukseen niiden tapahtuessa. Jos sovellusta ei voi käyttää, ajat ja muu näyttö (asiakirjat, valokuvat, kohteen merkinnät) toimitetaan Aivomaa Oy:lle samana päivänä. Muuten odotusaikaa ei korvata.$b$);
  perform pg_temp.c(d, 'en', '{9,5}', null, $b$The waiting time surcharge requires that the driver has recorded arrival and completion of the operation in the RAHTIS app as they happen. If the app cannot be used, the times and other evidence (documents, photographs, site records) are delivered to Aivomaa Oy on the same day. Otherwise waiting time is not compensated.$b$);

  -- ── 10 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{10}', 'Lautat ja muut varaukset', null);
  perform pg_temp.c(d, 'en', '{10}', 'Ferries and other bookings', null);

  perform pg_temp.c(d, 'fi', '{10,1}', null, $b$Kun toimeksiantoon kuuluu lauttamatka tai muu varaus, toimeksiannossa tai erillisessä ohjeessa määritetään mahdollisuuksien mukaan varauksen tekijä, lähtöaika, check-in-aika, rekisteri- tai ajoneuvotiedot ja muut tarvittavat varaustiedot.$b$);
  perform pg_temp.c(d, 'en', '{10,1}', null, $b$Where an assignment includes a ferry crossing or another booking, the assignment or a separate instruction specifies where possible who makes the booking, the departure time, the check-in time, registration or vehicle details and other necessary booking details.$b$);

  perform pg_temp.c(d, 'fi', '{10,2}', null, $b$Jos kuljetusliike tai kuljettaja havaitsee riskin myöhästymisestä, siitä ilmoitetaan viipymättä Aivomaa Oy:lle.$b$);
  perform pg_temp.c(d, 'en', '{10,2}', null, $b$If the carrier or driver sees a risk of being late, Aivomaa Oy is notified without delay.$b$);

  perform pg_temp.c(d, 'fi', '{10,3}', null, $b$Lautan no-show-, uudelleenvaraus- tai muut vastaavat kulut kohdistetaan vastuussa olevaan osapuoleen sovellettavan lain, syy-yhteyden ja tosiasiallisten kulujen perusteella. RAHTIS ei määrää erillistä sopimussakkoa pelkästä lautalta myöhästymisestä.$b$);
  perform pg_temp.c(d, 'en', '{10,3}', null, $b$Ferry no-show, rebooking or similar costs are allocated to the responsible party on the basis of the applicable law, causation and actual costs. RAHTIS imposes no separate contractual penalty merely for missing a ferry.$b$);

  -- ── 11 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{11}', 'Rahtikirjat ja muut asiakirjat', null);
  perform pg_temp.c(d, 'en', '{11}', 'Consignment notes and other documents', null);

  perform pg_temp.c(d, 'fi', '{11,1}', null, $b$Allekirjoitettu rahtikirja, CMR, POD tai muu toimeksiannossa vaadittu asiakirja ladataan RAHTIS-palveluun viivytyksettä sen saamisen jälkeen. Toimeksiantoa ei voi merkitä valmiiksi ennen kuin rahtikirja on liitetty siihen.$b$);
  perform pg_temp.c(d, 'en', '{11,1}', null, $b$The signed consignment note, CMR, POD or other document required in the assignment is uploaded to the RAHTIS service without delay after it is received. An assignment cannot be marked as completed before the consignment note is attached to it.$b$);

  perform pg_temp.c(d, 'fi', '{11,2}', null, $b$Alihankkija-mallissa kuljetusliike toimittaa Aivomaa Oy:lle myös ne alkuperäiset paperiset asiakirjat, joiden fyysistä toimittamista asiakas, viranomainen tai toimeksiannon luonne edellyttää. Aivomaa Oy voi käsitellä ja edelleen toimittaa asiakirjat asiakkaalle.$b$);
  perform pg_temp.c(d, 'en', '{11,2}', null, $b$Under the Subcontractor model the carrier also delivers to Aivomaa Oy the original paper documents whose physical delivery is required by the customer, an authority or the nature of the assignment. Aivomaa Oy may process the documents and forward them to the customer.$b$);

  perform pg_temp.c(d, 'fi', '{11,3}', null, $b$Jos vaadittua asiakirjaa ei ole mahdollista saada, kuljetusliike ilmoittaa syyn Aivomaa Oy:lle ja toimittaa käytettävissä olevan muun näytön kuljetuksen suorittamisesta.$b$);
  perform pg_temp.c(d, 'en', '{11,3}', null, $b$If it is not possible to obtain a required document, the carrier informs Aivomaa Oy of the reason and delivers the other available evidence of performance of the transport.$b$);

  -- ── 12 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{12}', 'Tilitys ja maksaminen Alihankkija-mallissa ja keikkalistalla', null);
  perform pg_temp.c(d, 'en', '{12}', 'Settlement and payment under the Subcontractor model and on the job list', null);

  perform pg_temp.c(d, 'fi', '{12,1}', null, $b$Tilityskaudet ovat kuukauden 1.–15. päivä sekä 16. päivästä kuukauden viimeiseen päivään. Toimeksianto kuuluu siihen kauteen, jonka aikana se on merkitty valmiiksi.$b$);
  perform pg_temp.c(d, 'en', '{12,1}', null, $b$The settlement periods are days 1–15 of the month and from the 16th to the last day of the month. An assignment belongs to the period during which it was marked as completed.$b$);

  perform pg_temp.c(d, 'fi', '{12,2}', null, $b$Aivomaa Oy muodostaa kuljetusliikkeelle tilityksen kaudella valmiiksi merkityistä toimeksiannoista sekä vahvistetuista lisistä. Kuljetusliikkeelle maksettava summa erääntyy 30 kalenteripäivän kuluttua tilityskauden päättymisestä riippumatta siitä, onko tilaaja jo maksanut Aivomaa Oy:lle. Esimerkiksi 1.–15. syyskuuta valmistuneet työt maksetaan viimeistään 15. lokakuuta ja 16.–30. syyskuuta valmistuneet työt viimeistään 30. lokakuuta.$b$);
  perform pg_temp.c(d, 'en', '{12,2}', null, $b$Aivomaa Oy draws up a settlement for the carrier of the assignments marked as completed during the period and of confirmed surcharges. The amount payable to the carrier falls due 30 calendar days after the end of the settlement period, regardless of whether the shipper has already paid Aivomaa Oy. For example, work completed on 1–15 September is paid by 15 October at the latest and work completed on 16–30 September by 30 October at the latest.$b$);

  perform pg_temp.c(d, 'fi', '{12,3}', null, $b$Tilityksestä voidaan vähentää tämän sopimuksen mukainen 3 prosentin palvelumaksu ja kuukausimaksu, kuljetusliikkeen hyväksymät muut palvelumaksut, erikseen sovitut factoring- tai rahoituskulut sekä lain mukaan kuittauskelpoiset riidattomat saatavat. Riidanalainen vaatimus ei oikeuta pidättämään koko tilitystä, jos muu osa saatavasta on riidaton. $b$ || jur_fi || $b$kuittauksen tarkemmat ehdot.]$b$);
  perform pg_temp.c(d, 'en', '{12,3}', null, $b$The 3 per cent service fee and the monthly fee under this agreement, other service fees accepted by the carrier, separately agreed factoring or financing costs and undisputed receivables eligible for set-off by law may be deducted from the settlement. A disputed claim does not entitle withholding the entire settlement if the rest of the receivable is undisputed. $b$ || jur_en || $b$detailed terms of set-off.]$b$);

  perform pg_temp.c(d, 'fi', '{12,4}', null, $b$Jos maksun eräpäivä osuu Suomessa pankkien vapaapäivälle, maksu voidaan tehdä seuraavana pankkipäivänä. Viivästyneelle maksulle määräytyy korko sovellettavan lain mukaan.$b$);
  perform pg_temp.c(d, 'en', '{12,4}', null, $b$If the due date falls on a bank holiday in Finland, payment may be made on the next banking day. Interest on late payment is determined under the applicable law.$b$);

  perform pg_temp.c(d, 'fi', '{12,5}', null, $b$Kuljetusliike hyväksyy, että Aivomaa Oy laatii kuljetusliikkeen puolesta laskun kauden tilityksestä (itselaskutus). Laskussa on merkintä "Itselaskutus", ja se toimitetaan kuljetusliikkeelle palvelussa ja sähköpostitse. Kuljetusliike tarkistaa laskun ja esittää huomautuksensa seitsemän päivän kuluessa sen saamisesta; muutoin lasku katsotaan hyväksytyksi. Kuljetusliike ei laadi samoista toimeksiannoista erillistä laskua ja ilmoittaa viipymättä muutoksista arvonlisäverovelvollisuudessaan, y-tunnuksessaan tai pankkitiedoissaan. Kuljetusliike voi päättää itselaskutuksen ilmoittamalla siitä; tämän jälkeen se laskuttaa tilityksen mukaisesti itse.$b$);
  perform pg_temp.c(d, 'en', '{12,5}', null, $b$The carrier accepts that Aivomaa Oy draws up the invoice for the period's settlement on the carrier's behalf (self-billing). The invoice bears the marking "Self-billing" and is delivered to the carrier in the service and by email. The carrier checks the invoice and makes any objections within seven days of receiving it; otherwise the invoice is deemed accepted. The carrier does not issue a separate invoice for the same assignments and notifies without delay any changes in its VAT liability, business ID or bank details. The carrier may end self-billing by giving notice; thereafter it invoices itself in accordance with the settlement.$b$);

  perform pg_temp.c(d, 'fi', '{12,6}', null, $b$Nopeutetusta maksusta tai factoringista voidaan sopia erikseen; sen hinta ilmoitetaan ennen käyttöönottoa.$b$);
  perform pg_temp.c(d, 'en', '{12,6}', null, $b$Accelerated payment or factoring may be agreed separately; its price is stated before it is taken into use.$b$);

  -- ── 13 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{13}', 'Maksaminen Itsenäinen kuljetusliike -mallissa', null);
  perform pg_temp.c(d, 'en', '{13}', 'Payment under the Independent carrier model', null);

  perform pg_temp.c(d, 'fi', '{13,1}', null, $b$Itsenäinen kuljetusliike laskuttaa omia asiakkaitaan ja kohdan 2.3 suorien tilausten tilaajia omissa nimissään, ja asiakas maksaa kuljetusmaksun suoraan kuljetusliikkeelle. RAHTIS voi teknisesti muodostaa tai lähettää laskun kuljetusliikkeen puolesta; tämä ei tee Aivomaa Oy:stä laskun velkojaa tai maksun vastaanottajaa. Aivomaa Oy ei vastaa asiakkaan maksun viivästymisestä, maksukyvyttömyydestä tai perinnästä.$b$);
  perform pg_temp.c(d, 'en', '{13,1}', null, $b$An independent carrier invoices its own customers and shippers of direct orders under section 2.3 in its own name, and the customer pays the freight charge directly to the carrier. RAHTIS may technically create or send the invoice on the carrier's behalf; this does not make Aivomaa Oy the creditor of the invoice or the recipient of the payment. Aivomaa Oy is not responsible for late payment, insolvency or collection concerning the customer.$b$);

  perform pg_temp.c(d, 'fi', '{13,2}', null, $b$Keikkalistalta otettu toimeksianto tilitetään luvun 12 mukaisesti.$b$);
  perform pg_temp.c(d, 'en', '{13,2}', null, $b$An assignment taken from the job list is settled under section 12.$b$);

  -- ── 14 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{14}', 'Toimeksiannon siirtäminen toiselle kuljetusliikkeelle', null);
  perform pg_temp.c(d, 'en', '{14}', 'Passing an assignment to another carrier', null);

  perform pg_temp.c(d, 'fi', '{14,1}', null, $b$Kuljetusliike ei saa siirtää RAHTIS-palvelusta vastaanottamaansa toimeksiantoa edelleen toiselle kuljetusliikkeelle ilman Aivomaa Oy:n ennakkosuostumusta. Jos siirto hyväksytään, alkuperäinen kuljetusliike vastaa käyttämänsä kuljetusliikkeen toiminnasta suhteessa Aivomaa Oy:hyn sovellettavan lain mukaisesti, ja tällä tulee olla toimeksiannon edellyttämät luvat, vakuutukset, kalusto ja pätevyydet.$b$);
  perform pg_temp.c(d, 'en', '{14,1}', null, $b$The carrier must not pass an assignment received from the RAHTIS service on to another carrier without the prior consent of Aivomaa Oy. If the transfer is approved, the original carrier is liable to Aivomaa Oy for the performance of the carrier it uses under the applicable law, and that carrier must have the licences, insurance, equipment and qualifications the assignment requires.$b$);

  -- ── 15 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{15}', 'Vahingot ja reklamaatiot', null);
  perform pg_temp.c(d, 'en', '{15}', 'Damage and claims', null);

  perform pg_temp.c(d, 'fi', '{15,1}', null, $b$Kuljetusliike ilmoittaa Aivomaa Oy:lle viipymättä tavaravahingosta, vajauksesta, perävaunun tai kontin vauriosta, sinetin rikkoutumisesta, liikennevahingosta, merkittävästä viivästyksestä, asiakirjaongelmasta ja muusta toimeksiannon olennaisesta poikkeamasta sekä säilyttää ja toimittaa käytettävissä olevan näytön (rahtikirjat, CMR-asiakirjat, valokuvat, sovelluksen aikaleimat, sijaintitiedot, kuljettajan selvitys, viranomaisasiakirjat).$b$);
  perform pg_temp.c(d, 'en', '{15,1}', null, $b$The carrier notifies Aivomaa Oy without delay of cargo damage, shortage, damage to the trailer or container, a broken seal, a traffic accident, significant delay, a document problem and any other material deviation in the assignment, and keeps and delivers the available evidence (consignment notes, CMR documents, photographs, app timestamps, location data, the driver's statement, documents of authorities).$b$);

  perform pg_temp.c(d, 'fi', '{15,2}', null, $b$Reklamaatiot käsitellään RAHTIS-palvelussa käyttöehtojen mukaisesti. Kuljetusliikkeen vastuu kuljetuksesta, tavarasta, viivästyksestä ja vahingoista määräytyy sovellettavan lain ja soveltuvin osin CMR-yleissopimuksen perusteella. Tämä sopimus ei laajenna kuljetusliikkeen vastuuta pakottavien vastuusäännösten yli.$b$);
  perform pg_temp.c(d, 'en', '{15,2}', null, $b$Claims are handled in the RAHTIS service in accordance with the terms of use. The carrier's liability for the transport, the goods, delay and damage is determined by the applicable law and, where applicable, the CMR Convention. This agreement does not extend the carrier's liability beyond mandatory liability rules.$b$);

  perform pg_temp.c(d, 'fi', '{15,3}', null, $b$Jos Aivomaa Oy on asiakkaaseen nähden vastuussa vahingosta, joka kuuluu lain tai tämän sopimuksen perusteella kuljetusliikkeen vastuupiiriin, Aivomaa Oy voi esittää kuljetusliikkeelle vastaavan vaatimuksen siltä osin kuin kuljetusliike on lain mukaan vahingosta vastuussa. $b$ || jur_fi || $b$reklamaatioiden määräajat ja regressin ehdot.]$b$);
  perform pg_temp.c(d, 'en', '{15,3}', null, $b$If Aivomaa Oy is liable to the customer for damage which by law or under this agreement falls within the carrier's responsibility, Aivomaa Oy may present a corresponding claim to the carrier to the extent the carrier is liable for the damage by law. $b$ || jur_en || $b$time limits for claims and terms of recourse.]$b$);

  -- ── 16 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{16}', 'Asiakkaiden tiedot ja luottamuksellisuus', null);
  perform pg_temp.c(d, 'en', '{16}', 'Customer data and confidentiality', null);

  perform pg_temp.c(d, 'fi', '{16,1}', null, $b$RAHTIS voi palvelun rakenteen ja toimeksiannon luonteen perusteella rajoittaa kuljetusliikkeelle näytettäviä asiakkaan kaupallisia tai yhteystietoja siihen, mikä on toimeksiannon suorittamiseksi tarpeellista.$b$);
  perform pg_temp.c(d, 'en', '{16,1}', null, $b$Based on the structure of the service and the nature of the assignment, RAHTIS may limit the customer's commercial or contact details shown to the carrier to what is necessary to perform the assignment.$b$);

  perform pg_temp.c(d, 'fi', '{16,2}', null, $b$Kuljetusliike käyttää RAHTIS-palvelun kautta saamiaan asiakkaiden, toimeksiantojen, hintojen, sopimusten ja liiketoiminnan tietoja vain toimeksiannon suorittamiseen ja tähän sopimukseen liittyviin tarkoituksiin.$b$);
  perform pg_temp.c(d, 'en', '{16,2}', null, $b$The carrier uses the data on customers, assignments, prices, contracts and business obtained through the RAHTIS service only for performing the assignment and for purposes related to this agreement.$b$);

  perform pg_temp.c(d, 'fi', '{16,3}', null, $b$Aivomaa Oy ei käytä itsenäisen kuljetusliikkeen palveluun lisäämien omien asiakkaiden tietoja tarjotakseen näille asiakkaille kuljetuksia itse tai muiden kuljetusliikkeiden kautta, eikä luovuta tietoja muille kuljetusliikkeille.$b$);
  perform pg_temp.c(d, 'en', '{16,3}', null, $b$Aivomaa Oy does not use the data of an independent carrier's own customers added to the service to offer transports to those customers itself or through other carriers, and does not disclose the data to other carriers.$b$);

  perform pg_temp.c(d, 'fi', '{16,4}', null, $b$Tämä sopimus ei sisällä kilpailukieltoa eikä yleistä kieltoa harjoittaa liiketoimintaa muiden asiakkaiden tai kuljetusliikkeiden kanssa. $b$ || jur_fi || $b$keikkalistan kautta tavattujen tilaajien houkuttelukielto ja sen kesto.]$b$);
  perform pg_temp.c(d, 'en', '{16,4}', null, $b$This agreement contains no non-compete obligation and no general prohibition on doing business with other customers or carriers. $b$ || jur_en || $b$non-solicitation of shippers met through the job list and its duration.]$b$);

  -- ── 17 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{17}', 'Arvioinnit', null);
  perform pg_temp.c(d, 'en', '{17}', 'Ratings', null);

  perform pg_temp.c(d, 'fi', '{17,1}', null, $b$Tilaaja voi arvioida kuljetusliikkeen toimeksiannon valmistuttua. Arvion on perustuttava todelliseen yhteistyöhön, eikä se saa sisältää tieten virheellisiä väitteitä tai tarpeettomia henkilötietoja. Kuljetusliike voi ilmoittaa Aivomaa Oy:lle perusteettomaksi katsomastaan arviosta, ja Aivomaa Oy voi rajoittaa sen näkyvyyttä selvityksen ajaksi. $b$ || jur_fi || $b$arvioinnin määräaika, arvion muuttaminen ja poistaminen.]$b$);
  perform pg_temp.c(d, 'en', '{17,1}', null, $b$The shipper may rate the carrier after an assignment is completed. A rating must be based on actual cooperation and must not contain knowingly false statements or unnecessary personal data. The carrier may report a rating it considers unfounded to Aivomaa Oy, which may limit its visibility while the matter is investigated. $b$ || jur_en || $b$time limit for rating, changing and removing a rating.]$b$);

  -- ── 18 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{18}', 'Palvelun käyttö ja tekniset häiriöt', null);
  perform pg_temp.c(d, 'en', '{18}', 'Use of the service and technical disruptions', null);

  perform pg_temp.c(d, 'fi', '{18,1}', null, $b$Aivomaa Oy pyrkii pitämään RAHTIS-palvelun käytettävissä, mutta ei takaa järjestelmän keskeytyksetöntä tai virheetöntä toimintaa. Jos sovellusta ei teknisen häiriön vuoksi voida käyttää, kuljetusliike tai kuljettaja tallentaa tarvittavat tiedot mahdollisuuksien mukaan muulla tavalla ja toimittaa ne Aivomaa Oy:lle heti, kun se on kohtuudella mahdollista. Tekninen häiriö ei itsessään poista tosiasiallisesti suoritetun kuljetuksen maksuvelvollisuutta.$b$);
  perform pg_temp.c(d, 'en', '{18,1}', null, $b$Aivomaa Oy aims to keep the RAHTIS service available but does not guarantee uninterrupted or error-free operation of the system. If the app cannot be used because of a technical disruption, the carrier or driver records the necessary information by other means where possible and delivers it to Aivomaa Oy as soon as reasonably possible. A technical disruption does not in itself remove the obligation to pay for a transport actually performed.$b$);

  -- ── 19 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{19}', 'Sopimuksen päättäminen', null);
  perform pg_temp.c(d, 'en', '{19}', 'Termination', null);

  perform pg_temp.c(d, 'fi', '{19,1}', null, $b$Kumpikin osapuoli voi päättää tämän puitesopimuksen milloin tahansa ilmoittamalla siitä toiselle osapuolelle.$b$);
  perform pg_temp.c(d, 'en', '{19,1}', null, $b$Either party may terminate this framework agreement at any time by notifying the other party.$b$);

  perform pg_temp.c(d, 'fi', '{19,2}', null, $b$Päättäminen ei vaikuta ennen päättymistä syntyneisiin maksusaataviin, jo suoritettuihin kuljetuksiin, kesken oleviin reklamaatioihin, asiakirjojen toimittamisvelvollisuuksiin, vahingonkorvausvastuisiin eikä muihin velvoitteisiin, joiden on luonteensa vuoksi tarkoitus jatkua. Jo ansaitut kuljetuskorvaukset maksetaan normaalin tilitysaikataulun mukaisesti.$b$);
  perform pg_temp.c(d, 'en', '{19,2}', null, $b$Termination does not affect payment claims arisen before termination, transports already performed, pending claims, obligations to deliver documents, liability for damages or other obligations intended by their nature to continue. Freight charges already earned are paid according to the normal settlement schedule.$b$);

  perform pg_temp.c(d, 'fi', '{19,3}', null, $b$Päättymiskuukauden kuukausimaksu peritään niistä ajoneuvoista, joilla on kyseisen kuukauden aikana merkitty valmiiksi vähintään yksi toimeksianto.$b$);
  perform pg_temp.c(d, 'en', '{19,3}', null, $b$The monthly fee for the month of termination is charged for vehicles that have at least one assignment marked as completed during that month.$b$);

  perform pg_temp.c(d, 'fi', '{19,4}', null, $b$Aivomaa Oy voi estää uusien toimeksiantojen vastaanottamisen välittömästi, jos kuljetusliikkeeltä puuttuu vaadittu lupa tai vakuutus, se ei toimita kohdan 4.4 asiakirjoja määräajassa tai toiminnan jatkaminen aiheuttaa ilmeisen turvallisuus-, oikeudellisen tai petosriskin.$b$);
  perform pg_temp.c(d, 'en', '{19,4}', null, $b$Aivomaa Oy may immediately prevent the carrier from receiving new assignments if the carrier lacks a required licence or insurance, fails to deliver the documents under section 4.4 in time, or continuing the activity causes an evident safety, legal or fraud risk.$b$);

  -- ── 20 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{20}', 'Sopimuksen muutokset', null);
  perform pg_temp.c(d, 'en', '{20}', 'Amendments', null);

  perform pg_temp.c(d, 'fi', '{20,1}', null, $b$Tähän sopimukseen tehtäviä muutoksia ei sovelleta takautuvasti jo vahvistettuihin toimeksiantoihin ilman osapuolten suostumusta, ellei pakottava laki muuta edellytä. Palvelumaksujen muutoksiin sovelletaan kohtaa 3.8. Palvelun teknisiä ominaisuuksia, käyttöliittymää ja työvaiheita voidaan kehittää ilman erillistä sopimusmuutosta, jos muutos ei olennaisesti heikennä kuljetusliikkeen jo vahvistettuun toimeksiantoon perustuvia oikeuksia.$b$);
  perform pg_temp.c(d, 'en', '{20,1}', null, $b$Amendments to this agreement do not apply retroactively to assignments already confirmed without the parties' consent unless mandatory law requires otherwise. Section 3.8 applies to changes in service fees. The technical features, user interface and work steps of the service may be developed without a separate amendment where the change does not materially weaken the carrier's rights based on an assignment already confirmed.$b$);

  -- ── 21 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{21}', 'Sovellettava laki ja riidat', null);
  perform pg_temp.c(d, 'en', '{21}', 'Governing law and disputes', null);

  perform pg_temp.c(d, 'fi', '{21,1}', null, $b$Sopimukseen sovelletaan Suomen lakia ottaen huomioon pakottavat säännökset ja sovellettavat kansainväliset yleissopimukset. Osapuolet pyrkivät ensisijaisesti ratkaisemaan erimielisyydet neuvotteluteitse. Jos sovintoon ei päästä, riita käsitellään Helsingin käräjäoikeudessa, kuitenkin siten, että pakottavat oikeuspaikkasäännökset ja CMR-yleissopimuksen oikeuspaikkamääräykset säilyvät.$b$);
  perform pg_temp.c(d, 'en', '{21,1}', null, $b$This agreement is governed by Finnish law, taking into account mandatory provisions and applicable international conventions. The parties aim primarily to resolve disagreements through negotiation. If no settlement is reached, the dispute is heard by the Helsinki District Court, without prejudice to mandatory venue provisions and the venue provisions of the CMR Convention.$b$);

  -- ── 22 ─────────────────────────────────────────────────────────────
  perform pg_temp.c(d, 'fi', '{22}', 'Kieliversiot', null);
  perform pg_temp.c(d, 'en', '{22}', 'Language versions', null);

  perform pg_temp.c(d, 'fi', '{22,1}', null, $b$Sopimus on laadittu suomeksi ja englanniksi. Jos kieliversioiden välillä on ristiriita, suomenkielinen versio ratkaisee.$b$);
  perform pg_temp.c(d, 'en', '{22,1}', null, $b$This agreement is drawn up in Finnish and English. In the event of conflict between the language versions, the Finnish version prevails.$b$);

  /* Оба языка — одинаковый набор пунктов: иначе страница покажет дыру. */
  if (select count(*) from public.legal_clauses where document_id = d and locale = 'fi')
     <> (select count(*) from public.legal_clauses where document_id = d and locale = 'en') then
    raise exception 'Разное число пунктов на двух языках.' using errcode = '55000';
  end if;
end;
$$;
