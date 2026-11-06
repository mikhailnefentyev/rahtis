-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: без подряда Aivomaa (6.11.2026)
--
-- Решение пользователя 6.11.2026: Aivomaa Oy больше не сторона договоров
-- перевозки, режима подряда (Alihankkija) нет. RAHTIS — программа и
-- площадка: договор перевозки всегда напрямую между заказчиком и
-- перевозчиком, счёт выставляет перевозчик, претензии — между сторонами.
-- Сборов 5 % / 3 % / минимум 15 € нет; единственная плата — подписка
-- перевозчика: первая машина бесплатно, каждая следующая 14,90 €/мес.
-- Заказчику — бесплатно. Бывшим подрядчикам подписка с 1.1.2027.
-- Заказы, где Aivomaa уже сторона, доводятся по старым условиям
-- (переходное правило: TERMS 8.4, 12.4; договор заказчика 9.7, 10.5;
-- договор перевозчика — глава 12).
-- Полис экспедитора — добровольно, только отметка для перевозчика.
--
-- Нумерацию не трогаем: целые пункты — put по пути; пункты этой недели
-- (добавлены append в конец раздела) — по метке начала текста; одна
-- фраза — swap. Всё повторяемо.
-- Идёт после 20261106150200 (там пункт «Tilaajan yritysasiakirjat:»).
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

/* Текст пункта по пути целиком (upsert). */
create or replace function pg_temp.put(p_doc uuid, p_path integer[], p_fi text, p_en text)
returns void
language sql
as $$
  insert into public.legal_clauses (document_id, locale, path, body)
  values (p_doc, 'fi', p_path, p_fi), (p_doc, 'en', p_path, p_en)
  on conflict (document_id, locale, path) do update set body = excluded.body;
$$;

/* Пункт раздела по метке в начале финского текста; новый текст начинается с той же метки. */
create or replace function pg_temp.put_marked(p_doc uuid, p_section integer, p_marker text, p_fi text, p_en text)
returns void
language plpgsql
as $$
declare
  v_path integer[];
begin
  if position(p_marker in p_fi) <> 1 then
    raise exception 'Новый текст должен начинаться с метки «%»', p_marker;
  end if;

  select c.path into v_path
  from public.legal_clauses c
  where c.document_id = p_doc and c.locale = 'fi' and c.path[1] = p_section
    and cardinality(c.path) = 2 and position(p_marker in c.body) = 1
  order by c.path
  limit 1;

  if v_path is null then
    raise exception 'Раздел %: пункт «%» не найден', p_section, p_marker;
  end if;

  perform pg_temp.put(p_doc, v_path, p_fi, p_en);
end;
$$;

/* Замена фразы; если новая фраза уже стоит — ничего не делает. */
create or replace function pg_temp.swap(p_doc uuid, p_path integer[], p_locale text, p_from text, p_to text)
returns void
language plpgsql
as $$
begin
  if exists (
    select 1 from public.legal_clauses
    where document_id = p_doc and path = p_path and locale = p_locale and position(p_to in body) > 0
  ) then
    return;
  end if;

  update public.legal_clauses
  set body = replace(body, p_from, p_to)
  where document_id = p_doc and path = p_path and locale = p_locale and position(p_from in body) > 0;

  if not found then
    raise exception 'Пункт % (%): фрагмент не найден: %', array_to_string(p_path, '.'), p_locale, left(p_from, 60);
  end if;
end;
$$;

create or replace function pg_temp.swap2(p_doc uuid, p_path integer[], p_fi_from text, p_fi_to text, p_en_from text, p_en_to text)
returns void
language plpgsql
as $$
begin
  perform pg_temp.swap(p_doc, p_path, 'fi', p_fi_from, p_fi_to);
  perform pg_temp.swap(p_doc, p_path, 'en', p_en_from, p_en_to);
end;
$$;

/* Заголовок раздела. */
create or replace function pg_temp.retitle(p_doc uuid, p_section integer, p_fi text, p_en text)
returns void
language plpgsql
as $$
begin
  update public.legal_clauses set title = p_fi
  where document_id = p_doc and locale = 'fi' and path = array[p_section];
  if not found then
    raise exception 'Раздел % (fi) не найден', p_section;
  end if;

  update public.legal_clauses set title = p_en
  where document_id = p_doc and locale = 'en' and path = array[p_section];
  if not found then
    raise exception 'Раздел % (en) не найден', p_section;
  end if;
end;
$$;


-- ── TERMS ──────────────────────────────────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('TERMS');
begin
  /* Стороны и роль Aivomaa: площадка, не сторона перевозки. */
  perform pg_temp.put(v_doc, array[1, 2],
    'Nämä ehdot koskevat rekisteröintiä, käyttöoikeutta, tunnusten käyttöä, toimeksiantojen julkaisemista ja käsittelyä, asiakirjojen välittämistä, palvelun maksuja ja palvelun yleisiä pelisääntöjä. Tilaaja on yritys, joka julkaisee palvelussa toimeksiantoja tai lähettää niitä kuljetusliikkeille. Kuljetusliike on yritys, joka käyttää palvelua kalustonsa, kuljettajiensa ja ajojensa hallintaan sekä ottaa palvelussa vastaan toimeksiantoja ja suorittaa kuljetuksia. Käyttäjä on luonnollinen henkilö, joka toimii yrityksensä puolesta annettujen valtuuksien rajoissa.',
    'These terms govern registration, access, the use of accounts, the publishing and handling of jobs, the exchange of documents, the fees of the service and the general rules of the service. The shipper is a company that publishes jobs in the service or sends them to carriers. The carrier is a company that uses the service to manage its vehicles, drivers and runs and that accepts jobs and performs transports in the service. The user is a natural person acting on behalf of their company within the authority granted to them.');

  perform pg_temp.put(v_doc, array[1, 3],
    'RAHTIS on ohjelmistopalvelu ja markkinapaikka. Sen kautta tilaajat ja kuljetusliikkeet löytävät toisensa tarjouspöydällä, suorilla tilauksilla ja ryhmälle tarjotuilla toimeksiannoilla, ja kuljetusliikkeet hallitsevat omia keikkojaan, kalustoaan ja kuljettajiaan sekä käyttävät kuljettajasovellusta. Jokainen palvelussa tehtävä kuljetussopimus syntyy suoraan tilaajan ja kuljetusliikkeen välille. Aivomaa Oy ei ole kuljetussopimuksen osapuoli eikä toimi rahdinkuljettajana, sopimusrahdinkuljettajana tai huolitsijana. Aivomaa Oy ei laskuta rahtia, ei ota vastaan tilaajan ja kuljetusliikkeen välisiä maksuja eikä tilitä niitä kuljetusliikkeelle.',
    'RAHTIS is a software service and a marketplace. Through it shippers and carriers find each other on the offer table, through direct orders and through jobs offered to a group, and carriers manage their own jobs, vehicles and drivers and use the driver app. Every contract of carriage made in the service is formed directly between the shipper and the carrier. Aivomaa Oy is not a party to the contract of carriage and does not act as a carrier, a contracting carrier or a freight forwarder. Aivomaa Oy does not invoice freight, does not receive payments between the shipper and the carrier and does not settle them to the carrier.');

  perform pg_temp.put(v_doc, array[1, 4],
    'Aivomaa Oy ei itse kuljeta eikä omista kalustoa. Kuljetuksen suorittaa kuljetusliike omalla kalustollaan ja omalla liikenneluvallaan, ja se vastaa kuljetuksesta tilaajalle tiekuljetussopimuslain ja soveltuvin osin CMR-yleissopimuksen mukaisesti. Kuljetusliike laskuttaa tilaajaa, ja tilaaja maksaa kuljetuksen suoraan kuljetusliikkeelle. Aivomaa Oy ei vastaa kuljetuksesta, tavarasta, viivästyksestä eikä rahdin tai muun osapuolten välisen saatavan maksamisesta; niitä koskevat vaatimukset esitetään toiselle osapuolelle.',
    'Aivomaa Oy does not itself carry goods and does not own vehicles. The transport is performed by the carrier with its own vehicles and under its own operating licence, and the carrier is liable for the transport to the shipper under the Finnish Road Transport Contracts Act (tiekuljetussopimuslaki) and, where applicable, the CMR Convention. The carrier invoices the shipper, and the shipper pays for the transport directly to the carrier. Aivomaa Oy is not liable for the transport, the goods, delay or the payment of the freight or of any other amount owed between the parties; claims concerning them are made against the other party.');

  perform pg_temp.put(v_doc, array[2, 1],
    'Valtuutettu käyttäjä hyväksyy nämä ehdot yrityksen puolesta rekisteröinnin yhteydessä tai ennen palvelun käytön aloittamista. Tilaaja hyväksyy lisäksi tilaajan ehdot ennen kuin se julkaisee tai lähettää toimeksiantoja, ja kuljetusliike hyväksyy kuljetusliikkeen sopimuksen ennen kuin se ottaa toimeksiantoja vastaan; näiden ehtojen julkaiseminen ei korvaa niiden hyväksymistä.',
    'An authorised user accepts these terms on behalf of the company on registration or before starting to use the service. In addition, the shipper accepts the shipper terms before it publishes or sends jobs, and the carrier accepts the carrier agreement before it accepts jobs; publishing these terms does not replace their acceptance.');

  /* Тарьоуспёйтя и прямые заказы: договор всегда между сторонами, выбора стола нет. */
  perform pg_temp.put(v_doc, array[6, 2],
    'Toimeksiannon julkaiseminen, arviohinnan näkyminen tai automaattinen ilmoitus ei synnytä kuljetussopimusta. Aivomaa Oy ei takaa, että toimeksianto saa tarjouksia tai että kuljetusliike ottaa sen vastaan. Tarjouspöydällä yhtä toimeksiantoa kohti otetaan enintään kolme tarjousta.',
    'Publishing a job, the display of an estimated price or an automatic notification does not form a contract of carriage. Aivomaa Oy does not guarantee that a job receives offers or that a carrier accepts it. On the offer table at most three offers are taken per job.');

  perform pg_temp.put(v_doc, array[6, 3],
    'Tarjouspöydällä tilaaja valitsee tarjouksen, ja valittu kuljetusliike vahvistaa työn. Kummallakin päätöksellä on 15 minuutin määräaika, jonka jälkeen keikka palaa tarjottavaksi. Sitova kuljetussopimus syntyy tilaajan ja kuljetusliikkeen välille, kun kuljetusliike vahvistaa työn; siihen asti kumpikin voi perääntyä ilman seurauksia.',
    'On the offer table the shipper selects an offer, and the selected carrier confirms the work. Each decision has a deadline of 15 minutes, after which the job returns to the table. A binding contract of carriage is formed between the shipper and the carrier when the carrier confirms the work; until then either may withdraw without consequences.');

  perform pg_temp.put(v_doc, array[6, 4],
    'Vahvistuksessa määrittyvät kuljetussopimuksen osapuolet, reitti, kuorma tai kuljetettava yksikkö, aikataulu, hinta ja sen valuutta sekä erityisehdot. Vahvistus tallentuu palveluun molempien osapuolten nähtäväksi. Muista ehdoista, kuten maksuehdosta, osapuolet sopivat keskenään.',
    'The confirmation sets out the parties to the contract of carriage, the route, the cargo or the unit to be transported, the schedule, the price and its currency, and any special terms. The confirmation is stored in the service for both parties to see. The parties agree between themselves on other terms, such as the terms of payment.');

  perform pg_temp.swap2(v_doc, array[6, 6],
    'Jos ajoneuvon kuljetusliike käyttää palvelua kuukausimaksulla, suora tilaus tehdään tilaajan ja kuljetusliikkeen välille kohdan 8.5 (a) mukaisesti: kuljetusliike laskuttaa tilaajaa itse ja vastaa kuljetuksesta, ja Aivomaa Oy välittää tiedot ja raportin tehdystä työstä. Muissa tapauksissa Aivomaa Oy on tilaajan sopimuskumppani myös suorissa tilauksissa.',
    'Suora tilaus ja ryhmälle tarjottu toimeksianto tehdään tarjouspöydän tavoin tilaajan ja kuljetusliikkeen välille: kuljetusliike laskuttaa tilaajaa itse ja vastaa kuljetuksesta, ja Aivomaa Oy välittää tiedot ja raportin tehdystä työstä.',
    'If the vehicle''s carrier uses the service for a monthly fee, the direct order is made between the shipper and the carrier as set out in clause 8.5 (a): the carrier invoices the shipper itself and is responsible for the transport, and Aivomaa Oy passes on the data and a report of the work done. In other cases Aivomaa Oy is the shipper''s contracting party in direct orders as well.',
    'A direct order and a job offered to a group are made between the shipper and the carrier in the same way as on the offer table: the carrier invoices the shipper itself and is responsible for the transport, and Aivomaa Oy passes on the data and a report of the work done.');

  /* Имена: после договора стороны видят друг друга; анонимность — только для старых заказов. */
  perform pg_temp.swap2(v_doc, array[6, 7],
    'Jos ajoneuvon kuljetusliike käyttää palvelua kuukausimaksulla, tilaaja näkee lisäksi kuljetusliikkeen nimen, y-tunnuksen sekä maksamista varten tilinumeron ja BIC-koodin: osapuolet laskuttavat ja maksavat keskenään, eikä laskuttajaa voi jättää tuntemattomaksi. Jos keikka ajetaan alihankintana, kuljetusliikkeen nimi ja muut tiedot eivät näy tilaajalle, koska tilaajan sopimuskumppani ja laskuttaja on Aivomaa Oy. Vastaavasti kuljetusliike näkee tilaajan nimen vain niistä tilaajista, joiden kanssa se laskuttaa suoraan tai jotka se on itse kutsunut palveluun; muutoin tilaajat näkyvät sille koodilla, keikkamäärällä ja viimeisimmällä reitillä.',
    'Tällaisista ajoneuvoista tilaaja näkee lisäksi kuljetusliikkeen nimen, y-tunnuksen sekä maksamista varten tilinumeron ja BIC-koodin: osapuolet laskuttavat ja maksavat keskenään, eikä laskuttajaa voi jättää tuntemattomaksi. Samat tiedot tilaaja näkee kuljetusliikkeestä, jonka kanssa sille on syntynyt kuljetussopimus tarjouspöydällä tai ryhmälle tarjotussa toimeksiannossa. Kuljetusliike näkee tilaajan nimen ja laskuttamiseen tarvittavat tiedot niistä tilaajista, joiden kanssa sillä on kuljetussopimus tai jotka se on itse kutsunut palveluun; muutoin tilaajat näkyvät sille koodilla, keikkamäärällä ja viimeisimmällä reitillä. Keikoissa, joissa Aivomaa Oy on kohdan 8.4 siirtymäsäännöksen mukaisesti tilaajan sopimuskumppani, osapuolten nimet ja muut tiedot eivät näy toisilleen.',
    'If the vehicle''s carrier uses the service for a monthly fee, the shipper also sees the carrier''s name, business identity code and, for payment, its account number and BIC code: the parties invoice and pay each other, and the party issuing the invoice cannot remain unknown. If the job is performed as subcontracting, the carrier''s name and other details are not shown to the shipper, because the shipper''s contracting party and invoicing party is Aivomaa Oy. Likewise, the carrier sees a shipper''s name only for those shippers it invoices directly or has itself invited to the service; otherwise shippers are shown to it by a code, the number of jobs and the latest route.',
    'For such vehicles the shipper also sees the carrier''s name, business identity code and, for payment, its account number and BIC code: the parties invoice and pay each other, and the party issuing the invoice cannot remain unknown. The shipper sees the same details of a carrier with which it has formed a contract of carriage on the offer table or in a job offered to a group. The carrier sees the name and the details needed for invoicing of those shippers with which it has a contract of carriage or which it has itself invited to the service; otherwise shippers are shown to it by a code, the number of jobs and the latest route. In jobs in which Aivomaa Oy is the shipper''s contracting party under the transitional provision of clause 8.4, the names and other details of the parties are not shown to each other.');

  perform pg_temp.swap2(v_doc, array[6, 10],
    'Kohdan 6.7 nimettömyys koskee myös viestejä: viestissä näytetään lähettäjän rooli ja kuljettajan etunimi.',
    'Viestissä näytetään lähettäjän rooli ja kuljettajan etunimi.',
    'The anonymity of clause 6.7 also applies to messages: a message shows the sender''s role and the driver''s first name.',
    'A message shows the sender''s role and the driver''s first name.');

  /* Отмена и отказ: последствия — между сторонами, не через Aivomaa. */
  perform pg_temp.put(v_doc, array[7, 4],
    'Tilaaja voi peruuttaa toimeksiannon palvelussa ennen sen valmistumista. Aivomaa Oy voi poistaa toimeksiannon palvelusta, jos se on näiden ehtojen tai lain vastainen. Peruutus kirjataan lokiin syineen, ja kuljetusliikkeelle ilmoitetaan. Jos kuljetussopimus on jo syntynyt, peruutuksen seuraukset, kuten tehdystä työstä maksettava osuus, määräytyvät tilaajan ja kuljetusliikkeen välillä niiden sopimuksen, tilaajan ehtojen ja sovellettavan lain mukaan.',
    'The shipper may cancel a job in the service before it is completed. Aivomaa Oy may remove a job from the service if it is contrary to these terms or the law. The cancellation is written to the log with its reason and the carrier is notified. If a contract of carriage has already been formed, the consequences of the cancellation, such as the amount payable for work done, are determined between the shipper and the carrier under their contract, the shipper terms and applicable law.');

  perform pg_temp.put(v_doc, array[7, 5],
    'Kuljetusliike voi perääntyä vahvistamastaan keikasta. Jos yhtään pistettä ei ole ohitettu, keikka palaa muiden tarjottavaksi; jos ajo on alkanut, keikka keskeytetään ja tilaajalle ilmoitetaan. Perääntyminen kirjataan lokiin. Vastaanotettu kuorma, perävaunu tai kontti säilytetään asianmukaiseen luovutukseen asti, ja luovutuksesta sovitaan tilaajan kanssa. Perääntymisen seuraukset määräytyvät tilaajan ja kuljetusliikkeen välillä niiden sopimuksen ja sovellettavan lain mukaan.',
    'The carrier may step back from a job it has confirmed. If no stop has been reached, the job returns to the table for others; if the run has started, the job is interrupted and the shipper is notified. Stepping back is written to the log. A load, trailer or container already taken over is kept until it is properly handed over, and the handover is agreed with the shipper. The consequences of stepping back are determined between the shipper and the carrier under their contract and applicable law.');

  /* Раздел 8: счёт выставляет перевозчик; полумесячные периоды — только старые заказы. */
  perform pg_temp.retitle(v_doc, 8,
    'Asiakirjat, raportit, laskutus ja maksut',
    'Documents, reports, invoicing and fees');

  perform pg_temp.swap2(v_doc, array[8, 2],
    'suorittaja ilmoittaa syyn Aivomaa Oy:lle ja toimittaa',
    'kuljetusliike ilmoittaa syyn tilaajalle ja toimittaa sille',
    'the performer reports the reason to Aivomaa Oy and delivers',
    'the carrier reports the reason to the shipper and delivers to it');

  perform pg_temp.put(v_doc, array[8, 4],
    'Kuljetusliike laskuttaa tilaajaa kuljetuksesta omissa nimissään, ja tilaaja maksaa laskun suoraan kuljetusliikkeelle osapuolten sopimien maksuehtojen mukaisesti. Palvelu voi muodostaa ja lähettää laskun kuljetusliikkeen pyynnöstä tämän nimissä ja tiedoilla; Aivomaa Oy ei tällöinkään ole laskun osapuoli eikä peri saatavaa. Siirtymäsäännös: tilaukset, jotka on ennen tämän ehtoversion voimaantuloa julkaistu tai vahvistettu niin, että Aivomaa Oy on tilaajan sopimuskumppani, viedään loppuun niiden tekohetkellä voimassa olleiden ehtojen mukaisesti. Niissä Aivomaa Oy laskuttaa tilaajaa puolen kuukauden tilityskausittain, maksaa kuljetusliikkeelle tilityksen ja käsittelee reklamaatiot ja vaatimukset aiempien ehtojen mukaisesti, ja niistä peritään aiempien ehtojen mukaiset palvelumaksut.',
    'The carrier invoices the shipper for the transport in its own name, and the shipper pays the invoice directly to the carrier in accordance with the terms of payment agreed between the parties. At the carrier''s request the service may produce and send the invoice in the carrier''s name and with its details; even then Aivomaa Oy is not a party to the invoice and does not collect the receivable. Transitional provision: orders published or confirmed, before this version of the terms entered into force, on the basis that Aivomaa Oy is the shipper''s contracting party are completed under the terms in force when they were made. In those orders Aivomaa Oy invoices the shipper by half-month settlement periods, pays the settlement to the carrier and handles claims and demands under the earlier terms, and the service fees under the earlier terms are charged on them.');

  /* Единственная плата — подписка перевозчика; бывшим подрядчикам с 1.1.2027. */
  perform pg_temp.put(v_doc, array[8, 5],
    'Palvelun käyttö on tilaajalle maksutonta. Kuljetusliike maksaa palvelusta kuukausimaksun, joka lasketaan kalenterikuukausittain ajoneuvoista, joilla on kyseisen kuukauden aikana merkitty valmiiksi vähintään yksi keikka; muista palveluun rekisteröidyistä ajoneuvoista ei makseta. Ensimmäisestä tällaisesta ajoneuvosta ei makseta; kustakin seuraavasta ajoneuvosta maksu on 14,90 euroa kuukaudessa ilman arvonlisäveroa. 100. ajoneuvosta alkaen hinnasta voidaan sopia erikseen; ellei toisin sovita, sovelletaan samaa hintaa. Kuljetusliike voi maksaa vuoden etukäteen valitsemastaan ajoneuvomäärästä, jolloin se maksaa kahdentoista kuukauden hinnan kyseisestä määrästä 10 prosentilla alennettuna. Vuosi alkaa maksua seuraavan kalenterikuukauden alusta tai maksuttoman jakson jälkeen. Vuoden aikana valittua määrää useammista ajoneuvoista maksetaan kuukausittain 14,90 euroa ajoneuvolta ilman alennusta; jos ajoneuvoja on vähemmän, vuosimaksua ei palauteta. Maksu on sama riippumatta siitä, onko keikka kuljetusliikkeen oma keikka, suora tilaus, ryhmälle tarjottu vai tarjouspöydältä otettu toimeksianto. Aivomaa Oy ei peri tilaajalta eikä kuljetusliikkeeltä keikkakohtaista palvelumaksua, prosenttiosuutta eikä vähimmäismaksua. Kuukausimaksu laskutetaan kuukauden päätyttyä tavanomaisin maksuehdoin. Yrityksen hyväksymiskuukauden loppuosa ja sitä seuraava kokonainen kalenterikuukausi ovat maksuttomia; jos yritys hyväksytään kuukauden ensimmäisenä päivänä, maksuton on kyseinen kuukausi. Kuljetusliike, joka käytti palvelua Aivomaa Oy:n alihankkijana tämän ehtoversion tullessa voimaan, siirtyy kuukausimaksuun, ja sen kuukausimaksu kertyy 1.1.2027 alkaen, kuitenkin aikaisintaan maksuttoman jakson päätyttyä. Arvonlisävero määräytyy sopimuskumppanin maan mukaan: suomalaiselle yritykselle lisätään 25,5 prosenttia, muun maan yritykselle sovelletaan käännettyä verovelvollisuutta, jolloin myyjä laskuttaa nollalla ja ostaja tilittää veron omassa maassaan.',
    'The use of the service is free of charge for the shipper. The carrier pays a monthly fee for the service, calculated per calendar month for the vehicles that have at least one job marked complete during that month; no fee is charged for the other vehicles registered in the service. No fee is charged for the first such vehicle; for each further vehicle the fee is 14.90 euros per month excluding value added tax. From the 100th vehicle the price may be agreed separately; unless otherwise agreed, the same price applies. The carrier may pay a year in advance for a number of vehicles it chooses, in which case it pays the price of twelve months for that number less 10 per cent. The year begins at the start of the calendar month following the payment or after the free period. During the year, vehicles above the chosen number are charged monthly at 14.90 euros per vehicle without discount; if there are fewer vehicles, the annual fee is not refunded. The fee is the same whether the job is the carrier''s own job, a direct order, a job offered to a group or a job taken from the offer table. Aivomaa Oy charges neither the shipper nor the carrier any per-job service fee, percentage or minimum fee. The monthly fee is invoiced after the end of the month on the usual payment terms. The remainder of the company''s approval month and the following full calendar month are free of charge; if the company is approved on the first day of a month, that month is free. A carrier that used the service as a subcontractor of Aivomaa Oy when this version of the terms entered into force moves to the monthly fee, and its monthly fee accrues from 1 January 2027, but not before the end of the free period. Value added tax is determined by the country of the contracting party: 25.5 per cent is added for a Finnish company, and the reverse charge applies to a company from another country, whereby the seller invoices at zero and the buyer accounts for the tax in its own country.');

  perform pg_temp.put(v_doc, array[8, 6],
    'Edellisen viikon (maanantaista sunnuntaihin) raportti muodostetaan ja lähetetään jokaiselle yritykselle sen omista töistä maanantaisin kello 4.00 UTC, mikä on Suomen aikaa 6.00 talvella ja 7.00 kesällä. Viikkoraportti ei ole lasku. Aivomaa Oy ei laadi laskuja kuljetusliikkeen puolesta itselaskutuksena lukuun ottamatta kohdan 8.4 siirtymäsäännöksen tilausten tilityksiä, jos siitä on sovittu kuljetusliikkeen sopimuksessa; muut kuljetusliikkeen laskut laaditaan sen omissa nimissään kohtien 8.4 ja 8.8 mukaisesti.',
    'A report on the previous week, Monday to Sunday, is produced and sent to each company on its own work on Mondays at 04:00 UTC, which is 06:00 Finnish time in winter and 07:00 in summer. The weekly report is not an invoice. Aivomaa Oy does not draw up invoices on the carrier''s behalf by self-billing, except for the settlements of orders under the transitional provision of clause 8.4 where this has been agreed in the carrier agreement; the carrier''s other invoices are drawn up in its own name as set out in clauses 8.4 and 8.8.');

  perform pg_temp.swap2(v_doc, array[8, 7],
    'ne näkyvät keikan reklamaatioissa todisteena',
    'niitä voidaan käyttää reklamaatioissa todisteena',
    'appear in the job''s claims as evidence',
    'may be used in claims as evidence');

  perform pg_temp.put_marked(v_doc, 8, 'Valuutat:',
    'Valuutat: Aivomaa Oy:n kuukausimaksut ja laskut ovat euroissa. Yritys voi valita palvelussa oman valuuttansa (euro, Ruotsin, Norjan tai Tanskan kruunu tai Puolan złoty). Sitä käytetään yrityksen omissa keikoissa, ajoneuvojen kuluissa, polttoainekirjauksissa, palkkalaskelmissa ja omissa työmaissa. Tilaajan ja kuljetusliikkeen välisen kuljetuksen hinta on toimeksiannossa ilmoitetussa valuutassa, ja kuljetusliike laskuttaa tilaajaa tässä valuutassa. Kohdan 8.4 siirtymäsäännöksen tilausten hinnat, palvelumaksut, laskut ja tilitykset ovat euroissa. Polttoaineen ostot kirjataan kuitin valuutassa. Kukin summa säilytetään siinä valuutassa, jossa se on kirjattu, eikä valuutan vaihtaminen muuta aiempia summia. Palvelun näyttämät muunnokset ja yhteenvedot lasketaan Euroopan keskuspankin viitekursseilla kirjauspäivältä; ne ovat suuntaa-antavia eivätkä muuta sovittua hintaa tai laskun valuuttaa.',
    'Currencies: the monthly fees and invoices of Aivomaa Oy are in euros. A company may choose its own currency in the service (euro, Swedish, Norwegian or Danish krone, or Polish złoty). It is used for the company''s own jobs, vehicle costs, fuel records, pay calculations and own worksites. The price of a transport between a shipper and a carrier is in the currency stated in the job, and the carrier invoices the shipper in that currency. The prices, service fees, invoices and settlements of orders under the transitional provision of clause 8.4 are in euros. Fuel purchases are recorded in the currency of the receipt. Each amount is kept in the currency in which it was recorded, and changing the currency does not change earlier amounts. Conversions and totals shown by the service are calculated at the European Central Bank reference rates of the day of the record; they are indicative and do not change the agreed price or the currency of an invoice.');

  /* Полис экспедитора: добровольно, только отметка; без приостановки публикации. */
  perform pg_temp.put_marked(v_doc, 8, 'Huolitsijan vastuuvakuutus:',
    'Huolitsijan vastuuvakuutus: tilaaja, joka toimii huolitsijana tai muuna kuljetusten välittäjänä, voi vapaaehtoisesti toimittaa palveluun huolitsijan vastuuvakuutuksensa vakuutustodistuksen tai vakuutuskirjan, ja puolalainen tilaaja luvan tavarankuljetusten välitykseen (licencja na pośrednictwo przy przewozie rzeczy). Vakuutuksen toimittaminen ei ole palvelun käytön eikä toimeksiantojen julkaisemisen edellytys. Aivomaa Oy tarkastaa toimitetun asiakirjan ja voi pyytää vakuutuksen voimassaolosta vahvistuksen suoraan vakuutuksenantajalta. Toimeksiannon yhteydessä palvelu näyttää kuljetusliikkeelle joko merkinnän, että tilaajan vakuutus on tarkastettu ja voimassa tiettyyn päivään asti, merkinnän, ettei vakuutusta ole vahvistettu, tai tiedon, että tilaaja kuljettaa omia tavaroitaan. Merkintä vakuutuksen tarkastamisesta näytetään, kun vakuutuksen vastuumäärä on vähintään 250 000 euroa vahinkotapahtumaa kohden ja vähintään 500 000 euroa vakuutuskautta kohden yhteensä ja vakuutus kattaa huolintatoiminnan vähintään Euroopan talousalueella ja Norjassa; muussa valuutassa ilmoitettu vastuumäärä muunnetaan euroiksi Euroopan keskuspankin viitekurssilla tarkastuspäivänä. Merkintä poistuu, kun vakuutus päättyy tai sen voimassaoloa ei ole voitu vahvistaa. Jos tilaaja ottaa kuljetuksen hoitaakseen omissa nimissään sopimusrahdinkuljettajana, se vastaa kuljetuksesta tiekuljetussopimuslain ja CMR-yleissopimuksen mukaisesti vakuutuksesta riippumatta. Aivomaa Oy:n tekemä tarkastus on tieto eikä takuu vakuutuksen voimassaolosta, korvauksista eikä tilaajan maksukyvystä, eikä se vapauta osapuolia tekemästä omaa selvitystään sopimuskumppanistaan.',
    'Freight forwarder''s liability insurance: a shipper acting as a freight forwarder or other intermediary of transport may voluntarily provide the service with the insurance certificate or policy of its freight forwarder''s liability insurance, and a Polish shipper with its licence for intermediation in the carriage of goods (licencja na pośrednictwo przy przewozie rzeczy). Providing the insurance is not a condition for using the service or for publishing jobs. Aivomaa Oy checks the document provided and may request confirmation of the validity of the insurance directly from the insurer. In connection with a job the service shows the carrier either a note that the shipper''s insurance has been checked and is valid until a certain date, a note that the insurance has not been confirmed, or information that the shipper transports its own goods. The note that the insurance has been checked is shown when the limit of indemnity is at least EUR 250,000 per occurrence and at least EUR 500,000 in the aggregate per insurance period and the insurance covers forwarding activities at least in the European Economic Area and Norway; a limit stated in another currency is converted into euros at the European Central Bank reference rate on the date of the check. The note is removed when the insurance ends or its validity could not be confirmed. If the shipper undertakes a transport in its own name as a contracting carrier, it is liable for the transport under the Finnish Road Transport Contracts Act (tiekuljetussopimuslaki) and the CMR Convention regardless of the insurance. The check made by Aivomaa Oy is information and not a guarantee of the validity of the insurance, of any indemnity or of the shipper''s ability to pay, and it does not release the parties from making their own enquiries about their contracting party.');

  /* Платёжные сведения: история по счетам Aivomaa — только где она есть. */
  perform pg_temp.put_marked(v_doc, 8, 'Tilaajan maksutiedot:',
    'Tilaajan maksutiedot: kuljetusliike laskuttaa tilaajaa itse, eikä Aivomaa Oy takaa rahdin maksamista. Toimeksiannon yhteydessä palvelu näyttää kuljetusliikkeelle tilaajasta seuraavat tiedot: yrityksen ikä kaupparekisterin tai muun yritysrekisterin mukaan tai, jos sitä ei ole saatavilla, palvelun käyttöönoton ajankohta; julkisista rekistereistä ilmenevä tila, kuten konkurssi, yrityssaneeraus tai selvitystila sekä merkinnät ennakkoperintä- ja arvonlisäverorekistereihin; kuljetusliikkeiden maksuilmoitusten yhteenveto; tilaajan toteutuneiden kuljetusten määrä sekä tilaajan yritysasiakirjojen tarkastusmerkinnät. Jos tilaajalla on kohdan 8.4 siirtymäsäännöksen mukaisia kuljetuksia, joista Aivomaa Oy on laskuttanut sitä, palvelu voi näyttää myös tilaajan maksukäyttäytymisen niissä. Kuljetusliikkeiden ilmoitukset näytetään vain yhteenvetona ilman ilmoittajaa tai yksittäistä kuljetusta koskevia tietoja. Tiedot annetaan ainoastaan tiedoksi, eivätkä ne ole luottoluokitus, arvio maksukyvystä eikä takuu. Kuljetusliikkeiden ilmoitukset ovat niiden omia ilmoituksia, joiden oikeellisuutta Aivomaa Oy ei tarkasta etukäteen. Aivomaa Oy voi poistaa ilmoituksen, joka osoitetaan virheelliseksi. Kumpikin osapuoli päättää itse sopimuksen tekemisestä ja maksuehdoista.',
    'Shipper''s payment information: the carrier invoices the shipper itself, and Aivomaa Oy does not guarantee the payment of the freight. In connection with a job the service shows the carrier the following information about the shipper: the age of the company according to the trade register or another company register or, where that is not available, the date on which the shipper started using the service; its status as shown in public registers, such as bankruptcy, restructuring or liquidation and entries in the prepayment and VAT registers; a summary of the payment reports made by carriers; the number of transports completed by the shipper; and the check marks of the shipper''s company documents. Where the shipper has transports under the transitional provision of clause 8.4 that Aivomaa Oy has invoiced to it, the service may also show the shipper''s payment record for those transports. Reports by carriers are shown only as a summary, without information on the reporting carrier or on individual transports. The information is provided for information only and is not a credit rating, an assessment of solvency or a guarantee. Reports by carriers are the carriers'' own statements, the accuracy of which Aivomaa Oy does not check in advance. Aivomaa Oy may remove a report that is shown to be incorrect. Each party decides for itself whether to enter into a contract and on the terms of payment.');

  /* Пункт из 20261106150200: «прямой договор» теперь всегда — оговорка лишняя. */
  perform pg_temp.put_marked(v_doc, 8, 'Tilaajan yritysasiakirjat:',
    'Tilaajan yritysasiakirjat: tilaaja voi vapaaehtoisesti toimittaa palveluun otteen kaupparekisteristä tai muusta yritysrekisteristä, todistuksen verovelattomuudesta, todistuksen arvonlisäverorekisteröinnistä sekä asiakirjan, josta ilmenee asiakirjat toimittaneen henkilön oikeus edustaa tilaajaa, kuten valtakirjan. Asiakirjojen toimittaminen ei ole palvelun käytön edellytys. Aivomaa Oy tarkastaa toimitetut asiakirjat ja voi hyväksyä tai hylätä ne. Kuljetusliike näkee tilaajan maksutietojen yhteydessä ainoastaan sen, onko asiakirja tarkastettu, asiakirjan antamispäivän ja päivän, johon asti tarkastusmerkintä on voimassa; asiakirjoja tai niiden sisältöä ei luovuteta kuljetusliikkeelle. Tarkastusmerkintä kuvaa asiakirjan sisältöä sen antamispäivänä. Se ei ole Aivomaa Oy:n vakuutus tilaajan taloudellisesta tilanteesta, maksukyvystä tai edustajan toimivallasta eikä takuu rahdin maksamisesta. Tilaaja vastaa siitä, että sen toimittamat asiakirjat ovat aitoja ja ajantasaisia.',
    'Shipper''s company documents: the shipper may voluntarily provide the service with an extract from the trade register or another company register, a certificate of the absence of tax debts, a certificate of VAT registration and a document showing the right of the person who provided the documents to represent the shipper, such as a power of attorney. Providing the documents is not a condition for using the service. Aivomaa Oy checks the documents provided and may approve or reject them. Together with the shipper''s payment information, the carrier only sees whether a document has been checked, the date of issue of the document and the date until which the check mark is valid; the documents or their contents are not disclosed to the carrier. A check mark reflects the content of the document on its date of issue. It is not a representation by Aivomaa Oy as to the shipper''s financial position, solvency or the authority of its representative, nor a guarantee of payment of the freight. The shipper is responsible for ensuring that the documents it provides are genuine and up to date.');

  perform pg_temp.swap2(v_doc, array[9, 3],
    'voidaan toimittaa Aivomaa Oy:lle sovittua varakanavaa käyttäen',
    'voidaan toimittaa toiselle osapuolelle muuta kanavaa käyttäen',
    'may be delivered to Aivomaa Oy through an agreed fallback channel',
    'may be delivered to the other party through another channel');

  perform pg_temp.put(v_doc, array[10, 3],
    'Palvelussa vahvistettu tilaus on tilaajan ja kuljetusliikkeen välinen, ja siihen sovelletaan sen vahvistettuja ehtoja, kunnes osapuolet sopivat toisin. Palvelu ei rajoita osapuolten oikeutta sopia keskenään muista kuljetuksista palvelun ulkopuolella.',
    'An order confirmed in the service is between the shipper and the carrier, and its confirmed terms apply to it until the parties agree otherwise. The service does not restrict the parties'' right to agree between themselves on other transports outside the service.');

  /* Раздел 12: претензии — между сторонами; процедура Aivomaa — только старые заказы. */
  perform pg_temp.put(v_doc, array[12, 1],
    'Kuljetusta koskevat reklamaatiot ja vaatimukset, kuten lastin tai perävaunun vauriota, vajausta, viivästystä, odotusaikaa tai poikkeamaa reitistä tai aikataulusta koskevat, ovat tilaajan ja kuljetusliikkeen välisiä, ja osapuolet käsittelevät ne keskenään. Aivomaa Oy ei ole reklamaation osapuoli, ei käsittele eikä ratkaise sitä eikä maksa tai peri korvauksia. Keikan asiakirjat, valokuvat, tapahtumaloki ja viestit ovat molempien osapuolten käytettävissä palvelussa kohdan 12.3 mukaisesti.',
    'Claims and demands concerning a transport, such as those concerning damage to the cargo or trailer, shortage, delay, waiting time or a deviation from the route or schedule, are between the shipper and the carrier, and the parties handle them between themselves. Aivomaa Oy is not a party to the claim, does not handle or decide it and does not pay or collect compensation. The documents, photographs, event log and messages of the job are available to both parties in the service as set out in clause 12.3.');

  perform pg_temp.put(v_doc, array[12, 2],
    'Reklamaatio tehdään suoraan toiselle osapuolelle viivytyksettä sen jälkeen, kun poikkeama on havaittu tai sen olisi pitänyt havaita. Siinä kerrotaan, mitä, missä ja milloin tapahtui, vaadittu summa, jos se tiedetään, sekä käytettävissä oleva näyttö. Osapuolten on noudatettava rahtikirjaan tehtäviä varaumia sekä sovellettavan lain, mukaan lukien tiekuljetussopimuslain ja soveltuvin osin CMR-yleissopimuksen, mukaisia ilmoituksia, menettelyjä ja määräaikoja; palvelun merkinnät eivät korvaa niitä.',
    'A claim is made directly to the other party without delay once the deviation was noticed or should have been noticed. It states what happened, where and when, the amount claimed if known, and the available evidence. The parties must observe the reservations entered in the consignment note and the notices, procedures and time limits required by applicable law, including the Finnish Road Transport Contracts Act and, where applicable, the CMR Convention; entries in the service do not replace them.');

  perform pg_temp.put(v_doc, array[12, 3],
    'Keikan asiakirjat ja valokuvat, kuljettajan kirjaamat saapumis- ja valmistumisajat sekä keikan tapahtumaloki säilyvät palvelussa tietosuojaselosteen mukaiset säilytysajat, ja osapuolet voivat käyttää niitä näyttönä. Aivomaa Oy voi osapuolen pyynnöstä antaa otteen keikan tapahtumalokista. Näyttöä arvioidaan kohdan 8 mukaisesti muun näytön kanssa.',
    'The documents and photographs of the job, the arrival and completion times recorded by the driver and the event log of the job are kept in the service for the retention periods set out in the privacy notice, and the parties may use them as evidence. At a party''s request Aivomaa Oy may provide an extract from the event log of the job. Evidence is assessed together with other evidence as set out in section 8.');

  perform pg_temp.put(v_doc, array[12, 4],
    'Kohdan 8.4 siirtymäsäännöksen tilauksissa, joissa Aivomaa Oy on tilaajan sopimuskumppani, reklamaatio tehdään palvelussa keikan kortilta tai osoitteeseen admin@rahtis.eu, ja Aivomaa Oy käsittelee sen sopimuskumppanina ja osapuolten välisenä välittäjänä tilauksen vahvistamishetkellä voimassa olleiden ehtojen mukaisesti. Aivomaa Oy:n ratkaisu on tällöin sen kanta sopimuskumppanina; se ei ole välitystuomio eikä estä osapuolta saattamasta asiaa tuomioistuimen ratkaistavaksi.',
    'In orders under the transitional provision of clause 8.4 in which Aivomaa Oy is the shipper''s contracting party, a claim is filed in the service from the job card or sent to admin@rahtis.eu, and Aivomaa Oy handles it as a contracting party and as an intermediary between the parties under the terms in force when the order was confirmed. Aivomaa Oy''s resolution is then its position as a contracting party; it is not an arbitral award and does not prevent a party from bringing the matter before a court.');

  perform pg_temp.put(v_doc, array[12, 5],
    'Reklamaatio ei sellaisenaan oikeuta pidättämään riidatonta maksua. Osapuolet sopivat hyväksytyn vaatimuksen maksamisesta tai kuittaamisesta keskenään. Aivomaa Oy ei kuittaa osapuolten välisiä saatavia eikä pidätä maksuja kummankaan puolesta.',
    'A claim does not in itself entitle a party to withhold an undisputed payment. The parties agree between themselves on paying or setting off an accepted claim. Aivomaa Oy does not set off receivables between the parties and does not withhold payments on behalf of either of them.');

  perform pg_temp.put(v_doc, array[13, 1],
    'Aivomaa Oy vastaa palvelun tarjoamisesta näiden ehtojen ja sovellettavan lain mukaan. Kuljetuksesta, kalustosta ja kuljettajista vastaa kuljetusliike ja toimeksiannon tiedoista tilaaja; kumpikin osapuoli vastaa itse antamiensa tietojen oikeellisuudesta. Aivomaa Oy ei vastaa kuljetuksesta, tavarasta, viivästyksestä, osapuolten välisistä maksuista eikä toisen osapuolen sitoumusten täyttämisestä. Nämä ehdot eivät poista eivätkä rajoita vastuuta, jota ei voi sopimuksella poistaa tai rajoittaa.',
    'Aivomaa Oy is responsible for providing the service in accordance with these terms and applicable law. The carrier is responsible for the transport, its equipment and its drivers, and the shipper for the information in the job; each party is responsible for the accuracy of the data it enters. Aivomaa Oy is not liable for the transport, the goods, delay, payments between the parties or the performance of the other party''s commitments. These terms neither exclude nor limit liability that cannot be excluded or limited by agreement.');

  perform pg_temp.put(v_doc, array[13, 3],
    'Sovelletaan Suomen lakia, kuitenkin niin, että pakottavat säännökset ja sovellettavat kansainväliset yleissopimukset ovat etusijalla. Aivomaa Oy ja yritys yrittävät ensin sopia näitä ehtoja koskevan riidan osoitteen admin@rahtis.eu kautta. Jos sopimukseen ei päästä, riita käsitellään Helsingin käräjäoikeudessa. Tilaajan ja kuljetusliikkeen väliset kuljetussopimusta koskevat riidat ratkaistaan niiden sopimuksen ja sovellettavan lain mukaan, ja oikeuspaikka määräytyy osapuolten sopimuksen ja pakottavien oikeuspaikkasäännösten, mukaan lukien sovellettava CMR-yleissopimus, mukaan; Aivomaa Oy ei ole näissä riidoissa osapuoli.',
    'Finnish law applies, subject to the precedence of mandatory provisions and applicable international conventions. Aivomaa Oy and the company first seek to settle a dispute concerning these terms through admin@rahtis.eu. Failing agreement, the dispute is heard by the District Court of Helsinki. Disputes between a shipper and a carrier concerning the contract of carriage are resolved under their contract and applicable law, and the forum is determined by the parties'' agreement and mandatory rules on jurisdiction, including the applicable CMR Convention; Aivomaa Oy is not a party to such disputes.');
end;
$$;


-- ── SHIPPER_AGREEMENT: из условий перевозки Aivomaa — в условия заказчика площадки ──

do $$
declare
  v_doc uuid := pg_temp.draft_of('SHIPPER_AGREEMENT');
begin
  perform pg_temp.put(v_doc, array[1, 1],
    'Näitä ehtoja sovelletaan, kun yritys tai ammatinharjoittaja käyttää Aivomaa Oy:n (Y-tunnus 3592993-6, Kankarepolku 5F B335, 00770 Helsinki) RAHTIS-palvelua kuljetusten tilaamiseen: julkaisee toimeksiantoja tarjouspöydälle, tarjoaa niitä ryhmälle ajoneuvoja tai lähettää suoria tilauksia kuljetusliikkeille. Yhteydenotot: admin@rahtis.eu. Tilaaja on yritys tai ammatinharjoittaja, jonka puolesta toimeksianto on julkaistu tai tilaus lähetetty.',
    'These terms apply when a company or self-employed operator uses the RAHTIS service of Aivomaa Oy (business ID 3592993-6, Kankarepolku 5F B335, 00770 Helsinki, Finland) to order transports: publishes jobs on the offer table, offers them to a group of vehicles or sends direct orders to carriers. Contact: admin@rahtis.eu. The shipper is the company or self-employed operator on whose behalf a job has been published or an order sent.');

  perform pg_temp.put(v_doc, array[1, 2],
    'Aivomaa Oy tarjoaa RAHTIS-palvelun markkinapaikkana ja ohjelmistona. Kuljetussopimus syntyy suoraan tilaajan ja kuljetusliikkeen välille, kun kuljetusliike vahvistaa tilaajan valitseman tarjouksen tai suoran tilauksen tai ottaa ryhmälle tarjotun toimeksiannon. Aivomaa Oy ei ole kuljetussopimuksen osapuoli eikä rahdinkuljettaja tai huolitsija, ei laskuta rahtia, ei ota vastaan tilaajan maksuja kuljetusliikkeelle eikä vastaa kuljetuksesta, tavarasta, viivästyksestä tai kuljetusliikkeen sitoumusten täyttämisestä. Palvelun käyttö on tilaajalle maksutonta.',
    'Aivomaa Oy provides the RAHTIS service as a marketplace and as software. The contract of carriage is formed directly between the shipper and the carrier when the carrier confirms the offer selected by the shipper or a direct order, or takes a job offered to a group. Aivomaa Oy is not a party to the contract of carriage, nor a carrier or a freight forwarder; it does not invoice freight, does not receive the shipper''s payments to the carrier and is not liable for the transport, the goods, delay or the performance of the carrier''s commitments. The use of the service is free of charge for the shipper.');

  perform pg_temp.put(v_doc, array[1, 3],
    'Tilaaja hyväksyy nämä ehdot ennen kuin se julkaisee tai lähettää ensimmäisen toimeksiannon. Lisäksi sovelletaan hyväksyttyjä RAHTIS-käyttöehtoja. Luvuissa 2–10 tilaaja sitoutuu noudattamaan kuvattuja menettelyjä palvelussa tehtävissä kuljetuksissa suhteessa kuljetusliikkeeseen, jolleivät tilaaja ja kuljetusliike ole toisin sopineet. Etusijalla ovat pakottava laki ja yleissopimukset, sitten osapuolten viimeksi sopimat tilauksen muutokset, vahvistettu tilaus ja erityisehdot, tilaajan ja kuljetusliikkeen mahdollinen erillinen sopimus, nämä ehdot ja viimeisenä RAHTIS-käyttöehdot. Muutos syrjäyttää aiemman ehdon vain sovitulta osin.',
    'The shipper accepts these terms before it publishes or sends its first job. The accepted RAHTIS terms of use also apply. In sections 2 to 10 the shipper undertakes to follow the procedures described in transports made in the service in relation to the carrier, unless the shipper and the carrier have agreed otherwise. Precedence is given to mandatory law and conventions, then to the changes to the order last agreed by the parties, the confirmed order and special terms, any separate agreement between the shipper and the carrier, these terms and lastly the RAHTIS terms of use. A change overrides an earlier term only to the extent agreed.');

  perform pg_temp.put(v_doc, array[1, 4],
    'NSAB tai muut alan vakioehdot eivät tule sovellettaviksi automaattisesti: niiden soveltaminen edellyttää, että tilaaja ja kuljetusliike sopivat siitä nimenomaisesti ennen kuljetussopimuksen syntymistä ja sovellettava versio on annettu toiselle osapuolelle.',
    'NSAB or other industry standard terms do not apply automatically: their application requires that the shipper and the carrier expressly agree on it before the contract of carriage is formed and that the applicable version has been given to the other party.');

  perform pg_temp.put(v_doc, array[2, 3],
    'Toimeksiannon julkaiseminen, arviohinnan näkyminen ja automaattinen vastaanottoilmoitus eivät synnytä kuljetussopimusta. Kuljetussopimus syntyy tilaajan ja kuljetusliikkeen välille käyttöehtojen kohtien 6.3 ja 6.6 mukaisesti, kun kuljetusliike vahvistaa toimeksiannon palvelussa sille varatulla toimenpiteellä tai ottaa ryhmälle tarjotun toimeksiannon.',
    'Publishing a job, the display of an estimated price and an automatic acknowledgement do not form a contract of carriage. The contract of carriage is formed between the shipper and the carrier under clauses 6.3 and 6.6 of the terms of use when the carrier confirms the job in the service with the action provided for that purpose or takes a job offered to a group.');

  perform pg_temp.swap2(v_doc, array[2, 5],
    'Jos ajoneuvon kuljetusliike käyttää palvelua kuukausimaksulla, suora tilaus tehdään tilaajan ja kyseisen kuljetusliikkeen välillä: kuljetusliike näkyy tilaajalle nimeltä, laskuttaa tilaajaa itse ja vastaa kuljetuksesta, ja Aivomaa Oy välittää tiedot sekä raportin tehdystä työstä. Muissa tapauksissa Aivomaa Oy on tilaajan sopimuskumppani myös suorissa tilauksissa. Palvelumaksu määräytyy kohdan 3.4 mukaan.',
    'Suora tilaus tehdään tilaajan ja ajoneuvon kuljetusliikkeen välille: kuljetusliike näkyy tilaajalle nimeltä, laskuttaa tilaajaa itse ja vastaa kuljetuksesta, ja Aivomaa Oy välittää tiedot sekä raportin tehdystä työstä. Suorasta tilauksesta ei peritä palvelumaksua.',
    'If the vehicle''s carrier uses the service for a monthly fee, the direct order is made between the shipper and that carrier: the carrier is shown to the shipper by name, invoices the shipper itself and is liable for the transport, while Aivomaa Oy passes on the data and a report of the work done. In other cases Aivomaa Oy is the shipper''s contracting party also in direct orders. The service fee is determined under clause 3.4.',
    'The direct order is made between the shipper and the vehicle''s carrier: the carrier is shown to the shipper by name, invoices the shipper itself and is liable for the transport, while Aivomaa Oy passes on the data and a report of the work done. No service fee is charged for a direct order.');

  perform pg_temp.put_marked(v_doc, 2, 'Valuutta:',
    'Valuutta: kun tilaaja julkaisee tai lähettää toimeksiannon, se voi valita hinnan valuutaksi euron, Ruotsin, Norjan tai Tanskan kruunun tai Puolan złotyn. Valuutta näkyy kuljetusliikkeelle ennen kuin se ottaa kuljetuksen vastaan, ja kuljetusliike laskuttaa tilaajaa tässä valuutassa. Kohdan 9.7 mukaisten aiempien tilausten hinta, palvelumaksu ja laskutus ovat euroissa. Palvelun näyttämät muunnokset muihin valuuttoihin ovat suuntaa-antavia.',
    'Currency: when the shipper publishes or sends a job, it may choose the euro, the Swedish, Norwegian or Danish krone or the Polish złoty as the currency of the price. The currency is shown to the carrier before it accepts the transport, and the carrier invoices the shipper in that currency. The price, service fee and invoicing of earlier orders under clause 9.7 are in euros. Conversions into other currencies shown by the service are indicative.');

  perform pg_temp.put_marked(v_doc, 2, 'Huolitsijana toimiva tilaaja:',
    'Huolitsijana toimiva tilaaja: tilaaja ilmoittaa palvelussa, toimiiko se huolitsijana vai kuljettaako se omia tavaroitaan, ja vakuuttaa ilmoituksen oikeaksi. Huolitsijana toimiva tilaaja voi vapaaehtoisesti toimittaa palveluun huolitsijan vastuuvakuutuksensa tiedot käyttöehtojen mukaisesti; vakuutus ei ole palvelun käytön eikä toimeksiantojen julkaisemisen edellytys. Jos tilaaja on toimittanut vakuutuksen, sen on ilmoitettava Aivomaa Oy:lle vakuutuksen päättymisestä, irtisanomisesta, vastuumäärän alentamisesta tai muusta olennaisesta muutoksesta viiden (5) arkipäivän kuluessa muutoksesta, jotta kuljetusliikkeille ei näytetä virheellistä merkintää, sekä toimitettava pyynnöstä vakuutuksenantajan antama vakuutustodistus. Aivomaa Oy saa tarkistaa vakuutuksen tiedot vakuutuksenantajalta. Vakuutuksen puuttuminen tai riittämättömyys ei rajoita tilaajan vastuuta kuljetusliikkeelle.',
    'Shipper acting as a freight forwarder: the shipper states in the service whether it acts as a freight forwarder or transports its own goods, and warrants that the statement is correct. A shipper acting as a freight forwarder may voluntarily provide the service with the details of its freight forwarder''s liability insurance in accordance with the terms of use; the insurance is not a condition for using the service or for publishing jobs. Where the shipper has provided the insurance, it must notify Aivomaa Oy of the expiry or cancellation of the insurance, a reduction of its limit or any other material change within five (5) business days of the change, so that no incorrect note is shown to carriers, and provide on request an insurance certificate issued by the insurer. Aivomaa Oy may verify the details of the insurance with the insurer. The absence or insufficiency of the insurance does not limit the shipper''s liability towards the carrier.');

  perform pg_temp.put_marked(v_doc, 2, 'Maksutietojen näyttäminen:',
    'Maksutietojen näyttäminen: tilaaja hyväksyy, että toimeksiantojen yhteydessä palvelu näyttää kuljetusliikkeille käyttöehtojen mukaiset tiedot tilaajan iästä, rekisteritilasta, kuljetusliikkeiden maksuilmoitusten yhteenvedosta, toteutuneiden kuljetusten määrästä ja yritysasiakirjojen tarkastusmerkinnöistä sekä, jos tilaajalla on kohdan 9.7 mukaisia Aivomaa Oy:n laskuttamia kuljetuksia, maksukäyttäytymisestä niissä. Tilaaja näkee samat tiedot itsestään palvelussa. Tilaaja voi riitauttaa kuljetusliikkeen ilmoituksen palvelun asiakastuen kautta esittämällä selvityksen maksusta; Aivomaa Oy poistaa ilmoituksen, jos se osoittautuu virheelliseksi. Ilmoituksen tehneen kuljetusliikkeen tietoja ei luovuteta tilaajalle.',
    'Display of payment information: the shipper accepts that, in connection with its jobs, the service shows carriers the information provided for in the terms of use on the shipper''s age, register status, a summary of the payment reports made by carriers, the number of completed transports and the check marks of its company documents and, where the shipper has transports under clause 9.7 invoiced by Aivomaa Oy, its payment record for those transports. The shipper sees the same information about itself in the service. The shipper may dispute a report made by a carrier through the customer support of the service by providing an account of the payment; Aivomaa Oy removes the report if it proves to be incorrect. The details of the reporting carrier are not disclosed to the shipper.');

  /* Цена и ALV — между сторонами; сбора нет. */
  perform pg_temp.put(v_doc, array[3, 2],
    'Kuljetuksen hinta ilmoitetaan palvelussa ilman arvonlisäveroa. Kuljetusliike laskuttaa hinnan toimeksiannon valuutassa ja lisää laskuun arvonlisäveron sovellettavan lain mukaan; arvonlisäveron käsittelystä vastaa laskuttava kuljetusliike. Kansainvälinen reitti tai ulkomainen osoite ei sinänsä tarkoita nollaverokantaa.',
    'The price of a transport is shown in the service excluding value added tax. The carrier invoices the price in the currency of the job and adds value added tax to the invoice in accordance with applicable law; the invoicing carrier is responsible for the VAT treatment. An international route or a foreign address does not in itself mean a zero rate.');

  perform pg_temp.put(v_doc, array[3, 4],
    'Palvelun käyttö on tilaajalle maksutonta: Aivomaa Oy ei peri tilaajalta palvelumaksua, prosenttiosuutta eikä vähimmäismaksua tarjouspöydän toimeksiannoista, ryhmälle tarjotuista toimeksiannoista eikä suorista tilauksista. Tilaaja maksaa kuljetuksen hinnan ja sovitut lisät kuljetusliikkeelle. Kohdan 9.7 mukaisiin aiempiin tilauksiin sovelletaan niiden vahvistamishetkellä voimassa olleita palvelumaksuja.',
    'The use of the service is free of charge for the shipper: Aivomaa Oy charges the shipper no service fee, percentage or minimum fee on offer-table jobs, jobs offered to a group or direct orders. The shipper pays the price of the transport and the agreed extras to the carrier. The service fees in force when they were confirmed apply to earlier orders under clause 9.7.');

  perform pg_temp.swap2(v_doc, array[3, 5],
    'tilaaja näkee toteuman tilauksessa ja voi tehdä siitä huomautuksen reklamaationa.',
    'tilaaja näkee toteuman tilauksessa ja voi tehdä siitä huomautuksen kuljetusliikkeelle.',
    'the shipper sees the actual work in the order and may object to it as a claim.',
    'the shipper sees the actual work in the order and may object to it to the carrier.');

  /* Изменения в пути — с перевозчиком. */
  perform pg_temp.swap2(v_doc, array[4, 1],
    'palvelussa tai sovitun Aivomaa Oy:n yhteyden kautta',
    'palvelussa tai suoraan kuljetusliikkeelle',
    'through the service or the agreed Aivomaa Oy contact',
    'through the service or directly to the carrier');

  perform pg_temp.put(v_doc, array[4, 3],
    'Kuljetusliike vahvistaa muutoksen mahdollisuuden, uuden hinnan ja vaikutuksen aikatauluun; hinnan muutos vahvistetaan palvelussa käyttöehtojen kohdan 7.3 mukaisesti. Kuljettajan tai avustajan vastaus ei sinänsä vahvista hinnan muutosta.',
    'The carrier confirms whether the change is possible, the new price and the effect on the schedule; a change of price is confirmed in the service as set out in clause 7.3 of the terms of use. A reply from the driver or the assistant does not in itself confirm a change of price.');

  perform pg_temp.swap2(v_doc, array[4, 4],
    'ilmoittaa niistä viivytyksettä Aivomaa Oy:lle',
    'ilmoittaa niistä viivytyksettä tilaajalle',
    'notifies Aivomaa Oy without delay',
    'notifies the shipper without delay');

  /* Простой: 45 €/ч Aivomaa — только старые заказы; в прямых — по договорённости сторон. */
  perform pg_temp.put(v_doc, array[5, 1],
    'Lastaus- ja purkupaikoilla hintaan sisältyvästä ajasta ja odotusajan korvauksesta sopivat tilaaja ja kuljetusliike toimeksiannossa tai keskenään. Aivomaa Oy ei laskuta eikä peri odotusaikalisää.',
    'The time included in the price at loading and unloading places and any compensation for waiting time are agreed by the shipper and the carrier in the job or between themselves. Aivomaa Oy does not invoice or collect a waiting surcharge.');

  perform pg_temp.put(v_doc, array[5, 2],
    'Palvelu kirjaa kuljettajan sovellukseen merkitsemät saapumis- ja valmistumisajat (kohta 5.4), ja osapuolet näkevät ne tilauksessa. Kirjattuja aikoja voidaan käyttää odotusajan näyttönä.',
    'The service records the arrival and completion times entered by the driver in the app (clause 5.4), and the parties see them in the order. The recorded times may be used as evidence of waiting time.');

  perform pg_temp.put(v_doc, array[5, 3],
    'Jos osapuolet ovat sopineet odotusajan korvauksesta, kuljetusliike laskuttaa sen tilaajalta omalla laskullaan, ja laskusta on käytävä ilmi paikka, toimenpide, laskennan alku ja loppu sekä kesto.',
    'Where the parties have agreed on compensation for waiting time, the carrier invoices it to the shipper on its own invoice, which must state the place, the operation, the start and end of the calculation and the duration.');

  perform pg_temp.swap2(v_doc, array[5, 4],
    'Aika lasketaan siitä,',
    'Ellei toisin sovita, aika lasketaan siitä,',
    'Time is counted from',
    'Unless otherwise agreed, time is counted from');

  perform pg_temp.swap2(v_doc, array[5, 5],
    'Tilaaja voi pyytää laskelman ja esittää perustellut huomautukset.',
    'Tilaaja voi pyytää kuljetusliikkeeltä laskelman ja esittää perustellut huomautukset.',
    'The shipper may request the calculation and submit reasoned objections.',
    'The shipper may request the calculation from the carrier and submit reasoned objections.');

  perform pg_temp.put(v_doc, array[5, 6],
    'Kohdan 9.7 mukaisissa aiemmissa tilauksissa, joissa Aivomaa Oy on tilaajan sopimuskumppani, odotusaikalisä lasketaan ja laskutetaan tilauksen vahvistamishetkellä voimassa olleiden ehtojen mukaisesti: kunkin lastaus- ja purkupaikan maksuton tunti ja 45 euroa ilman arvonlisäveroa jokaiselta alkavalta ylitystunnilta, kun ylitys on vähintään 15 minuuttia. Tilaaja voi riitauttaa yksittäisen lisän reklamaatiolla; riidattoman osan maksua ei viivytetä.',
    'In earlier orders under clause 9.7 in which Aivomaa Oy is the shipper''s contracting party, the waiting surcharge is calculated and invoiced under the terms in force when the order was confirmed: one free hour at each loading and unloading place and 45 euros excluding VAT for each started hour of excess where the excess is at least 15 minutes. The shipper may dispute an individual surcharge by a claim; payment of the undisputed part is not delayed.');

  /* Прерывание и смена исполнителя. */
  perform pg_temp.put(v_doc, array[6, 2],
    'Jos kuljetusliike perääntyy ennen kuorman, perävaunun tai kontin vastaanottoa, toimeksianto voidaan palauttaa tarjouspöydälle, ja uusi kuljetussopimus syntyy sen kuljetusliikkeen kanssa, joka ottaa sen vastaan. Palvelu ilmoittaa tilaajalle perääntymisestä. Perääntyneen kuljetusliikkeen vastuu tilaajalle määräytyy niiden välisen sopimuksen ja lain mukaan; Aivomaa Oy ei vastaa perääntymisestä eikä korvaavan kuljetusliikkeen löytymisestä.',
    'If the carrier steps back before the load, trailer or container has been taken over, the job may be returned to the offer table, and a new contract of carriage is formed with the carrier that accepts it. The service notifies the shipper of the stepping back. The liability of the carrier that stepped back towards the shipper is determined by their contract and the law; Aivomaa Oy is not liable for the stepping back or for finding a replacement carrier.');

  perform pg_temp.swap2(v_doc, array[6, 3],
    'sovitaan Aivomaa Oy:n kautta',
    'sovitaan tilaajan ja kuljetusliikkeen kesken',
    'are agreed through Aivomaa Oy',
    'are agreed between the shipper and the carrier');

  perform pg_temp.swap2(v_doc, array[6, 4],
    'luovutus sovitaan Aivomaa Oy:n kautta',
    'luovutuksesta sovitaan tilaajan ja kuljetusliikkeen kesken',
    'the handover is agreed through Aivomaa Oy',
    'the handover is agreed between the shipper and the carrier');

  /* Паромы: стороны — заказчик и перевозчик. */
  perform pg_temp.swap2(v_doc, array[7, 2],
    'tilaajaan, suorittajaan tai Aivomaa Oy:hyn',
    'tilaajaan tai kuljetusliikkeeseen',
    'the shipper, the performer or Aivomaa Oy',
    'the shipper or the carrier');

  perform pg_temp.swap2(v_doc, array[7, 3],
    'Jos syy kuuluu Aivomaa Oy:n tai sen käyttämän suorittajan vastuupiiriin',
    'Jos syy kuuluu kuljetusliikkeen vastuupiiriin',
    'Where the cause falls within the sphere of Aivomaa Oy or the performer it engages',
    'Where the cause falls within the carrier''s sphere');

  perform pg_temp.put(v_doc, array[7, 4],
    'Aivomaa Oy ei peri lautalta myöhästymisestä maksua eikä lisää kuluihin katetta. Kulujen jaossa otetaan huomioon palautukset, hyvitykset, mahdollisuus rajoittaa vahinkoa ja kaksinkertaisen perinnän kielto.',
    'Aivomaa Oy charges no fee for a missed ferry and adds no margin to the costs. In allocating the costs, refunds, credits, the possibility of limiting the loss and the prohibition of double recovery are taken into account.');

  /* Документы. */
  perform pg_temp.put(v_doc, array[8, 2],
    'Jos allekirjoitus tai asiakirjan lataus on mahdotonta, kuljetusliike ilmoittaa syyn tilaajalle ja toimittaa käytettävissä olevan näytön suorituksesta. Tilauksen tekninen tila ei sinänsä poista tosiasiallisesti tehtyä työtä eikä oikeuta pidättämään riidatonta maksua rajattomasti. Asiakirjapoikkeama käsitellään tilaajan ja kuljetusliikkeen kesken pakottava laki huomioon ottaen.',
    'Where a signature or the upload of a document is impossible, the carrier informs the shipper of the reason and delivers the available evidence of performance. The technical status of the order does not in itself cancel work actually done or entitle the indefinite withholding of an undisputed payment. A documentary deviation is handled between the shipper and the carrier with due regard to mandatory law.');

  perform pg_temp.swap2(v_doc, array[8, 3],
    'Aivomaa Oy järjestää tilaukseen liittyvän asiakirjaliikenteen.',
    'Palvelu välittää tilaukseen liittyvät asiakirjat osapuolten välillä; Aivomaa Oy ei tarkasta niiden sisältöä.',
    'Aivomaa Oy arranges the documentation flow relating to the order.',
    'The service passes the documents relating to the order between the parties; Aivomaa Oy does not check their content.');

  /* Счета и оплата: перевозчику напрямую; старые заказы — 9.7. */
  perform pg_temp.put(v_doc, array[9, 1],
    'Kuljetusliike laskuttaa tilaajaa omissa nimissään valmistuneesta kuljetuksesta ja sovituista lisistä. Työmaakuljetuksista kuljetusliike voi muodostaa ja lähettää laskun palvelun kautta omissa nimissään. Aivomaa Oy ei ole laskun osapuoli.',
    'The carrier invoices the shipper in its own name for a completed transport and the agreed extras. For worksite transports the carrier may produce and send the invoice through the service in its own name. Aivomaa Oy is not a party to the invoice.');

  perform pg_temp.put(v_doc, array[9, 2],
    'Tilaaja maksaa laskun suoraan kuljetusliikkeen ilmoittamalle tilille osapuolten sopimien maksuehtojen mukaisesti. Viivästyksen seuraukset määräytyvät osapuolten sopimuksen ja korkolain mukaan.',
    'The shipper pays the invoice directly to the account notified by the carrier in accordance with the terms of payment agreed between the parties. The consequences of late payment are determined by the parties'' agreement and the Finnish Interest Act (korkolaki).');

  perform pg_temp.put(v_doc, array[9, 3],
    'Tilaaja tarkistaa maksunsaajan tilin palvelussa näkyvistä kuljetusliikkeen tiedoista. Tilinumeron muutosta koskeva sähköposti, WhatsApp-viesti tai muu vapaamuotoinen ilmoitus ei sinänsä riitä maksunsaajan tilin vaihtamiseen; epäselvässä tilanteessa tilaaja varmistaa muutoksen kuljetusliikkeeltä tunnetun yhteyshenkilön kautta.',
    'The shipper checks the payee''s account against the carrier''s details shown in the service. An email, a WhatsApp message or another informal notice of a change of account number is not in itself sufficient to change the payee''s account; in case of doubt the shipper verifies the change with the carrier through a known contact person.');

  perform pg_temp.put(v_doc, array[9, 4],
    'Aivomaa Oy ei ota vastaan tilaajan maksuja kuljetusliikkeelle eikä vastaa niiden välittämisestä. Tilaajan pankkitiedot palvelussa eivät ole lupa veloittaa tilaajan tililtä.',
    'Aivomaa Oy does not receive the shipper''s payments to the carrier and is not responsible for passing them on. The shipper''s bank details in the service are not an authorisation to debit the shipper''s account.');

  perform pg_temp.swap2(v_doc, array[9, 5],
    'Raportti palvelee täsmäytystä eikä korvaa tilityskauden laskua.',
    'Raportti palvelee täsmäytystä eikä ole lasku.',
    'The report serves reconciliation and does not replace the invoice for the settlement period.',
    'The report serves reconciliation and is not an invoice.');

  perform pg_temp.put(v_doc, array[9, 6],
    'Tilaaja ilmoittaa laskun virheestä kuljetusliikkeelle ilman aiheetonta viivytystä ja yksilöi riitautetut erät perusteineen. Riidaton summa maksetaan eräpäivään mennessä.',
    'The shipper notifies the carrier of an error in the invoice without undue delay and specifies the disputed items with reasons. The undisputed amount is paid by the due date.');

  perform pg_temp.put(v_doc, array[9, 7],
    'Siirtymäsäännös: tilaukset, jotka on ennen näiden ehtojen voimaantuloa julkaistu tai vahvistettu niin, että Aivomaa Oy on tilaajan sopimuskumppani, viedään loppuun niiden tekohetkellä voimassa olleiden ehtojen mukaisesti. Aivomaa Oy laskuttaa ne tilaajalta omissa nimissään puolen kuukauden tilityskausittain (kuukauden 1.–15. päivä ja 16. päivästä kuukauden loppuun) palvelumaksuineen ja odotusaikalisineen, ja tilaaja maksaa laskun Aivomaa Oy:n tilille 15 päivän kuluessa kauden päättymisestä. Niitä koskevat reklamaatiot ja vaatimukset osoitetaan Aivomaa Oy:lle kohdan 10.5 mukaisesti.',
    'Transitional provision: orders published or confirmed, before these terms entered into force, on the basis that Aivomaa Oy is the shipper''s contracting party are completed under the terms in force when they were made. Aivomaa Oy invoices them to the shipper in its own name by half-month settlement periods (the 1st to the 15th and the 16th to the end of the month) together with the service fees and waiting surcharges, and the shipper pays the invoice to Aivomaa Oy''s account within 15 days of the end of the period. Claims and demands concerning them are addressed to Aivomaa Oy as set out in clause 10.5.');

  /* Претензии — перевозчику. */
  perform pg_temp.swap2(v_doc, array[10, 1],
    'ilmoitetaan Aivomaa Oy:lle viivytyksettä',
    'ilmoitetaan kuljetusliikkeelle viivytyksettä',
    'is reported to Aivomaa Oy without delay',
    'is reported to the carrier without delay');

  perform pg_temp.put(v_doc, array[10, 2],
    'Vaatimus esitetään suoraan kuljetusliikkeelle. Vaatimuksessa ilmoitetaan tilauksen numero, olosuhteet, vaadittu summa ja käytettävissä oleva näyttö. Palvelun asiakirjat, valokuvat ja tapahtumaloki ovat tilaajan käytettävissä näyttönä käyttöehtojen kohdan 12.3 mukaisesti. Aivomaa Oy ei käsittele eikä ratkaise vaatimusta.',
    'A claim is made directly to the carrier. It states the order number, the circumstances, the amount claimed and the available evidence. The documents, photographs and event log in the service are available to the shipper as evidence as set out in clause 12.3 of the terms of use. Aivomaa Oy does not handle or decide the claim.');

  perform pg_temp.put(v_doc, array[10, 3],
    'Kuljetusliikkeen vastuu tavarasta, kuljetuksesta, viivästyksestä ja asiakirjoista määräytyy osapuolten sopimuksen, tiekuljetussopimuslain ja soveltuvin osin CMR-yleissopimuksen mukaan, ja tilaajan vastuu sen antamista tiedoista ja asiakirjoista sovellettavan lain mukaan. Aivomaa Oy ei vastaa kuljetuksesta eikä kuljetusliikkeen sitoumuksista. Nämä ehdot eivät laajenna vastuuta pakottavien sääntöjen yli eivätkä poista vastuuta, jota ei voi sopimuksella poistaa.',
    'The carrier''s liability for the goods, the transport, delay and documents is determined by the parties'' agreement, the Finnish Road Transport Contracts Act and, where applicable, the CMR Convention, and the shipper''s liability for the information and documents it provides by applicable law. Aivomaa Oy is not liable for the transport or for the carrier''s commitments. These terms do not extend liability beyond mandatory rules and do not exclude liability that cannot be excluded by agreement.');

  perform pg_temp.put(v_doc, array[10, 5],
    'Kohdan 9.7 mukaisissa aiemmissa tilauksissa tilaajan reklamaatio osoitetaan Aivomaa Oy:lle sopimuskumppanina myös silloin, kun poikkeama on syntynyt kuljetusliikkeen vastuupiirissä, ja se käsitellään käyttöehtojen kohdan 12.4 mukaisesti. Ulkopuolisen suorittajan käyttäminen ei näissä tilauksissa poista Aivomaa Oy:n lakiin perustuvaa vastuuta.',
    'In earlier orders under clause 9.7 the shipper''s claim is addressed to Aivomaa Oy as the contracting party even where the deviation arose within the carrier''s sphere, and it is handled as set out in clause 12.4 of the terms of use. In those orders engaging an external performer does not remove the liability Aivomaa Oy has under the law.');

  perform pg_temp.put(v_doc, array[11, 2],
    'Näihin ehtoihin sovelletaan Suomen lakia ottaen huomioon pakottavat säännökset ja sovellettavat kansainväliset yleissopimukset. Aivomaa Oy:n ja tilaajan väliset näitä ehtoja koskevat riidat pyritään ensin ratkaisemaan neuvotteluteitse, ja jos sopimukseen ei päästä, ne käsitellään Helsingin käräjäoikeudessa. Tilaajan ja kuljetusliikkeen väliset riidat ratkaistaan niiden sopimuksen ja sovellettavan lain mukaan, kuitenkin niin, että pakottavat oikeuspaikkasäännökset ja CMR:n mukaiset oikeuspaikkavaihtoehdot säilyvät, jos CMR on sovellettavissa; Aivomaa Oy ei ole näissä riidoissa osapuoli.',
    'Finnish law applies to these terms, taking into account mandatory provisions and applicable international conventions. Disputes between Aivomaa Oy and the shipper concerning these terms are first sought to be resolved by negotiation and, failing agreement, are heard by the District Court of Helsinki. Disputes between the shipper and the carrier are resolved under their contract and applicable law, provided that mandatory rules on jurisdiction and the forum options under the CMR are preserved where the CMR applies; Aivomaa Oy is not a party to such disputes.');
end;
$$;


-- ── CARRIER_AGREEMENT: одна модель — подписка ─────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('CARRIER_AGREEMENT');
begin
  perform pg_temp.put(v_doc, array[1, 2],
    'Sopimus on puitesopimus palvelun käytöstä eikä velvoita Aivomaa Oy:tä välittämään kuljetusliikkeelle tiettyä määrää toimeksiantoja, liikevaihtoa, ajosuoritetta tai jatkuvaa työtä. Kuljetussopimus syntyy kuljetusliikkeen ja tilaajan välille, kun kuljetusliike tai sen kuljettaja vahvistaa toimeksiannon RAHTIS-palvelussa tai ottaa ryhmälle tarjotun toimeksiannon.',
    'The agreement is a framework agreement on the use of the service and does not oblige Aivomaa Oy to pass on to the carrier any particular volume of assignments, turnover, mileage or continuous work. A contract of carriage is formed between the carrier and the shipper when the carrier or its driver confirms an assignment in the RAHTIS service or takes an assignment offered to a group.');

  perform pg_temp.retitle(v_doc, 2,
    'Palvelun käyttö ja kuljetussopimukset',
    'Use of the service and contracts of carriage');

  perform pg_temp.put(v_doc, array[2, 1],
    'Kuljetusliike käyttää RAHTIS-palvelua kuukausimaksulla (luku 3) kalustonsa, kuljettajiensa ja ajojensa hallintaan, omiin keikkoihinsa sekä toimeksiantojen vastaanottamiseen tarjouspöydältä, ryhmälle tarjotuista toimeksiannoista ja suorina tilauksina. Aiempi Alihankkija-malli, jossa kuljetusliike toimi Aivomaa Oy:n alihankkijana, on päättynyt. Sitä käyttänyt kuljetusliike siirtyy kuukausimaksuun kohdan 3.2 mukaisesti, ja sen ennen tämän sopimusversion voimaantuloa alihankintana vahvistamat toimeksiannot ajetaan loppuun ja tilitetään luvun 12 mukaisesti.',
    'The carrier uses the RAHTIS service for a monthly fee (section 3) to manage its vehicles, drivers and runs, for its own jobs and to receive assignments from the offer table, from assignments offered to a group and as direct orders. The former Subcontractor model, in which the carrier acted as a subcontractor of Aivomaa Oy, has ended. A carrier that used it moves to the monthly fee as set out in section 3.2, and the assignments it confirmed as subcontracting before this version of the agreement entered into force are completed and settled as set out in section 12.');

  perform pg_temp.put(v_doc, array[2, 2],
    'Aivomaa Oy ei ole palvelussa tehtävien kuljetussopimusten osapuoli eikä toimi rahdinkuljettajana, sopimusrahdinkuljettajana tai huolitsijana. Aivomaa Oy ei laskuta tilaajaa, ei ota vastaan rahtimaksuja eikä tilitä niitä kuljetusliikkeelle. Kuljetusliike vastaa kuljetuksesta tilaajalle tiekuljetussopimuslain ja soveltuvin osin CMR-yleissopimuksen mukaisesti. Kuljetusliike vastaa siitä, että sen palveluun antamat asiakas-, kuljetus- ja laskutustiedot ovat oikeita.',
    'Aivomaa Oy is not a party to the contracts of carriage made in the service and does not act as a carrier, a contracting carrier or a freight forwarder. Aivomaa Oy does not invoice the shipper, does not receive freight payments and does not settle them to the carrier. The carrier is liable for the transport to the shipper under the Finnish Road Transport Contracts Act (tiekuljetussopimuslaki) and, where applicable, the CMR Convention. The carrier is responsible for ensuring that the customer, transport and invoicing data it enters in the service are correct.');

  perform pg_temp.put(v_doc, array[2, 3],
    'Kuljetusliike on kuljetussopimuksen osapuoli kaikissa palvelussa tekemissään kuljetuksissa: omien asiakkaidensa kuljetuksissa, suorissa tilauksissa, ryhmälle tarjotuissa toimeksiannoissa ja tarjouspöydältä otetuissa toimeksiannoissa. Aivomaa Oy toimittaa palvelussa raportin tehdystä työstä.

RAHTIS voi tarjota kuljetusliikkeelle muun muassa asiakkaiden ja toimeksiantojen liittämisen järjestelmään, kuljettajasovelluksen, työvaiheiden seurannan, sähköisen dokumentoinnin, raportoinnin, rahtikirjojen ja muiden asiakirjojen käsittelyn, laskujen teknisen muodostamisen sekä laskujen lähettämisen kuljetusliikkeen nimissä sen asiakkaalle.

Aivomaa Oy ei vastaa tilaajan tai muun asiakkaan maksukyvystä, maksun perinnästä tai laskun suorittamisesta.',
    'The carrier is the party to the contract of carriage in all transports it performs in the service: transports for its own customers, direct orders, assignments offered to a group and assignments taken from the offer table. Aivomaa Oy provides a report of the work done in the service.

RAHTIS may offer the carrier, among other things, connecting customers and assignments to the system, the driver app, tracking of work steps, electronic documentation, reporting, handling of consignment notes and other documents, technical creation of invoices and sending invoices in the carrier''s name to its customer.

Aivomaa Oy is not responsible for the solvency of the shipper or another customer, for collecting payment or for settlement of the invoice.');

  perform pg_temp.put(v_doc, array[2, 4],
    'RAHTIS-keikkalistalta (tarjouspöydältä) otettu toimeksianto: kun tilaaja valitsee kuljetusliikkeen tarjouksen ja kuljetusliike vahvistaa sen, kuljetussopimus syntyy kuljetusliikkeen ja tilaajan välille. Kuljetusliike laskuttaa tilaajaa itse. Kun sopimus on syntynyt, kuljetusliike näkee tilaajan nimen ja laskuttamiseen tarvittavat tiedot ja tilaaja kuljetusliikkeen nimen, y-tunnuksen ja tilinumeron. Tarjouspöydän toimeksiannosta ei peritä prosenttiosuutta eikä muuta toimeksiantokohtaista maksua.',
    'An assignment taken from the RAHTIS job list (offer table): when the shipper selects the carrier''s offer and the carrier confirms it, a contract of carriage is formed between the carrier and the shipper. The carrier invoices the shipper itself. Once the contract has been formed, the carrier sees the shipper''s name and the details needed for invoicing, and the shipper sees the carrier''s name, business ID and account number. No percentage or other per-assignment fee is charged on an offer-table assignment.');

  perform pg_temp.swap2(v_doc, array[2, 6],
    'Omat keikat kuuluvat Itsenäinen kuljetusliike -malliin; Alihankkija-mallin kuljetusliike voi käyttää niitä kohdan 3.4 maksuttomana aikana.',
    'Omat keikat otetaan huomioon kuukausimaksussa kohdan 3.2 mukaisesti.',
    'Own jobs belong to the Independent carrier model; a carrier under the Subcontractor model may use them during the free period of section 3.4.',
    'Own jobs are taken into account in the monthly fee as set out in section 3.2.');

  perform pg_temp.put_marked(v_doc, 2, 'Valuutta:',
    'Valuutta: kuljetuksen hinta voidaan merkitä kuljetusliikkeen tai tilaajan valitsemassa valuutassa palvelun käyttöehtojen mukaisesti, ja kuljetus laskutetaan osapuolten välillä tässä valuutassa. Luvun 12 toimeksiantojen hinta, palvelumaksu ja tilitys ovat euroissa. Palvelun näyttämät muunnokset muihin valuuttoihin ovat suuntaa-antavia.',
    'Currency: the price of a transport may be recorded in the currency chosen by the carrier or the shipper in accordance with the terms of use of the service, and the transport is invoiced between the parties in that currency. The price, service fee and settlement of assignments under section 12 are in euros. Conversions into other currencies shown by the service are indicative.');

  perform pg_temp.put_marked(v_doc, 2, 'Tilaajan vakuutustieto:',
    'Tilaajan vakuutustieto: toimeksiannon yhteydessä palvelu näyttää kuljetusliikkeelle, onko tilaajan huolitsijan vastuuvakuutus tarkastettu ja mihin päivään asti se on voimassa, ettei vakuutusta ole vahvistettu tai että tilaaja kuljettaa omia tavaroitaan. Vakuutuksen toimittaminen on tilaajalle vapaaehtoista, eikä se ole toimeksiantojen julkaisemisen edellytys. Merkintä perustuu tilaajan toimittamiin asiakirjoihin ja Aivomaa Oy:n tarkastukseen. Se on tieto eikä takuu: Aivomaa Oy ei takaa vakuutuksen voimassaoloa, korvausta eikä rahdin maksamista, eikä merkintä muuta sitä, että kuljetussopimus ja maksu ovat kuljetusliikkeen ja tilaajan välisiä. Kuljetusliike päättää itse, ottaako se toimeksiannon vastaan.',
    'Shipper''s insurance information: in connection with an assignment the service shows the carrier whether the shipper''s freight forwarder''s liability insurance has been checked and until which date it is valid, that the insurance has not been confirmed, or that the shipper transports its own goods. Providing the insurance is voluntary for the shipper and is not a condition for publishing assignments. The note is based on documents provided by the shipper and on a check made by Aivomaa Oy. It is information, not a guarantee: Aivomaa Oy does not guarantee the validity of the insurance, any indemnity or the payment of the freight, and the note does not change the fact that the contract of carriage and the payment are between the carrier and the shipper. The carrier decides for itself whether to accept the assignment.');

  perform pg_temp.put_marked(v_doc, 2, 'Maksuilmoitukset:',
    'Maksuilmoitukset: kuljetusliike voi ilmoittaa tilaajan kanssa sovitun ja toteutuneen kuljetuksen maksusta (maksettu ajallaan, maksettu myöhässä tai maksamatta) 180 päivän kuluessa kuljetuksen päättymisestä. Kuljetusliike vastaa siitä, että ilmoitus on totuudenmukainen ja perustuu sen omaan kirjanpitoon, ja korjaa ilmoituksen, jos tilanne muuttuu. Ilmoitukset näytetään muille kuljetusliikkeille ja tilaajalle vain yhteenvetona ilman ilmoittajan tietoja. Aivomaa Oy voi poistaa virheelliseksi osoitetun ilmoituksen, ja perättömät tai harhaanjohtavat ilmoitukset voivat johtaa ilmoitusten poistamiseen ja palvelun käytön rajoittamiseen. Tilaajasta näytettävät maksutiedot, joihin voi sisältyä tilaajan maksukäyttäytyminen niissä aiemmissa kuljetuksissa, joista Aivomaa Oy on laskuttanut sitä, sekä rekisteritiedot ja tarkastettujen yritysasiakirjojen merkinnät, annetaan ainoastaan tiedoksi, eivätkä ne ole takuu rahdin maksamisesta.',
    'Payment reports: the carrier may report on the payment of a completed transport agreed with a shipper (paid on time, paid late or unpaid) within 180 days of the end of the transport. The carrier is responsible for ensuring that the report is truthful and based on its own accounts, and corrects the report if the situation changes. Reports are shown to other carriers and to the shipper only as a summary, without information on the reporting carrier. Aivomaa Oy may remove a report that is shown to be incorrect, and false or misleading reports may lead to the removal of reports and to restriction of the use of the service. The payment information shown about a shipper, which may include the shipper''s payment record for earlier transports invoiced to it by Aivomaa Oy as well as register data and the marks of checked company documents, is provided for information only and is not a guarantee of payment of the freight.');

  /* Глава 3: только подписка. */
  perform pg_temp.retitle(v_doc, 3, 'Kuukausimaksu', 'Monthly fee');

  perform pg_temp.put(v_doc, array[3, 1],
    'Kuljetusliike maksaa RAHTIS-palvelusta ainoastaan kohdan 3.2 mukaista kuukausimaksua. Aivomaa Oy ei peri kuljetusliikkeeltä prosenttiosuutta, provisiota, toimeksiantokohtaista palvelumaksua eikä vähimmäismaksua, eikä tilaajilta peritä palvelumaksua.',
    'The carrier pays for the RAHTIS service only the monthly fee under section 3.2. Aivomaa Oy charges the carrier no percentage, commission, per-assignment service fee or minimum fee, and no service fee is charged to shippers.');

  perform pg_temp.put(v_doc, array[3, 2],
    'Kuljetusliike maksaa RAHTIS-palvelusta kalenterikuukausittain ajoneuvoista, joilla on kyseisen kuukauden aikana merkitty valmiiksi vähintään yksi RAHTIS-palvelussa käsitelty toimeksianto, 14,90 euroa ilman arvonlisäveroa kustakin tällaisesta ajoneuvosta lukuun ottamatta ensimmäistä, josta ei makseta. 100. ajoneuvosta alkaen hinnasta voidaan sopia erikseen; ellei toisin sovita, sovelletaan samaa hintaa. Vuoden etukäteen maksettaessa hinnasta myönnetään 10 prosentin alennus käyttöehtojen kohdan 8.5 mukaisesti. Pelkästään palveluun rekisteröidystä ajoneuvosta ei makseta. Maksu on sama riippumatta siitä, onko toimeksianto kuljetusliikkeen oma keikka, suora tilaus, ryhmälle tarjottu vai tarjouspöydältä otettu. Kuljetusliikkeeltä, joka käytti Alihankkija-mallia tämän sopimusversion tullessa voimaan, kuukausimaksua peritään 1.1.2027 alkaen, kuitenkin aikaisintaan kohdan 3.4 maksuttoman ajan päätyttyä.',
    'The carrier pays for the RAHTIS service per calendar month, for the vehicles that have at least one assignment handled in the RAHTIS service marked as completed during that month, 14.90 euros excluding value added tax for each such vehicle except the first, for which no fee is charged. From the 100th vehicle the price may be agreed separately; unless otherwise agreed, the same price applies. When a year is paid in advance, a 10 per cent discount is given as set out in section 8.5 of the terms of use. No fee is paid for a vehicle merely registered in the service. The fee is the same whether the assignment is the carrier''s own job, a direct order, an assignment offered to a group or an assignment taken from the offer table. A carrier that used the Subcontractor model when this version of the agreement entered into force is charged the monthly fee from 1 January 2027, but not before the end of the free period under section 3.4.');

  perform pg_temp.put(v_doc, array[3, 3],
    'Kuljetusliikkeellä on pääsy tarjouspöydälle, kun sillä on vähintään yksi hyväksytty ajoneuvo ja voimassa olevat asiakirjat kohdan 4.2 mukaisesti. Tarjouspöydältä otetusta toimeksiannosta ei peritä erillistä maksua; ajoneuvo, jolla on kuukauden aikana valmiiksi merkitty toimeksianto, otetaan huomioon kuukausimaksussa kohdan 3.2 mukaisesti.',
    'The carrier has access to the offer table when it has at least one approved vehicle and valid documents as set out in section 4.2. No separate fee is charged on an assignment taken from the offer table; a vehicle with an assignment marked as completed during the month is taken into account in the monthly fee as set out in section 3.2.');

  perform pg_temp.put(v_doc, array[3, 5],
    'Aivomaa Oy laskuttaa kuukausimaksun kuukauden päätyttyä 14 päivän maksuajalla. Jos kuljetusliikkeelle maksetaan vielä luvun 12 mukaista tilitystä, erääntynyt kuukausimaksu voidaan vähentää siitä.',
    'Aivomaa Oy invoices the monthly fee after the end of the month with 14 days'' payment terms. Where a settlement under section 12 is still paid to the carrier, a monthly fee that has fallen due may be deducted from it.');

  perform pg_temp.put(v_doc, array[3, 6],
    'Kuukauden maksu lasketaan kyseisen kuukauden aikana valmiiksi merkityistä toimeksiannoista sinä kuukautena voimassa olleella hinnalla, eivätkä myöhemmät hinnanmuutokset vaikuta jo päättyneisiin kuukausiin.',
    'The fee for a month is calculated from the assignments marked as completed during that month at the price in force in that month, and later price changes do not affect months that have already ended.');

  perform pg_temp.put(v_doc, array[3, 8],
    'Aivomaa Oy ilmoittaa kuukausimaksun ja muiden kuljetusliikkeen maksujen muutoksista palvelussa ja sähköpostitse vähintään 30 päivää ennen niiden voimaantuloa. Jos kuljetusliike ei hyväksy korotusta, se voi päättää sopimuksen ennen muutoksen voimaantuloa ilman kuluja. Muutos ei koske ennen voimaantuloa päättyneitä kalenterikuukausia eikä jo maksettua vuosimaksua.',
    'Aivomaa Oy gives notice of changes to the monthly fee and the carrier''s other fees in the service and by email at least 30 days before they take effect. If the carrier does not accept an increase, it may terminate the agreement before the change takes effect without charge. The change does not apply to calendar months that ended before it took effect or to an annual fee already paid.');

  /* Тилааявастуулаки: обязанности — между сторонами договора перевозки. */
  perform pg_temp.put(v_doc, array[4, 3],
    'Tilaajavastuulain mukaiset selvitysvelvollisuudet ovat kuljetussopimuksen tilaajan ja kuljetusliikkeen välisiä; Aivomaa Oy ei ole palvelussa tehtävissä kuljetuksissa tilaajavastuulain tarkoittama tilaaja. Kun laki sitä edellyttää, kuljetusliike toimittaa tilaajalle tämän pyynnöstä enintään kolme kuukautta vanhat selvitykset:
- merkinnästä ennakkoperintärekisteriin, työnantajarekisteriin ja arvonlisäverorekisteriin;
- verojen maksamisesta (verovelkatodistus tai selvitys verovelan määrästä);
- eläkevakuutusten ottamisesta ja maksamisesta;
- työterveyshuollon järjestämisestä;
- sovellettavasta työehtosopimuksesta tai keskeisistä työehdoista.

Aivomaa Oy voi palvelun luotettavuuden ylläpitämiseksi tarkistaa kuljetusliikkeen tietoja julkisista rekistereistä (esimerkiksi PRH, YTJ, verovelkarekisteri) ja pyytää asiakirjoja, jotka ovat tarpeen yrityksen tunnistamiseen ja väärinkäytön estämiseen.',
    'The obligations to obtain information under the Act on the Contractor''s Obligations and Liability when Work is Contracted Out (tilaajavastuulaki) are between the shipper and the carrier as parties to the contract of carriage; Aivomaa Oy is not a contractor within the meaning of that Act in transports made in the service. Where the law requires, the carrier delivers to the shipper at its request statements not older than three months on:
- entry in the prepayment register, the employer register and the VAT register;
- payment of taxes (a tax debt certificate or a statement of the amount of tax debt);
- taking out and paying pension insurance;
- arranging occupational health care;
- the applicable collective agreement or the key terms of employment.

To maintain the reliability of the service, Aivomaa Oy may check the carrier''s data in public registers (for example PRH, YTJ, the tax debt register) and request documents needed to identify the company and prevent misuse.');

  perform pg_temp.put(v_doc, array[4, 4],
    'Kuljetusliike toimittaa Aivomaa Oy:lle pyydetyt luvat, vakuutustodistukset ja pätevyydet seitsemän päivän kuluessa pyynnöstä. Jos vaadittu asiakirja ei ole voimassa tai sitä ei toimiteta määräajassa, Aivomaa Oy voi keskeyttää kuljetusliikkeen pääsyn tarjouspöydälle ja uusien toimeksiantojen vastaanottamisen, kunnes asia on selvitetty.',
    'The carrier delivers to Aivomaa Oy the licences, insurance certificates and qualifications requested within seven days of the request. If a required document is not valid or is not delivered within that time, Aivomaa Oy may suspend the carrier''s access to the offer table and the receipt of new assignments until the matter has been resolved.');

  perform pg_temp.swap2(v_doc, array[6, 2],
    'Sitova kuljetussopimus syntyy, kun kuljetusliike',
    'Sitova kuljetussopimus kuljetusliikkeen ja tilaajan välille syntyy, kun kuljetusliike',
    'A binding contract of carriage is formed when the carrier',
    'A binding contract of carriage between the carrier and the shipper is formed when the carrier');

  /* Отмена: без сборов Aivomaa; последствия — с заказчиком. */
  perform pg_temp.put(v_doc, array[7, 1],
    'Kuljetusliike voi perua vahvistamansa toimeksiannon ennen kuorman, perävaunun tai kontin tosiasiallista vastaanottamista. Toimeksianto palautetaan tarjouspöydälle uuden kuljetusliikkeen löytämiseksi. Oma keikka (kohta 2.6) ei palaa tarjouspöydälle. Aivomaa Oy ei peri perumisesta maksua eikä sopimussakkoa. Perumisen seuraukset tilaajaan nähden määräytyvät kuljetusliikkeen ja tilaajan välisen sopimuksen ja sovellettavan lain mukaan. Tilaaja voi ottaa perumisen huomioon kuljetusliikkeen arvioinnissa.',
    'The carrier may cancel an assignment it has confirmed before the cargo, trailer or container has actually been taken over. The assignment is returned to the offer table to find a new carrier. An own job (section 2.6) does not return to the offer table. Aivomaa Oy charges no fee or contractual penalty for the cancellation. The consequences of the cancellation in relation to the shipper are determined by the contract between the carrier and the shipper and applicable law. The shipper may take the cancellation into account in rating the carrier.');

  perform pg_temp.swap2(v_doc, array[7, 3],
    'kuljetusliike ilmoittaa tilanteesta viipymättä Aivomaa Oy:lle',
    'kuljetusliike ilmoittaa tilanteesta viipymättä tilaajalle',
    'the carrier notifies Aivomaa Oy without delay',
    'the carrier notifies the shipper without delay');

  perform pg_temp.put(v_doc, array[8, 1],
    'Kuljettajan oikeus käyttää RAHTIS-sovellusta ei sinänsä anna hänelle valtuutta sopia tilaajan kanssa kuljetushinnan, reitin, lisätyön tai muiden kaupallisten ehtojen muutoksesta kuljetusliikettä sitovasti, ellei kuljetusliike ole antanut hänelle tällaista valtuutta.',
    'The driver''s right to use the RAHTIS app does not in itself authorise the driver to agree with the shipper on a change to the freight price, route, additional work or other commercial terms with binding effect on the carrier, unless the carrier has given the driver such authority.');

  perform pg_temp.put(v_doc, array[8, 2],
    'Jos tilaaja pyytää reitin muutosta, lisänoutoa tai lisäpurkua, ylimääräisiä kilometrejä, lisätyötä tai muuta alkuperäisestä toimeksiannosta poikkeavaa suoritusta, kuljetusliike ja tilaaja sopivat muutoksesta, sen hinnasta ja vaikutuksesta aikatauluun ennen muutoksen suorittamista, mikäli se olosuhteet huomioon ottaen on mahdollista. Palvelussa hinnan muutos vahvistetaan käyttöehtojen kohdan 7.3 mukaisesti.',
    'If the shipper requests a change of route, an additional pickup or delivery, extra kilometres, additional work or other performance deviating from the original assignment, the carrier and the shipper agree on the change, its price and its effect on the schedule before the change is carried out, where this is possible in the circumstances. In the service a change of price is confirmed as set out in section 7.3 of the terms of use.');

  perform pg_temp.swap2(v_doc, array[8, 3],
    'Tilanteesta ilmoitetaan Aivomaa Oy:lle viipymättä.',
    'Tilanteesta ilmoitetaan tilaajalle viipymättä.',
    'Aivomaa Oy is notified of the situation without delay.',
    'The shipper is notified of the situation without delay.');

  /* Простой: 9.2–9.5 остаются только для главы 12. */
  perform pg_temp.put(v_doc, array[9, 1],
    'Odotusajan korvauksesta sopivat kuljetusliike ja tilaaja. Aivomaa Oy ei maksa, laskuta eikä peri odotusaikalisää. Palvelu kirjaa kuljettajan merkitsemät saapumis- ja valmistumisajat, ja osapuolet voivat käyttää niitä odotusajan näyttönä. Kohdat 9.2–9.5 koskevat vain luvun 12 mukaisia toimeksiantoja, joissa Aivomaa Oy on tilaajan sopimuskumppani.',
    'Compensation for waiting time is agreed between the carrier and the shipper. Aivomaa Oy does not pay, invoice or collect a waiting surcharge. The service records the arrival and completion times entered by the driver, and the parties may use them as evidence of waiting time. Sections 9.2 to 9.5 apply only to assignments under section 12 in which Aivomaa Oy is the shipper''s contracting party.');

  perform pg_temp.swap2(v_doc, array[10, 2],
    'siitä ilmoitetaan viipymättä Aivomaa Oy:lle.',
    'siitä ilmoitetaan viipymättä tilaajalle.',
    'Aivomaa Oy is notified without delay.',
    'the shipper is notified without delay.');

  perform pg_temp.put(v_doc, array[11, 2],
    'Kuljetusliike toimittaa tilaajalle ne alkuperäiset paperiset asiakirjat, joiden fyysistä toimittamista tilaaja, viranomainen tai toimeksiannon luonne edellyttää. Luvun 12 toimeksiannoissa asiakirjat toimitetaan Aivomaa Oy:lle, joka voi käsitellä ja edelleen toimittaa ne asiakkaalle.',
    'The carrier delivers to the shipper the original paper documents whose physical delivery is required by the shipper, an authority or the nature of the assignment. In assignments under section 12 the documents are delivered to Aivomaa Oy, which may handle them and forward them to the customer.');

  perform pg_temp.swap2(v_doc, array[11, 3],
    'ilmoittaa syyn Aivomaa Oy:lle',
    'ilmoittaa syyn tilaajalle',
    'informs Aivomaa Oy of the reason',
    'informs the shipper of the reason');

  /* Глава 12 — переходная: прежние расчёты, зачёт и самовыставление только по старым заказам. */
  perform pg_temp.retitle(v_doc, 12,
    'Siirtymäsäännös: toimeksiannot, joissa Aivomaa Oy on sopimuskumppani',
    'Transitional provision: assignments in which Aivomaa Oy is the contracting party');

  perform pg_temp.put(v_doc, array[12, 1],
    'Tätä lukua sovelletaan vain toimeksiantoihin, jotka on julkaistu tai vahvistettu ennen tämän sopimusversion voimaantuloa ja joissa Aivomaa Oy on tilaajan sopimuskumppani (aiempi Alihankkija-malli ja keikkalista). Ne ajetaan loppuun ja tilitetään niiden tekohetkellä voimassa olleiden ehtojen mukaisesti, myös 3 prosentin palvelumaksun osalta. Tilityskaudet ovat kuukauden 1.–15. päivä sekä 16. päivästä kuukauden viimeiseen päivään. Toimeksianto kuuluu siihen kauteen, jonka aikana se on merkitty valmiiksi.',
    'This section applies only to assignments published or confirmed before this version of the agreement entered into force in which Aivomaa Oy is the shipper''s contracting party (the former Subcontractor model and job list). They are completed and settled under the terms in force when they were made, including the 3 per cent service fee. The settlement periods are the 1st to the 15th and the 16th to the last day of the month. An assignment belongs to the period in which it was marked as completed.');

  perform pg_temp.swap2(v_doc, array[12, 3],
    'Tilityksestä voidaan vähentää tämän sopimuksen mukainen 3 prosentin palvelumaksu ja kuukausimaksu',
    'Tilityksestä voidaan vähentää toimeksiannon vahvistamishetkellä voimassa olleen sopimuksen mukainen 3 prosentin palvelumaksu ja erääntynyt kuukausimaksu',
    'The 3 per cent service fee and the monthly fee under this agreement',
    'The 3 per cent service fee under the agreement in force when the assignment was confirmed, a monthly fee that has fallen due');

  perform pg_temp.swap2(v_doc, array[12, 5],
    'Kuljetusliike voi päättää itselaskutuksen ilmoittamalla siitä; tämän jälkeen se laskuttaa tilityksen mukaisesti itse.',
    'Kuljetusliike voi päättää itselaskutuksen ilmoittamalla siitä; tämän jälkeen se laskuttaa tilityksen mukaisesti itse. Itselaskutus koskee vain tämän luvun toimeksiantojen tilityksiä ja päättyy, kun ne on tilitetty.',
    'The carrier may end self-billing by giving notice; thereafter it invoices itself in accordance with the settlement.',
    'The carrier may end self-billing by giving notice; thereafter it invoices itself in accordance with the settlement. Self-billing applies only to the settlements of assignments under this section and ends when they have been settled.');

  perform pg_temp.retitle(v_doc, 13, 'Laskutus ja maksaminen', 'Invoicing and payment');

  perform pg_temp.put(v_doc, array[13, 1],
    'Kuljetusliike laskuttaa omia asiakkaitaan ja palvelussa olevia tilaajia omissa nimissään kaikista palvelussa tehdyistä kuljetuksista, ja asiakas tai tilaaja maksaa kuljetusmaksun suoraan kuljetusliikkeelle. RAHTIS voi teknisesti muodostaa tai lähettää laskun kuljetusliikkeen nimissä; tämä ei tee Aivomaa Oy:stä laskun velkojaa tai maksun vastaanottajaa. Aivomaa Oy ei vastaa tilaajan tai asiakkaan maksun viivästymisestä, maksukyvyttömyydestä tai perinnästä.',
    'The carrier invoices its own customers and the shippers in the service in its own name for all transports made in the service, and the customer or shipper pays the freight charge directly to the carrier. RAHTIS may technically create or send the invoice in the carrier''s name; this does not make Aivomaa Oy the creditor of the invoice or the recipient of the payment. Aivomaa Oy is not responsible for late payment, insolvency or collection on the part of the shipper or customer.');

  perform pg_temp.put(v_doc, array[13, 2],
    'Luvun 12 mukaiset aiemmat toimeksiannot tilitetään kyseisen luvun mukaisesti; muista toimeksiannoista Aivomaa Oy ei tee tilityksiä.',
    'Earlier assignments under section 12 are settled as set out in that section; Aivomaa Oy makes no settlements for other assignments.');

  perform pg_temp.put(v_doc, array[14, 1],
    'Kuljetusliike ei saa siirtää RAHTIS-palvelussa vastaanottamaansa toimeksiantoa edelleen toiselle kuljetusliikkeelle ilman tilaajan suostumusta. Jos kuljetusliike käyttää alihankkijaa, se vastaa tämän toiminnasta suhteessa tilaajaan kuten omastaan sovellettavan lain mukaisesti, ja alihankkijalla tulee olla toimeksiannon edellyttämät luvat, vakuutukset, kalusto ja pätevyydet. Luvun 12 toimeksiantojen siirtämiseen tarvitaan lisäksi Aivomaa Oy:n suostumus.',
    'The carrier may not pass an assignment received in the RAHTIS service on to another carrier without the shipper''s consent. If the carrier uses a subcontractor, it is liable for the subcontractor''s actions towards the shipper as for its own in accordance with applicable law, and the subcontractor must have the licences, insurance, equipment and qualifications required by the assignment. Passing on an assignment under section 12 also requires the consent of Aivomaa Oy.');

  /* Претензии и регресс. */
  perform pg_temp.swap2(v_doc, array[15, 1],
    'Kuljetusliike ilmoittaa Aivomaa Oy:lle viipymättä',
    'Kuljetusliike ilmoittaa tilaajalle viipymättä',
    'The carrier notifies Aivomaa Oy without delay',
    'The carrier notifies the shipper without delay');

  perform pg_temp.put(v_doc, array[15, 2],
    'Kuljetusliike ja tilaaja käsittelevät kuljetusta koskevat reklamaatiot ja vaatimukset keskenään; Aivomaa Oy ei ole reklamaation osapuoli eikä ratkaise sitä. Palvelu säilyttää toimeksiannon asiakirjat, kuvat ja tapahtumalokin molempien käytettäväksi käyttöehtojen mukaisesti. Kuljetusliikkeen vastuu kuljetuksesta, tavarasta, viivästyksestä ja vahingoista määräytyy sovellettavan lain ja soveltuvin osin CMR-yleissopimuksen perusteella. Huomautusajat ja vanhentuminen määräytyvät tiekuljetussopimuslain ja soveltuvin osin CMR-yleissopimuksen mukaan: näkyvästä vahingosta huomautetaan tavaraa luovutettaessa, ei-näkyvästä vahingosta seitsemän päivän kuluessa luovutuksesta sunnuntaita ja pyhäpäiviä lukuun ottamatta ja viivästyksestä 21 päivän kuluessa. Tämä sopimus ei laajenna kuljetusliikkeen vastuuta pakottavien vastuusäännösten yli.',
    'The carrier and the shipper handle claims and demands concerning the transport between themselves; Aivomaa Oy is not a party to a claim and does not decide it. The service keeps the documents, photographs and event log of the assignment available to both in accordance with the terms of use. The carrier''s liability for the transport, the goods, delay and damage is determined by applicable law and, where applicable, the CMR Convention. Notice periods and limitation are determined by the Finnish Road Transport Contracts Act and, where applicable, the CMR Convention: visible damage is notified on delivery of the goods, non-visible damage within seven days of delivery excluding Sundays and public holidays, and delay within 21 days. This agreement does not extend the carrier''s liability beyond mandatory liability provisions.');

  perform pg_temp.put(v_doc, array[15, 3],
    'Luvun 12 toimeksiannoissa, joissa Aivomaa Oy on asiakkaaseen nähden vastuussa vahingosta, joka kuuluu lain tai tämän sopimuksen perusteella kuljetusliikkeen vastuupiiriin, Aivomaa Oy voi esittää kuljetusliikkeelle vastaavan vaatimuksen siltä osin kuin kuljetusliike on lain mukaan vahingosta vastuussa. Osapuolet ilmoittavat toisilleen saamistaan reklamaatioista viipymättä. Aivomaa Oy:n vaatimus on esitettävä vuoden kuluessa siitä, kun se maksoi korvauksen asiakkaalle tai sen vastuu todettiin lainvoimaisesti, ellei pakottava laki edellytä muuta. Kuljetusliike saa vaatimuksen perusteena olevat asiakirjat ja voi esittää niistä huomautuksensa ennen kuin vaatimus vähennetään tilityksestä.',
    'In assignments under section 12, where Aivomaa Oy is liable to the customer for damage that falls within the carrier''s sphere of responsibility under the law or this agreement, Aivomaa Oy may present a corresponding claim to the carrier to the extent the carrier is liable for the damage under the law. The parties notify each other without delay of claims they receive. Aivomaa Oy''s claim must be presented within one year of its paying compensation to the customer or its liability being established by a final judgment, unless mandatory law requires otherwise. The carrier receives the documents on which the claim is based and may comment on them before the claim is deducted from a settlement.');

  perform pg_temp.put(v_doc, array[16, 1],
    'Ennen kuin kuljetussopimus syntyy, RAHTIS voi rajoittaa kuljetusliikkeelle näytettäviä tilaajan kaupallisia tai yhteystietoja siihen, mikä on tarjouksen tekemiseksi tarpeellista. Kun kuljetussopimus on syntynyt, kuljetusliike näkee tilaajan nimen ja laskuttamiseen tarvittavat tiedot. Luvun 12 toimeksiannoissa tilaajan tiedot näytetään niiden vahvistamishetkellä voimassa olleiden ehtojen mukaisesti.',
    'Before a contract of carriage is formed, RAHTIS may limit the shipper''s commercial or contact information shown to the carrier to what is needed to make an offer. Once the contract of carriage has been formed, the carrier sees the shipper''s name and the details needed for invoicing. In assignments under section 12 the shipper''s details are shown under the terms in force when they were confirmed.');

  perform pg_temp.swap2(v_doc, array[16, 3],
    'ei käytä itsenäisen kuljetusliikkeen',
    'ei käytä kuljetusliikkeen',
    'the data of an independent carrier''s',
    'the data of a carrier''s');

  /* Запрет обхода был защитой посредника-стороны; без комиссии — снят. */
  perform pg_temp.put(v_doc, array[16, 4],
    'Tämä sopimus ei sisällä kilpailukieltoa eikä rajoita kuljetusliikkeen oikeutta harjoittaa liiketoimintaa palvelun tilaajien, muiden asiakkaiden tai kuljetusliikkeiden kanssa palvelun ulkopuolella.',
    'This agreement contains no non-competition obligation and does not restrict the carrier''s right to do business with the shippers of the service, other customers or carriers outside the service.');

  perform pg_temp.swap2(v_doc, array[18, 1],
    'toimittaa ne Aivomaa Oy:lle heti, kun se on kohtuudella mahdollista',
    'toimittaa ne tilaajalle heti, kun se on kohtuudella mahdollista',
    'delivers it to Aivomaa Oy as soon as reasonably possible',
    'delivers it to the shipper as soon as reasonably possible');

  perform pg_temp.swap2(v_doc, array[19, 2],
    'Jo ansaitut kuljetuskorvaukset maksetaan normaalin tilitysaikataulun mukaisesti.',
    'Luvun 12 toimeksiannoista jo ansaitut kuljetuskorvaukset maksetaan sen tilitysaikataulun mukaisesti.',
    'Freight charges already earned are paid according to the normal settlement schedule.',
    'Freight charges already earned on assignments under section 12 are paid according to its settlement schedule.');

  perform pg_temp.swap2(v_doc, array[20, 1],
    'Palvelumaksujen muutoksiin sovelletaan kohtaa 3.8.',
    'Maksujen muutoksiin sovelletaan kohtaa 3.8.',
    'Section 3.8 applies to changes in service fees.',
    'Section 3.8 applies to changes in fees.');
end;
$$;


-- ── PRIVACY: только явные противоречия ─────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('PRIVACY');
begin
  /* Видимость: анонимность — до договора и в старых заказах Aivomaa. */
  perform pg_temp.swap2(v_doc, array[10, 2],
    'Kun Aivomaa Oy on tilaajan sopimuskumppani, tilaaja ei näe kuljetusliikkeen nimeä eikä sen henkilöstön yhteystietoja, eikä kuljetusliike näe tilaajan nimeä, yhteystietoja eikä laskutustietoja; kuljetusliikkeelle tilaaja näkyy koodilla. Kun osapuolet laskuttavat ja maksavat keskenään — kuukausimaksulla palvelua käyttävän kuljetusliikkeen suorat keikat — he näkevät toisensa nimeltä, koska muuten laskua ei voi osoittaa eikä maksaa; tilaajalle näytetään tällöin myös kuljetusliikkeen tilinumero ja BIC-koodi.',
    'Ennen kuin kuljetussopimus syntyy, tarjouspöydällä tilaaja näkyy kuljetusliikkeelle koodilla ja kuljetusliikkeen tarjous tilaajalle ilman kuljetusliikkeen nimeä. Kun kuljetussopimus on syntynyt, osapuolet näkevät toisensa nimeltä, koska ne laskuttavat ja maksavat keskenään eikä laskua muuten voi osoittaa eikä maksaa; kuljetusliike näkee tällöin tilaajan laskuttamiseen tarvittavat tiedot ja tilaaja kuljetusliikkeen tilinumeron ja BIC-koodin. Niissä aiemmissa keikoissa, joissa Aivomaa Oy on tilaajan sopimuskumppani, tilaaja ei näe kuljetusliikkeen nimeä eikä sen henkilöstön yhteystietoja, eikä kuljetusliike näe tilaajan nimeä, yhteystietoja eikä laskutustietoja.',
    'When Aivomaa Oy is the shipper''s contracting party, the shipper does not see the carrier''s name or its personnel contact details, and the carrier does not see the shipper''s name, contact details or billing details; the shipper is shown to the carrier by a code. When the parties invoice and pay each other — the direct jobs of a carrier that uses the service for a monthly fee — they see each other by name, because otherwise an invoice can neither be addressed nor paid; the shipper is then also shown the carrier''s account number and BIC code.',
    'Before a contract of carriage is formed, on the offer table the shipper is shown to the carrier by a code and the carrier''s offer is shown to the shipper without the carrier''s name. Once the contract of carriage has been formed, the parties see each other by name, because they invoice and pay each other and an invoice could not otherwise be addressed or paid; the carrier then sees the details of the shipper needed for invoicing and the shipper sees the carrier''s account number and BIC code. In earlier jobs in which Aivomaa Oy is the shipper''s contracting party, the shipper does not see the carrier''s name or its personnel contact details, and the carrier does not see the shipper''s name, contact details or billing details.');

  /* Платёжные сведения: «прямые договоры» теперь все; история Aivomaa — где есть. */
  perform pg_temp.put_marked(v_doc, 2, 'Tilaajan maksutiedot:',
    'Tilaajan maksutiedot: toimeksiantojen yhteydessä näytämme kuljetusliikkeille yhteenvedon tilaajan iästä, julkisten rekisterien mukaisesta tilasta, kuljetusliikkeiden maksuilmoituksista ja toteutuneiden kuljetusten määrästä sekä, jos tilaajalla on aiempia kuljetuksia, joissa Aivomaa Oy oli sen sopimuskumppani ja laskutti sitä, maksukäyttäytymisestä niissä. Päivitämme rekisteritiedot säännöllisesti julkisista yritysrekistereistä, kuten Patentti- ja rekisterihallituksen avoimesta datasta ja EU:n VIES-palvelusta. Tiedot koskevat yritystä. Jos tilaaja on yksityinen elinkeinonharjoittaja (toiminimi), tiedot ovat häntä koskevia henkilötietoja; käsittelyn peruste on oikeutettu etu antaa kuljetusliikkeille tietoa sopimuskumppanin maksukäyttäytymisestä, koska kuljetussopimus ja rahdin maksu ovat tilaajan ja kuljetusliikkeen välisiä eikä Aivomaa Oy takaa maksua. Kuljetusliikkeiden ilmoitukset tallennetaan ilmoittajan tiedoin, mutta tilaaja ja muut kuljetusliikkeet näkevät vain yhteenvedon. Yhteenvedossa käytetään enintään 12 viimeisen kuukauden tietoja. Ilmoitukset säilytetään asiakkuuden ajan ja sen jälkeen niin kauan kuin niitä tarvitaan mahdollisen riidan selvittämiseen. Tilaaja voi vastustaa käsittelyä ja pyytää virheellisen ilmoituksen korjaamista tai poistamista asiakastuen kautta.',
    'Customer''s payment information: in connection with jobs we show carriers a summary of the customer''s age, its status in public registers, the payment reports made by carriers and the number of completed transports and, where the customer has earlier transports in which Aivomaa Oy was its contracting party and invoiced it, its payment record for those transports. We update the register information regularly from public company registers, such as the open data of the Finnish Patent and Registration Office and the EU VIES service. The information concerns the company. If the customer is a sole trader (toiminimi), the information is personal data relating to that person; the legal basis for the processing is the legitimate interest of informing carriers of the payment behaviour of their contracting party, since the contract of carriage and the payment of the freight are between the customer and the carrier and Aivomaa Oy does not guarantee the payment. Reports by carriers are stored together with the details of the reporting carrier, but the customer and other carriers only see a summary. The summary uses information from at most the last 12 months. Reports are kept for the duration of the customer relationship and thereafter for as long as they are needed to settle any dispute. The customer may object to the processing and request the correction or removal of an incorrect report through customer support.');
end;
$$;
