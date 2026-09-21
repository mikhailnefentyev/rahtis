-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы догоняют водителей и прямые заказы
--
-- Три изменения поведения, которые документы должны назвать:
--
--   · водитель — отдельная запись перевозчика с телефоном-идентификатором,
--     а смена водителя на машине не снимает её допуск;
--   · учёт смен и справочный калькулятор оплаты водителя;
--   · прямой заказ знакомой машине без срока и согласие перевозчика на
--     такие заказы; заказчик видит знакомую машину без названия
--     перевозчика.
--
-- И одно, которое документы должны перестать обещать: WhatsApp-агент не
-- запускается — водитель работает в приложении. Политика описывала
-- передачу сообщений через Meta как действующую.
--
-- Все три документа — черновиками. Активация — решение пользователя.
-- Где нужен правовой выбор (роль Aivomaa в учёте рабочего времени, его
-- основание и срок хранения), стоит маркер юриста, а не описание кода.
-- ═══════════════════════════════════════════════════════════════════

/*
 * Черновик, следующий за действующей редакцией: заводится копией
 * действующей или берётся уже заведённый, если оператор успел.
 */
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

/* Пункт на обоих языках: новый вставляется, существующий переписывается. */
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
  -- ── Условия использования ───────────────────────────────────────

  perform pg_temp.put(v_terms, array[3, 4],
    'Kuljetusliike ilmoittaa palveluun kuljettajansa ja liittää heidät ajoneuvoihin. Kuljettajan puhelinnumero on hänen tunnuksensa palvelussa ja kuljettajasovelluksessa, ja samalla numerolla voi olla vain yksi voimassa oleva kuljettaja. Kuljettajan vaihtaminen ajoneuvoon ei poista ajoneuvon hyväksyntää; vaihto tallentuu tekijöineen ja aikoineen. Ajoneuvo, jolla ei ole kuljettajaa, ei voi ottaa keikkoja.',
    'The carrier registers its drivers in the service and links them to vehicles. A driver''s telephone number is their identifier in the service and in the driver app, and one number can belong to only one active driver. Changing the driver of a vehicle does not remove the vehicle''s approval; the change is recorded with its author and time. A vehicle without a driver cannot take jobs.');

  perform pg_temp.put(v_terms, array[3, 5],
    'Palvelussa voidaan kirjata kuljettajien työvuorot, tauot ja mittarilukemat. Niitä kirjaa kuljetusliike tai kuljettaja kuljettajasovelluksessa, ja jälkikäteiset muutokset ja poistot tallentuvat muutoslokiin. Palvelun palkkalaskuri laskee kuljetusliikkeen itse syöttämillä malleilla ja hinnoilla. Laskuri on suuntaa-antava. Lopullinen palkka määräytyy työnantajan ja työsopimuksen/TES:n mukaan. Työnantajana kuljetusliike vastaa palkanmaksusta, työaikakirjanpidosta ja työaikasäännösten noudattamisesta; Aivomaa Oy ei ole kuljettajan työnantaja eikä laske tai maksa palkkaa. [Kohta täydennetään juristin kanssa.]',
    'Drivers'' shifts, breaks and odometer readings can be recorded in the service. They are recorded by the carrier or by the driver in the driver app, and later changes and deletions are recorded in a change log. The service''s pay calculator computes with the models and rates the carrier enters itself. The calculator is indicative. The final pay is determined by the employer and the employment contract or collective agreement (Laskuri on suuntaa-antava. Lopullinen palkka määräytyy työnantajan ja työsopimuksen/TES:n mukaan.). As the employer, the carrier is responsible for paying wages, for the record of working hours and for compliance with working time rules; Aivomaa Oy is not the driver''s employer and neither calculates nor pays wages. [This clause is to be completed with counsel.]');

  perform pg_temp.put(v_terms, array[6, 2],
    'Toimeksiannon julkaiseminen, arviohinnan näkyminen tai automaattinen ilmoitus ei tarkoita, että Aivomaa Oy on ottanut kuljetuksen hoidettavakseen. Tarjouspöydällä yhtä toimeksiantoa kohti otetaan enintään kolme tarjousta.',
    'Publishing a job, the display of an indicative price or an automatic notification does not mean that Aivomaa Oy has undertaken to perform the transport. On the board, at most three offers are accepted per job.');

  perform pg_temp.put(v_terms, array[6, 3],
    'Tarjouspöydällä tilaaja valitsee tarjouksen, ja valittu suorittaja vahvistaa työn. Kummallakin päätöksellä on 15 minuutin määräaika, jonka jälkeen keikka palaa tarjottavaksi. Sitova kuljetussopimus syntyy, kun suorittaja vahvistaa työn; siihen asti kumpikin voi perääntyä ilman seurauksia.',
    'On the board, the shipper selects an offer and the selected performer confirms the work. Each decision has a 15-minute deadline, after which the job returns to the board. A binding contract of carriage is formed when the performer confirms the work; before that, either party may step back without consequence.');

  perform pg_temp.put(v_terms, array[6, 6],
    'Tilaaja voi lähettää toimeksiannon suoraan ajoneuvolle, joka on ajanut sen keikkoja, jos ajoneuvon kuljetusliike on sallinut tältä tilaajalta suorat tilaukset. Suora tilaus ei mene tarjouspöydälle eikä sillä ole määräaikaa: se odottaa, kunnes kuljetusliike tai sen kuljettaja vahvistaa sen, ja kuljetussopimus syntyy vahvistuksesta kuten kohdassa 6.3. Ennen vahvistusta tilaaja voi siirtää toimeksiannon tarjouspöydälle ja kuljetusliike voi kieltäytyä; kummassakin tapauksessa toimeksianto julkaistaan tarjouspöydällä. Aivomaa Oy on tilaajan sopimuskumppani myös suorissa tilauksissa.',
    'The shipper may send a job directly to a vehicle that has performed its jobs, provided the vehicle''s carrier has allowed direct orders from that shipper. A direct order does not go to the board and has no deadline: it waits until the carrier or its driver confirms it, and the contract of carriage is formed on confirmation as under clause 6.3. Before confirmation the shipper may move the job to the board and the carrier may decline; in either case the job is published on the board. Aivomaa Oy is the shipper''s contracting party in direct orders as well.');

  perform pg_temp.put(v_terms, array[6, 7],
    'Kuljetusliike päättää, mitkä tilaajat saavat lähettää suoria tilauksia sen ajoneuvoille, ja voi perua luvan milloin tahansa; peruminen ei vaikuta jo lähetettyihin tilauksiin. Tällaisista ajoneuvoista tilaaja näkee rekisteritunnuksen, kuljettajan nimen, ajoneuvon tiedot ja kuljetusliikkeen arvosanan, mutta ei kuljetusliikkeen nimeä eikä kuljettajan puhelinnumeroa.',
    'The carrier decides which shippers may send direct orders to its vehicles and may withdraw that permission at any time; withdrawal does not affect orders already sent. For such vehicles the shipper sees the registration number, the driver''s name, the vehicle''s details and the carrier''s rating, but not the carrier''s company name or the driver''s telephone number.');

  -- ── Политика конфиденциальности ─────────────────────────────────

  perform pg_temp.put(v_privacy, array[2, 2],
    'Käyttäjätiedot: nimi, sähköpostiosoite, puhelinnumero, rooli ja yritys, jonka puolesta käyttäjä toimii. Kuljettajatiedot: nimi, puhelinnumero, käytettävät kielet, ajoneuvo, johon kuljettaja on liitetty, ja näiden liitosten historia sekä yhteys keikkaan. Puhelinnumero on kuljettajan tunnus palvelussa ja kuljettajasovelluksessa. Nämä tiedot syöttää kuljetusliike.',
    'User data: name, email address, telephone number, role and the company the user acts for. Driver data: name, telephone number, languages used, the vehicle the driver is linked to and the history of those links, and the link to a job. The telephone number is the driver''s identifier in the service and in the driver app. This data is entered by the carrier.');

  perform pg_temp.put(v_privacy, array[2, 7],
    'Työaikatiedot: työvuorojen alku ja loppu, tauot, käytetty ajoneuvo, mittarilukemat, huomiot sekä näiden merkintöjen muutosloki tekijöineen ja aikoineen. Niitä kirjaa kuljetusliike tai kuljettaja kuljettajasovelluksessa. Kuljetusliikkeen kuljettajalle asettama palkkamalli ja hinnat sekä niistä lasketut suuntaa-antavat summat näkyvät vain tälle kuljetusliikkeelle; niitä ei näytetä kuljettajalle, tilaajalle eikä muille kuljetusliikkeille.',
    'Working time data: the start and end of shifts, breaks, the vehicle used, odometer readings, notes and the change log of these entries with authors and times. They are recorded by the carrier or by the driver in the driver app. The pay model and rates the carrier sets for a driver, and the indicative sums computed from them, are visible only to that carrier; they are not shown to the driver, the shipper or other carriers.');

  perform pg_temp.put(v_privacy, array[4, 6],
    'Työaikatietoja ja palkkamalleja käsitellään, jotta kuljetusliike saa kuljettajiensa työaikakirjanpidon ja suuntaa-antavan palkkalaskelman palvelusta. Aivomaa Oy:n rooli tässä käsittelyssä, käsittelyn peruste ja tietojen säilytysaika: [Kohta täydennetään juristin kanssa.]',
    'Working time data and pay models are processed so that the carrier gets a record of its drivers'' working hours and an indicative pay calculation from the service. The role of Aivomaa Oy in this processing, its legal basis and the retention period: [This clause is to be completed with counsel.]');

  perform pg_temp.put(v_privacy, array[5, 4],
    'Kun palvelun avustajaa käytetään, sen vastaukset muodostetaan Anthropicin kielimallilla; automaatio on toteutettu n8n-työkalulla. Näille välittyvät kysymyksen sisältö ja ne keikan tiedot, jotka vastaukseen tarvitaan. Avustajan käyttö on vapaaehtoista, ja sama työ voidaan hoitaa kabinetissa.',
    'When the service''s assistant is used, its answers are produced with Anthropic''s language model; the automation is built with n8n. These receive the content of the question and the job data needed to answer it. Using the assistant is voluntary, and the same work can be done in the cabinet.');

  perform pg_temp.put(v_privacy, array[6, 2],
    'Osa toimittajista on sijoittautunut ETA-alueen ulkopuolelle tai voi käsitellä tietoja siellä. Näin on erityisesti avustajan kielimallissa sekä mahdollisessa etätuessa.',
    'Some suppliers are established outside the EEA or may process data there. That is so in particular for the assistant''s language model and for any remote support.');

  perform pg_temp.put(v_privacy, array[7, 2],
    'Puhelinnumero yhdistää kuljettajan yritykseensä, ajoneuvoonsa ja keikkoihinsa kuljettajasovelluksessa. Kuljettajalle tarkoitetut ilmoitukset toimitetaan palvelussa ja kuljettajasovelluksessa; palvelu ei välitä viestejä WhatsAppin kautta.',
    'The telephone number links the driver to their company, vehicle and jobs in the driver app. Notices for the driver are delivered in the service and in the driver app; the service does not relay messages through WhatsApp.');

  perform pg_temp.put(v_privacy, array[10, 2],
    'Tilaaja ei näe kuljetusliikkeen henkilöstön yhteystietoja eikä kuljetusliike tilaajan laskutustietoja, ellei työ sitä edellytä. Kuljetusliike ei näe muiden kuljetusliikkeiden kalustoa eikä niiden sijaintia. Ajoneuvoista, jotka ovat ajaneet tilaajan keikkoja ja joiden kuljetusliike on sallinut suorat tilaukset, tilaaja näkee rekisteritunnuksen, kuljettajan nimen ja kuljetusliikkeen arvosanan, mutta ei kuljettajan puhelinnumeroa.',
    'A shipper does not see the carrier''s personnel contact details, and a carrier does not see the shipper''s billing details, unless the work requires it. A carrier does not see other carriers'' vehicles or their locations. For vehicles that have performed the shipper''s jobs and whose carrier has allowed direct orders, the shipper sees the registration number, the driver''s name and the carrier''s rating, but not the driver''s telephone number.');

  -- ── Соглашение заказчика ────────────────────────────────────────

  perform pg_temp.put(v_shipper, array[2, 5],
    'Tilaaja voi lähettää toimeksiannon suoraan tutulle ajoneuvolle käyttöehtojen kohdan 6.6 mukaisesti. Suora tilaus odottaa vahvistusta ilman määräaikaa, ja sopimus syntyy, kun ajoneuvon kuljetusliike tai kuljettaja vahvistaa sen. Siihen asti tilaaja voi siirtää toimeksiannon tarjouspöydälle. Aivomaa Oy on tilaajan sopimuskumppani myös suorissa tilauksissa, eikä suora tilaus muuta hinnoittelua, laskutusta eikä vastuita.',
    'The shipper may send a job directly to a known vehicle as set out in clause 6.6 of the terms of use. A direct order waits for confirmation without a deadline, and the contract is formed when the vehicle''s carrier or driver confirms it. Until then the shipper may move the job to the board. Aivomaa Oy is the shipper''s contracting party in direct orders as well, and a direct order does not change pricing, invoicing or liabilities.');

  raise notice 'Черновики: TERMS v%, PRIVACY v%, SHIPPER_AGREEMENT v%',
    (select version from public.legal_documents where id = v_terms),
    (select version from public.legal_documents where id = v_privacy),
    (select version from public.legal_documents where id = v_shipper);
end;
$$;
