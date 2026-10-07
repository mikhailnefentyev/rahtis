-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: свои рейсы перевозчика
--
-- Под поведение 20261007100000. Новые черновики (действующие редакции не
-- меняются, активация — решение пользователя):
--
--   CARRIER_AGREEMENT v4:
--     2.6  — свои рейсы: клиент перевозчика, своя машина, мимо стола;
--     3.1  — процент подряда берётся только там, где договор с клиентом у
--            Aivomaa Oy (стол), а не со своих клиентов;
--     5.5  — роли по данным водителей вместо пометки для юриста;
--     15.2 — претензии по своим рейсам — между перевозчиком и клиентом;
--     16.5 — данные клиентов своих рейсов: Aivomaa Oy — обработчик
--            (GDPR ст. 28), с обязательными условиями статьи;
--     16.6 — ссылка на ход рейса для клиента;
--     4.1, 7.1, 12.3, 15.3, 16.4, 17.1 — пометки для юриста заполнены по
--            обычной практике финского рынка (TieKSL, CMR).
--
--   PRIVACY v17 (уже черновик):
--     1.3, 2.14, 5.1 — свои рейсы и ссылка для клиента;
--     2.4, 2.11, 2.12, 2.13, 4.7, 10.2 — правовые основания вместо пометок
--     для юриста (решение пользователя 7.10.2026: без пометок, по
--     действующему праву).
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

/* Замена фрагмента пункта; не нашёл — ошибка, а не тихий пропуск. */
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


-- ── Договор перевозчика ────────────────────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('CARRIER_AGREEMENT');
begin
  perform pg_temp.put(v_doc, array[2, 6],
    'Omat keikat: kuljetusliike voi lisätä palveluun oman asiakkaansa kuljetuksen ja antaa sen suoraan omalle ajoneuvolleen. Oma keikka ei näy keikkalistalla eikä muille kuljetusliikkeille. Kuljetussopimus on kuljetusliikkeen ja sen asiakkaan välinen kohdan 2.3 mukaisesti, eikä Aivomaa Oy ole sen osapuoli. Jos kuljetusliike tai sen kuljettaja peruu oman keikan, keikka päättyy peruttuna eikä siirry keikkalistalle. Omat keikat kuuluvat Itsenäinen kuljetusliike -malliin; Alihankkija-mallin kuljetusliike voi käyttää niitä kohdan 3.4 maksuttomana aikana.',
    'Own jobs: the carrier may add a transport of its own customer to the service and give it directly to its own vehicle. An own job is not shown on the job list or to other carriers. The contract of carriage is between the carrier and its customer in accordance with section 2.3, and Aivomaa Oy is not a party to it. If the carrier or its driver cancels an own job, the job ends as cancelled and is not moved to the job list. Own jobs belong to the Independent carrier model; a carrier under the Subcontractor model may use them during the free period of section 3.4.');

  perform pg_temp.swap(v_doc, array[3, 1], 'fi',
    'Maksu koskee myös kuljetusliikkeen omille asiakkaille palvelun kautta tehtyjä kuljetuksia ja keikkalistalta vastaanotettuja toimeksiantoja, ellei osapuolten välillä ole kirjallisesti sovittu toisin.',
    'Maksu koskee keikkalistalta vastaanotettuja toimeksiantoja ja muita toimeksiantoja, joissa Aivomaa Oy on tilaajan sopimuskumppani. Kohdan 2.6 omista keikoista ei peritä prosenttiosuutta.');
  perform pg_temp.swap(v_doc, array[3, 1], 'en',
    'The fee also applies to transports carried out for the carrier''s own customers through the service and to assignments taken from the job list, unless otherwise agreed in writing.',
    'The fee applies to assignments taken from the job list and to other assignments in which Aivomaa Oy is the shipper''s contracting party. No percentage is charged on own jobs under section 2.6.');

  perform pg_temp.swap(v_doc, array[5, 5], 'fi',
    '[Kohta täydennetään juristin kanssa: osapuolten roolit rekisterinpitäjänä tai käsittelijänä ja mahdollinen käsittelysopimus.]',
    'Kumpikin osapuoli on rekisterinpitäjä omien käsittelytarkoitustensa osalta: Aivomaa Oy tietosuojaselosteessa kuvattujen palvelun tarkoitusten osalta ja kuljetusliike työnantajana omien tarkoitustensa, kuten työaikakirjanpidon, palkanmaksun ja työturvallisuuden, osalta. Osapuolet eivät ole yhteisiä rekisterinpitäjiä.');
  perform pg_temp.swap(v_doc, array[5, 5], 'en',
    '[To be completed with a lawyer: the parties'' roles as controller or processor and any data processing agreement.]',
    'Each party is the controller for its own purposes of processing: Aivomaa Oy for the purposes of the service described in the privacy policy, and the carrier as employer for its own purposes, such as working time records, payment of wages and occupational safety. The parties are not joint controllers.');

  perform pg_temp.swap(v_doc, array[15, 2], 'fi',
    'Kohdan 2.3 suorissa tilauksissa, joissa',
    'Kohdan 2.3 suorissa tilauksissa ja kohdan 2.6 omissa keikoissa, joissa');
  perform pg_temp.swap(v_doc, array[15, 2], 'en',
    'In direct orders under section 2.3, where',
    'In direct orders under section 2.3 and own jobs under section 2.6, where');

  perform pg_temp.put(v_doc, array[16, 5],
    'Omien keikkojen osalta kuljetusliike on rekisterinpitäjä niiden henkilötietojen osalta, jotka se lisää palveluun asiakkaastaan ja kuljetuksen yhteyshenkilöistä (nimet, puhelinnumerot, sähköpostiosoitteet, osoitteet sekä rahtikirjojen allekirjoitukset), ja Aivomaa Oy käsittelee niitä kuljetusliikkeen lukuun henkilötietojen käsittelijänä (tietosuoja-asetuksen 28 artikla). Käsittelyn tarkoitus on keikan välittäminen kuljettajalle, sen suorittamisen seuranta ja dokumentointi, seurantalinkin lähettäminen ja raportointi kuljetusliikkeelle, ja se kestää tämän sopimuksen voimassaolon ajan ja sen jälkeen tietosuojaselosteen säilytysajat. Aivomaa Oy:
- käsittelee tietoja vain tämän sopimuksen ja kuljetusliikkeen palvelussa tekemien valintojen mukaisesti, jotka ovat kuljetusliikkeen dokumentoidut ohjeet;
- varmistaa, että tietoja käsittelevät henkilöt ovat sitoutuneet salassapitoon;
- toteuttaa tietosuojaselosteen kohdan 10 mukaiset tekniset ja organisatoriset suojatoimet;
- käyttää alihankkijoina tietosuojaselosteen kohdissa 5.2–5.6 nimettyjä toimittajia, asettaa niille vastaavat tietosuojavelvoitteet ja ilmoittaa uusista alihankkijoista palvelussa vähintään 30 päivää etukäteen, jolloin kuljetusliike voi vastustaa muutosta ja päättää sopimuksen;
- avustaa kuljetusliikettä rekisteröityjen pyyntöihin vastaamisessa ja välittää sille saamansa pyynnöt;
- ilmoittaa kuljetusliikkeelle henkilötietojen tietoturvaloukkauksesta ilman aiheetonta viivytystä ja avustaa sitä tietoturvaa, loukkauksia ja vaikutustenarviointia koskevissa velvoitteissa;
- poistaa tiedot sopimuksen päätyttyä tai palauttaa ne kuljetusliikkeen pyynnöstä, ellei laki edellytä säilyttämistä;
- antaa kuljetusliikkeelle tiedot, jotka tarvitaan tämän kohdan noudattamisen osoittamiseen, ja sallii etukäteen sovitut auditoinnit kuljetusliikkeen kustannuksella.',
    'For own jobs, the carrier is the controller of the personal data it adds to the service about its customer and the transport''s contact persons (names, telephone numbers, email addresses, addresses and signatures on consignment notes), and Aivomaa Oy processes that data on the carrier''s behalf as a processor (Article 28 of the General Data Protection Regulation). The purpose of the processing is to deliver the job to the driver, to follow and document its performance, to send the tracking link and to report to the carrier, and it lasts for the term of this agreement and thereafter for the retention periods of the privacy policy. Aivomaa Oy:
- processes the data only in accordance with this agreement and the choices the carrier makes in the service, which are the carrier''s documented instructions;
- ensures that the persons processing the data are bound by confidentiality;
- implements the technical and organisational security measures of section 10 of the privacy policy;
- uses as sub-processors the suppliers named in sections 5.2–5.6 of the privacy policy, imposes equivalent data protection obligations on them and announces new sub-processors in the service at least 30 days in advance, in which case the carrier may object to the change and terminate the agreement;
- assists the carrier in responding to data subjects'' requests and forwards to it the requests it receives;
- notifies the carrier of a personal data breach without undue delay and assists it with its obligations concerning security, breaches and impact assessments;
- deletes the data when the agreement ends or returns it at the carrier''s request, unless the law requires it to be retained;
- provides the carrier with the information needed to demonstrate compliance with this section and allows audits agreed in advance at the carrier''s expense.');

  perform pg_temp.put(v_doc, array[16, 6],
    'Kun kuljetusliike antaa oman keikan asiakkaan sähköpostiosoitteen, palvelu lähettää siihen kuljetusliikkeen puolesta viestin, jossa on keikan seurantalinkki. Linkin kautta näkyvät ilman tunnuksia kuljetusliikkeen nimi, keikan tunnus ja tila, perävaunun tai kontin numero sekä reittipisteiden nimet, paikkakunnat ja ajat; kuljettajan yhteystietoja, sijaintia ja hintaa linkistä ei näy. Kuljetusliike vastaa siitä, että sillä on oikeus antaa osoite, ja antaa linkin vain asiakkaalleen.',
    'When the carrier gives the email address of an own job''s customer, the service sends a message to it on the carrier''s behalf containing the job''s tracking link. Through the link, the carrier''s name, the job''s reference and status, the trailer or container number and the names, towns and times of the route stops are visible without an account; the driver''s contact details, location and the price are not shown. The carrier is responsible for having the right to give the address and gives the link only to its customer.');
end;
$$;


-- ── Tietosuojaseloste ──────────────────────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('PRIVACY');
begin
  perform pg_temp.swap(v_doc, array[1, 3], 'fi',
    'Heidän velvollisuutensa eivät korvaa Aivomaa Oy:n velvollisuuksia.',
    'Heidän velvollisuutensa eivät korvaa Aivomaa Oy:n velvollisuuksia. Kuljetusliikkeen omissa keikoissa (kohta 2.14) kuljetusliike on rekisterinpitäjä asiakkaansa ja kuljetuksen yhteyshenkilöiden tiedoille, ja Aivomaa Oy käsittelee niitä kuljetusliikkeen lukuun kuljetusliikkeen sopimuksen kohdan 16.5 mukaisesti; näitä tietoja koskevat pyynnöt ohjataan kuljetusliikkeelle, ja Aivomaa Oy välittää sille saamansa pyynnöt.');
  perform pg_temp.swap(v_doc, array[1, 3], 'en',
    'Their obligations do not replace those of Aivomaa Oy.',
    'Their obligations do not replace those of Aivomaa Oy. In a carrier''s own jobs (section 2.14), the carrier is the controller of the data of its customer and the transport''s contact persons, and Aivomaa Oy processes that data on the carrier''s behalf in accordance with section 16.5 of the carrier agreement; requests concerning that data are directed to the carrier, and Aivomaa Oy forwards to it the requests it receives.');

  perform pg_temp.put(v_doc, array[2, 14],
    'Omat keikat: kun kuljetusliike lisää palveluun oman asiakkaansa kuljetuksen, asiakkaasta tallennetaan nimi sekä kuljetusliikkeen antamat Y-tunnus ja sähköpostiosoite, ja keikalle muodostetaan satunnainen seurantalinkin tunniste. Seurantalinkki lähetetään asiakkaan sähköpostiin vain, jos kuljetusliike on antanut osoitteen. Linkistä näkyvät kuljetusliikkeen nimi, keikan tunnus ja tila, perävaunun tai kontin numero sekä reittipisteiden nimet, paikkakunnat ja ajat; kuljettajan yhteystietoja, sijaintia ja hintaa linkistä ei näy. Asiakkaan tiedot näkyvät vain kyseiselle kuljetusliikkeelle ja ylläpitäjälle, eikä Aivomaa Oy käytä niitä omaan markkinointiinsa. Säilytysajat ovat samat kuin muilla tilauksilla (kohta 8.4).',
    'Own jobs: when a carrier adds a transport of its own customer to the service, the customer''s name and the business ID and email address given by the carrier are stored, and a random tracking link identifier is created for the job. The tracking link is sent to the customer''s email only if the carrier has given the address. The link shows the carrier''s name, the job''s reference and status, the trailer or container number and the names, towns and times of the route stops; the driver''s contact details, location and the price are not shown. The customer''s data is visible only to that carrier and the administrator, and Aivomaa Oy does not use it for its own marketing. The retention periods are the same as for other orders (section 8.4).');

  perform pg_temp.swap(v_doc, array[5, 1], 'fi',
    'tilaajalle oman tilauksensa eteneminen ja asiakirjat.',
    'tilaajalle oman tilauksensa eteneminen ja asiakirjat ja oman keikan seurantalinkin saajalle kohdassa 2.14 luetellut tiedot.');
  perform pg_temp.swap(v_doc, array[5, 1], 'en',
    'the shipper receives the progress and documents of its own order.',
    'the shipper receives the progress and documents of its own order, and the recipient of an own job''s tracking link the data listed in section 2.14.');

  /* Правовые основания вместо пометок для юриста. */
  perform pg_temp.swap(v_doc, array[2, 4], 'fi',
    '[Kohta täydennetään juristin kanssa: käsittelyperuste sijaintipisteiden luovuttamiselle tilaajalle.]',
    'Sijaintipisteiden näyttäminen tilaajalle perustuu tilaajan ja Aivomaa Oy:n oikeutettuun etuun osoittaa kuljetuksen suoritus sekä selvittää odotusaika ja vahingot (tietosuoja-asetuksen 6 artiklan 1 kohdan f alakohta). Pisteitä on vain kuittaushetkiltä, eikä niillä voi seurata kuljettajaa jatkuvasti. Kuljetusliike kertoo kuljettajilleen sijaintipisteistä ennen sovelluksen käyttöönottoa, ja kuljettaja voi vastustaa käsittelyä kohdan 9 mukaisesti.');
  perform pg_temp.swap(v_doc, array[2, 4], 'en',
    '[This clause is to be completed with counsel: the legal basis for disclosing position points to the shipper.]',
    'Showing the position points to the shipper is based on the legitimate interest of the shipper and Aivomaa Oy in demonstrating the performance of the transport and settling waiting time and damage (Article 6(1)(f) of the General Data Protection Regulation). Points exist only for the confirmation moments, and they cannot be used to follow the driver continuously. The carrier informs its drivers of the position points before they start using the app, and the driver may object to the processing in accordance with section 9.');

  perform pg_temp.swap(v_doc, array[2, 11], 'fi',
    '[Kohta täydennetään juristin kanssa: kutsuviestin lähettämisen peruste, kun osoitteen antaa kuljetusliike, ja vastaanottajalle annettava tieto.]',
    'Kutsuviestin lähettäminen perustuu kutsuvan kuljetusliikkeen ja Aivomaa Oy:n oikeutettuun etuun yritysten väliseen yhteydenottoon (tietosuoja-asetuksen 6 artiklan 1 kohdan f alakohta). Viestissä kerrotaan kutsujan nimi. Vastaanottaja voi jättää viestin huomiotta tai pyytää tietojensa poistamista osoitteesta admin@rahtis.eu.');
  perform pg_temp.swap(v_doc, array[2, 11], 'en',
    '[To be completed with a lawyer: the basis for sending the invitation message when the address is given by the carrier, and the information given to the recipient.]',
    'Sending the invitation message is based on the legitimate interest of the inviting carrier and Aivomaa Oy in business-to-business contact (Article 6(1)(f) of the General Data Protection Regulation). The message states the name of the inviter. The recipient may ignore the message or ask for its data to be deleted by writing to admin@rahtis.eu.');

  perform pg_temp.swap(v_doc, array[2, 12], 'fi',
    '[Kohta täydennetään juristin kanssa: käsittelyperuste toiminimen tunnusluvuille ja oikeus vastustaa.]',
    'Käsittelyn peruste on tilaajien ja Aivomaa Oy:n oikeutettu etu arvioida suorittajan luotettavuutta (tietosuoja-asetuksen 6 artiklan 1 kohdan f alakohta). Toiminimellä toimiva elinkeinonharjoittaja voi vastustaa käsittelyä erityiseen tilanteeseensa liittyvällä perusteella kohdan 9 mukaisesti.');
  perform pg_temp.swap(v_doc, array[2, 12], 'en',
    '[To be completed with a lawyer: the legal basis for the key figures of sole traders and the right to object.]',
    'The legal basis is the legitimate interest of shippers and Aivomaa Oy in assessing the reliability of the performer (Article 6(1)(f) of the General Data Protection Regulation). A sole trader may object to the processing on grounds relating to their particular situation in accordance with section 9.');

  perform pg_temp.swap(v_doc, array[2, 13], 'fi',
    ' [Kohta täydennetään juristin kanssa: viestien käsittelyperuste ja kuljettajalle annettava tieto.]',
    ' Kuljetusliike kertoo kuljettajilleen keikan viesteistä ja niiden näkyvyydestä ennen sovelluksen käyttöönottoa.');
  perform pg_temp.swap(v_doc, array[2, 13], 'en',
    ' [To be completed with counsel: the basis for processing messages and the information given to the driver.]',
    ' The carrier informs its drivers of job messages and who can see them before they start using the app.');

  perform pg_temp.swap(v_doc, array[4, 7], 'fi',
    'mahdollinen yhteenveto kuljetusliikkeelle otetaan käyttöön vain juristin kanssa sovitulla tavalla.',
    'mahdollinen yhteenveto kuljetusliikkeelle otetaan käyttöön vasta, kun tämä seloste on päivitetty sitä koskevaksi.');
  perform pg_temp.swap(v_doc, array[4, 7], 'en',
    'any summary for the carrier will be introduced only in a way agreed with counsel.',
    'any summary for the carrier will be introduced only once this policy has been updated to cover it.');

  perform pg_temp.swap(v_doc, array[10, 2], 'fi',
    '[Kohta täydennetään juristin kanssa: kuljettajan yhteystietojen luovuttamisen peruste ja kuljettajalle annettava tieto.]',
    'Kuljettajan yhteystietojen näyttäminen perustuu tilaajan ja kuljetusliikkeen oikeutettuun etuun hoitaa kuljetukseen liittyvä yhteydenpito (tietosuoja-asetuksen 6 artiklan 1 kohdan f alakohta). Kuljetusliike kertoo tästä kuljettajilleen, ja näyttäminen päättyy, kun kuljetusliike peruu tilaajan suorat tilaukset.');
  perform pg_temp.swap(v_doc, array[10, 2], 'en',
    '[This clause is to be completed with counsel: the basis for disclosing the driver''s contact details and the information given to the driver.]',
    'Showing the driver''s contact details is based on the legitimate interest of the shipper and the carrier in handling communication about the transport (Article 6(1)(f) of the General Data Protection Regulation). The carrier informs its drivers of this, and the details are no longer shown once the carrier withdraws the shipper''s direct orders.');

  if exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and (body like '%juristin%' or body like '%lawyer%' or body like '%counsel%')
  ) then
    raise exception 'PRIVACY: пометки для юриста остались.';
  end if;
end;
$$;


-- ── Договор перевозчика: оставшиеся пометки для юриста ─────────────
-- Решение пользователя 7.10.2026: заполнить по обычной практике финского
-- рынка — tiekuljetussopimuslaki, CMR, обычные условия подряда.

do $$
declare
  v_doc uuid := pg_temp.draft_of('CARRIER_AGREEMENT');
begin
  perform pg_temp.swap(v_doc, array[4, 1], 'fi',
    '[Kohta täydennetään juristin kanssa: vastuuvakuutuksen vähimmäismäärä euroina.]',
    'Kuljetusvastuuvakuutuksen vakuutusmäärän on oltava vähintään 300 000 euroa vahinkotapahtumaa kohden. Jos yksittäisen kuorman lain mukainen enimmäiskorvaus on tätä suurempi, vakuutuksen on katettava se. Kuljetusliike ilmoittaa Aivomaa Oy:lle viipymättä, jos vakuutus päättyy tai sen vakuutusmäärä pienenee.');
  perform pg_temp.swap(v_doc, array[4, 1], 'en',
    '[To be completed with a lawyer: minimum sum insured of the liability insurance in euros.]',
    'The sum insured of the carrier''s liability insurance must be at least 300,000 euros per incident. If the statutory maximum compensation for a single load is higher, the insurance must cover it. The carrier notifies Aivomaa Oy without delay if the insurance ends or its sum insured is reduced.');

  perform pg_temp.swap(v_doc, array[7, 1], 'fi',
    ' [Kohta täydennetään juristin kanssa: myöhäisen perumisen (esimerkiksi alle 12 tuntia ennen noutoa) osoitettujen korvaavan suorittajan lisäkulujen korvaaminen.]',
    ' Oma keikka (kohta 2.6) ei palaa keikkalistalle. Jos kuljetusliike peruu toimeksiannon, jossa Aivomaa Oy on tilaajan sopimuskumppani, alle 12 tuntia ennen sovittua noutoaikaa ilman kohdan 7.3 mukaista estettä, Aivomaa Oy voi periä korvaavan suorittajan hankkimisesta aiheutuneet osoitetut kohtuulliset lisäkulut, enintään perutun toimeksiannon kuljetushinnan määrän. Kulut eritellään kuljetusliikkeelle, ja ne voidaan vähentää tilityksestä kohdan 12.3 mukaisesti.');
  perform pg_temp.swap(v_doc, array[7, 1], 'en',
    ' [To be completed with a lawyer: compensation of proven additional costs of a replacement performer in the event of late cancellation (for example less than 12 hours before pick-up).]',
    ' An own job (section 2.6) does not return to the job list. If the carrier cancels an assignment in which Aivomaa Oy is the shipper''s contracting party less than 12 hours before the agreed pick-up time without an impediment under section 7.3, Aivomaa Oy may charge the proven reasonable additional costs of obtaining a replacement performer, up to the freight price of the cancelled assignment. The costs are itemised to the carrier and may be deducted from the settlement in accordance with section 12.3.');

  perform pg_temp.swap(v_doc, array[12, 3], 'fi',
    '[Kohta täydennetään juristin kanssa: kuittauksen tarkemmat ehdot.]',
    'Kuittaus koskee vain erääntyneitä ja määrältään selviä saatavia, ja Aivomaa Oy ilmoittaa kuitatun määrän ja sen perusteen tilityksen erittelyssä. Riitautetun vaatimuksen osalta pidätetään enintään vaatimuksen määrä, kunnes asia on ratkaistu. Kuljetusliike voi kuitata Aivomaa Oy:ltä olevaa saatavaansa erääntyneellä ja riidattomalla vastasaatavalla.');
  perform pg_temp.swap(v_doc, array[12, 3], 'en',
    '[To be completed with a lawyer: detailed terms of set-off.]',
    'Set-off applies only to receivables that are due and certain in amount, and Aivomaa Oy states the amount set off and its basis in the settlement specification. For a disputed claim, at most the amount of the claim is withheld until the matter is resolved. The carrier may set off its receivable from Aivomaa Oy against a counterclaim that is due and undisputed.');

  perform pg_temp.swap(v_doc, array[15, 3], 'fi',
    ' [Kohta täydennetään juristin kanssa: reklamaatioiden määräajat ja regressin ehdot.]',
    ' Huomautusajat ja vanhentuminen määräytyvät tiekuljetussopimuslain ja soveltuvin osin CMR-yleissopimuksen mukaan: näkyvästä vahingosta huomautetaan tavaraa luovutettaessa, ei-näkyvästä vahingosta seitsemän päivän kuluessa luovutuksesta sunnuntaita ja pyhäpäiviä lukuun ottamatta ja viivästyksestä 21 päivän kuluessa. Osapuolet ilmoittavat toisilleen saamistaan reklamaatioista viipymättä. Aivomaa Oy:n vaatimus on esitettävä vuoden kuluessa siitä, kun se maksoi korvauksen asiakkaalle tai sen vastuu todettiin lainvoimaisesti, ellei pakottava laki edellytä muuta. Kuljetusliike saa vaatimuksen perusteena olevat asiakirjat ja voi esittää niistä huomautuksensa ennen kuin vaatimus vähennetään tilityksestä.');
  perform pg_temp.swap(v_doc, array[15, 3], 'en',
    ' [To be completed with a lawyer: time limits for claims and terms of recourse.]',
    ' Notice periods and limitation are determined by the Finnish Road Transport Contracts Act and, where applicable, the CMR Convention: apparent damage is notified on delivery, non-apparent damage within seven days of delivery excluding Sundays and public holidays, and delay within 21 days. The parties notify each other of claims they receive without delay. A claim by Aivomaa Oy must be presented within one year of its paying compensation to the customer or its liability being established by a final decision, unless mandatory law requires otherwise. The carrier receives the documents on which the claim is based and may comment on them before the claim is deducted from the settlement.');

  perform pg_temp.swap(v_doc, array[16, 4], 'fi',
    ' [Kohta täydennetään juristin kanssa: keikkalistan kautta tavattujen tilaajien houkuttelukielto ja sen kesto.]',
    ' Kuljetusliike ei kuitenkaan sopimuksen voimassaoloaikana eikä 12 kuukauden aikana viimeisestä tilaajalle keikkalistan kautta ajetusta toimeksiannosta tarjoa tälle tilaajalle palvelun ohi kuljetuksia, joista se on saanut tiedon keikkalistan kautta. Rajoitus ei koske tilaajia, jotka ovat olleet kuljetusliikkeen asiakkaita jo ennen ensimmäistä keikkalistan toimeksiantoa, eikä tilaajan omasta aloitteesta tehtyjä tilauksia; tilaaja voi myös lähettää kuljetusliikkeelle suoria tilauksia palvelun kautta kohdan 2.3 mukaisesti.');
  perform pg_temp.swap(v_doc, array[16, 4], 'en',
    ' [To be completed with a lawyer: non-solicitation of shippers met through the job list and its duration.]',
    ' However, during the term of the agreement and for 12 months after the last assignment performed for a shipper through the job list, the carrier does not offer that shipper, outside the service, transports it has learned of through the job list. The restriction does not apply to shippers that were the carrier''s customers before the first job list assignment, nor to orders made on the shipper''s own initiative; the shipper may also send the carrier direct orders through the service in accordance with section 2.3.');

  perform pg_temp.swap(v_doc, array[17, 1], 'fi',
    ' [Kohta täydennetään juristin kanssa: arvioinnin määräaika, arvion muuttaminen ja poistaminen.]',
    ' Arvion voi antaa ja sitä voi muuttaa 30 päivän kuluessa toimeksiannon valmistumisesta. Aivomaa Oy poistaa arvion, joka on asiaton, perustuu tieten virheellisiin tietoihin tai sisältää tarpeettomia henkilötietoja, ja ilmoittaa poistosta arvion antajalle.');
  perform pg_temp.swap(v_doc, array[17, 1], 'en',
    ' [To be completed with a lawyer: time limit for rating, changing and removing a rating.]',
    ' A rating may be given and changed within 30 days of the assignment being completed. Aivomaa Oy removes a rating that is inappropriate, is based on knowingly false information or contains unnecessary personal data, and notifies the person who gave it of the removal.');

  if exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and (body like '%juristin%' or body like '%lawyer%' or body like '%counsel%')
  ) then
    raise exception 'CARRIER_AGREEMENT: пометки для юриста остались.';
  end if;
end;
$$;
