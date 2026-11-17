-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: модель расчётов — счета по согласию сторон (17.11.2026)
--
-- Под 20261117140000_weekly_freight_invoices. Правда модели:
--   · Aivomaa Oy в перевозках не участвует: только оператор платформы.
--     Не перевозчик, не экспедитор, не посредник по фрахту, не сторона
--     договора перевозки, денег за перевозку не собирает, оплату не
--     гарантирует. Договор — всегда напрямую заказчик ↔ перевозчик
--     (и перевозчик ↔ его субподрядчик).
--   · Счета между участниками — с периодичностью и сроком оплаты, которые
--     стороны согласуют в сервисе (20261117160000_invoice_terms_agreed):
--     сразу после рейса, раз в неделю, раз в две недели или раз в месяц;
--     пока не согласовали — раз в неделю и 14 дней. В срок RAHTIS от
--     имени и по поручению перевозчика (его имя, Y-tunnus, IBAN, его
--     серия номеров) составляет счёт за завершённые невыставленные рейсы
--     и шлёт заказчику с PDF; деньги — напрямую перевозчику. Объекты
--     (työmaa) — раз в неделю по принятым дням. Поручение даётся
--     принятием договора перевозчика; выключается в настройках кабинета
--     (для объекта — в настройках объекта), тогда перевозчик выставляет
--     сам с согласованной периодичностью. Рейс в счёт — один раз. НДС:
--     внутри страны — обычная ставка страны продавца; между странами ЕС
--     — 0 %, reverse charge по VAT-номеру покупателя; вне ЕС — 0 % с
--     пометкой. Перевозчик ↔ субподрядчик — счета друг другу напрямую с
--     согласованной между ними периодичностью, Aivomaa не сторона.
--   · Свою подписку Aivomaa выставляет помесячно после конца месяца,
--     срок 14 дней; годовая предоплата −10 % остаётся. Заказчику бесплатно.
--   · Отчёт за неделю — по понедельникам 04:00 UTC каждой стороне,
--     включая клиентов, которых перевозчик добавил сам (за недели с
--     рейсами); компаниям-пользователям — и за недели без рейсов, с днями
--     на объектах. Отчёт — не счёт.
--
-- Старый переходный режим (Aivomaa — сторона заказчика, счета за
-- полмесяца, расчёты с перевозчиком, самофактурирование, претензии через
-- Aivomaa, зачёт, факторинг, доплата за ожидание от Aivomaa) убран
-- целиком: на боевой базе таких открытых заказов нет (все 119 — на
-- тестовых компаниях и закрыты).
--
--   TERMS 1.3, 6.7, 8.4, 8.5, 8.6, 8.8, 8.9, 8.11, 8.15, 11.3, 12.4;
--   SHIPPER_AGREEMENT 1.2, 2.6, 2.8, 3.4, 5.3, 9.1, 9.5; 5.6, 9.7, 10.5
--     удалены (последние пункты своих глав);
--   CARRIER_AGREEMENT 1.2, 2.1, 2.2, 2.3, 2.7, 2.9, 3.5, 9.1, 11.2,
--     глава 12 (заголовок и 12.1; 12.2–12.6 удалены), 13.1, 13.2, 14.1,
--     16.1, 19.2; 9.2–9.5 и 15.3 удалены (последние пункты глав);
--   PRIVACY 2.1, 2.23, 4.5, 5.5, 8.1, 8.4, 10.2 и новый 2.30 (недельные
--     счета от имени перевозчика — обработка по его поручению).
--
-- Нумерацию не трогаем: пункт в середине главы не удаляем, а заменяем
-- коротким верным текстом. Целые пункты — put по пути; одна фраза —
-- swap (нет ни старой, ни новой — ошибка); вырезать фразу — cut. В конце
-- проверка: в черновиках не осталось ссылок на старый режим. Всё
-- повторяемо. Заглушки «[Kohta täydennetään juristin kanssa…]» в TERMS
-- 3.5 и 4.4 не трогаем. Черновики, активация — решение пользователя.
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

/*
 * Замена фразы в пункте. Новая фраза уже стоит — ничего; нет ни старой,
 * ни новой — ошибка: текст пункта меняли, и править вслепую нельзя.
 */
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

/*
 * Вырезать фразу. Уже вырезана — ничего (повтор); пропавший пункт —
 * ошибка. Что фраза действительно ушла, проверяет итоговый блок.
 */
create or replace function pg_temp.cut(p_doc uuid, p_path integer[], p_fi text, p_en text)
returns void
language plpgsql
as $$
declare
  v_locale text;
  v_phrase text;
begin
  foreach v_locale in array array['fi', 'en'] loop
    v_phrase := case v_locale when 'fi' then p_fi else p_en end;
    if not exists (
      select 1 from public.legal_clauses
      where document_id = p_doc and path = p_path and locale = v_locale
    ) then
      raise exception 'Пункт % (%) не найден', array_to_string(p_path, '.'), v_locale;
    end if;
    update public.legal_clauses
    set body = replace(body, v_phrase, '')
    where document_id = p_doc and path = p_path and locale = v_locale and position(v_phrase in body) > 0;
  end loop;
end;
$$;

/* Убрать пункт (только последние пункты главы — нумерация не сдвигается). */
create or replace function pg_temp.drop_clause(p_doc uuid, p_path integer[])
returns void
language sql
as $$
  delete from public.legal_clauses where document_id = p_doc and path = p_path;
$$;

/* Заголовок главы. */
create or replace function pg_temp.retitle(p_doc uuid, p_section integer, p_fi text, p_en text)
returns void
language plpgsql
as $$
begin
  update public.legal_clauses set title = p_fi
  where document_id = p_doc and locale = 'fi' and path = array[p_section];
  if not found then
    raise exception 'Глава % (fi) не найдена', p_section;
  end if;
  update public.legal_clauses set title = p_en
  where document_id = p_doc and locale = 'en' and path = array[p_section];
  if not found then
    raise exception 'Глава % (en) не найдена', p_section;
  end if;
end;
$$;


-- ── TERMS ──────────────────────────────────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('TERMS');
begin
  -- 1.3 Aivomaa — только оператор: не посредник, оплату не гарантирует.
  perform pg_temp.put(v_doc, '{1,3}',
    $t$RAHTIS on ohjelmistopalvelu ja markkinapaikka. Sen kautta tilaajat ja kuljetusliikkeet löytävät toisensa tarjouspöydällä, suorilla tilauksilla ja ryhmälle tarjotuilla toimeksiannoilla, ja kuljetusliikkeet hallitsevat omia keikkojaan, kalustoaan ja kuljettajiaan sekä käyttävät kuljettajasovellusta. Jokainen palvelussa tehtävä kuljetussopimus syntyy suoraan tilaajan ja kuljetusliikkeen välille. Aivomaa Oy on ainoastaan palvelun ylläpitäjä: se ei osallistu kuljetuksiin, ei ole kuljetussopimuksen osapuoli eikä toimi rahdinkuljettajana, sopimusrahdinkuljettajana, huolitsijana, rahdinvälittäjänä tai muuna kuljetusten välittäjänä. Aivomaa Oy ei laskuta rahtia omissa nimissään, ei ota vastaan tilaajan ja kuljetusliikkeen välisiä maksuja eikä tilitä niitä kuljetusliikkeelle, eikä se takaa osapuolten välisten maksujen suorittamista.$t$,
    $t$RAHTIS is a software service and a marketplace. Through it shippers and carriers find each other on the offer table, through direct orders and through jobs offered to a group, and carriers manage their own jobs, vehicles and drivers and use the driver app. Every contract of carriage made in the service is formed directly between the shipper and the carrier. Aivomaa Oy is only the operator of the service: it does not take part in transports, is not a party to the contract of carriage and does not act as a carrier, a contracting carrier, a freight forwarder, a freight broker or any other intermediary of transport. Aivomaa Oy does not invoice freight in its own name, does not receive payments between the shipper and the carrier and does not settle them to the carrier, nor does it guarantee payments between the parties.$t$);

  -- 6.7 без скрытия сторон «по переходному правилу».
  perform pg_temp.cut(v_doc, '{6,7}',
    $t$Keikoissa, joissa Aivomaa Oy on kohdan 8.4 siirtymäsäännöksen mukaisesti tilaajan sopimuskumppani, osapuolten nimet ja muut tiedot eivät näy toisilleen. $t$,
    $t$In jobs in which Aivomaa Oy is the shipper's contracting party under the transitional provision of clause 8.4, the names and other details of the parties are not shown to each other. $t$);

  -- 8.4 недельный счёт от имени перевозчика; переходное правило убрано.
  perform pg_temp.put(v_doc, '{8,4}',
    $t$Kuljetusliike laskuttaa tilaajaa kuljetuksesta omissa nimissään, ja tilaaja maksaa laskun suoraan kuljetusliikkeelle. Laskutusvälin ja maksuajan sopivat kuljetusliike ja tilaaja keskenään palvelussa: lasku laaditaan kunkin kuljetuksen jälkeen, kerran viikossa (maanantaisin), joka toinen viikko (maanantaisin) tai kerran kuukaudessa (kuun 1. päivänä), ja kunnes toisin sovitaan, kerran viikossa 14 päivän maksuajalla. Sovittuna laskutuspäivänä palvelu muodostaa kuljetusliikkeen nimissä ja sen puolesta (kuljetusliikkeen nimi, Y-tunnus, tilinumero ja sen oma laskunumerointi) kullekin tilaajalle laskun palvelussa tehdyistä, edelliseen päivään mennessä (Suomen aikaa) valmistuneista ja vielä laskuttamattomista kuljetuksista sekä sovituista lisistä, kuten odotusajasta, ja lähettää sen tilaajalle sähköpostitse PDF-liitteenä. Kuljetusliike antaa tähän valtuutuksen hyväksymällä kuljetusliikkeen sopimuksen. Kuljetusliike voi kytkeä laskujen lähettämisen pois tilinsä asetuksista, jos se laskuttaa omasta laskutusjärjestelmästään; tällöin se laskuttaa tilaajaa itse sovitulla laskutusvälillä. Kuljetus laskutetaan vain kerran: jos kuljetusliike on merkinnyt kuljetuksesta palveluun oman laskunsa, palvelu ei laskuta sitä. Arvonlisävero: kotimaisessa kaupassa sovelletaan myyjän maan yleistä verokantaa, EU-maiden välisessä kaupassa laskutetaan 0 prosentin verokannalla käännetyn verovelvollisuuden perusteella ostajan arvonlisäverotunnisteella ja, kun myyjä tai ostaja on EU:n ulkopuolelta, 0 prosentin verokannalla laskuun tehtävin merkinnöin. Laskun maksuaika on osapuolten sopima, ja ellei muuta ole sovittu, 14 päivää. Aivomaa Oy ei ole laskun osapuoli, ei peri saatavaa eikä ota vastaan maksua.$t$,
    $t$The carrier invoices the shipper for the transport in its own name, and the shipper pays the invoice directly to the carrier. The carrier and the shipper agree between themselves in the service on the invoicing interval and the payment term: an invoice is issued after each transport, once a week (on Mondays), every other week (on Mondays) or once a month (on the 1st), and until otherwise agreed, once a week with a 14-day payment term. On the agreed invoicing day the service draws up, in the carrier's name and on its behalf (the carrier's name, business ID, bank account and its own invoice numbering), an invoice to each shipper for the transports made in the service, completed by the previous day (Finnish time) and not yet invoiced, together with the agreed extras such as waiting time, and sends it to the shipper by email with a PDF attachment. The carrier gives its authorisation for this by accepting the carrier agreement. The carrier may switch the sending of invoices off in its account settings if it invoices from its own invoicing system; it then invoices the shipper itself at the agreed invoicing interval. A transport is invoiced only once: if the carrier has recorded its own invoice for a transport in the service, the service does not invoice it. Value added tax: in domestic sales the standard rate of the seller's country applies; in sales between EU countries the invoice is issued at a 0 per cent rate under the reverse charge with the buyer's VAT number; and where the seller or the buyer is outside the EU, at a 0 per cent rate with a note on the invoice. The payment term of the invoice is as agreed by the parties and, unless otherwise agreed, 14 days. Aivomaa Oy is not a party to the invoice, does not collect the receivable and does not receive the payment.$t$);

  -- 8.5 своя подписка Aivomaa: после конца месяца, 14 дней.
  perform pg_temp.swap2(v_doc, '{8,5}',
    $t$Kuukausimaksu laskutetaan kuukauden päätyttyä tavanomaisin maksuehdoin.$t$,
    $t$Aivomaa Oy laskuttaa kuukausimaksun omissa nimissään kuukauden päätyttyä 14 päivän maksuajalla.$t$,
    $t$The monthly fee is invoiced after the end of the month on the usual payment terms.$t$,
    $t$Aivomaa Oy invoices the monthly fee in its own name after the end of the month with 14 days' payment terms.$t$);

  -- 8.6 отчёт по понедельникам каждой стороне; без исключения о самофактурировании.
  perform pg_temp.put(v_doc, '{8,6}',
    $t$Viikkoraportti: edellisen viikon (maanantaista sunnuntaihin) raportti muodostetaan ja lähetetään maanantaisin kello 4.00 UTC, mikä on Suomen aikaa 6.00 talvella ja 7.00 kesällä, jokaiselle osapuolelle sen omista töistä: kuljetusliikkeille ja tilaajille, myös asiakkaille, jotka kuljetusliike on itse lisännyt palveluun. Palvelua käyttävälle yritykselle raportti lähetetään myös, jos viikolla ei ollut kuljetuksia, ja siinä kerrotaan tällöin, ettei kuljetuksia ollut; kuljetusliikkeen itse lisäämälle asiakkaalle raportti lähetetään viikoilta, joilla sillä oli kuljetuksia. Raporttiin sisältyvät myös työmaapäivät. Viikkoraportti ei ole lasku; laskut laaditaan kohtien 8.4 ja 8.8 mukaisesti.$t$,
    $t$Weekly report: a report on the previous week, Monday to Sunday, is produced and sent on Mondays at 04:00 UTC, which is 06:00 Finnish time in winter and 07:00 in summer, to every party on its own work: to carriers and to shippers, including customers that a carrier has itself added to the service. To a company using the service the report is sent even if there were no transports during the week, in which case it states that there were no transports; to a customer that a carrier has itself added, the report is sent for weeks in which it had transports. The report also includes worksite days. The weekly report is not an invoice; invoices are issued as set out in clauses 8.4 and 8.8.$t$);

  -- 8.8 объекты — раз в неделю (две недели убраны), отказ — по объекту.
  perform pg_temp.put(v_doc, '{8,8}',
    $t$Työmaakuljetusten laskut: kuljetusliike voi lisätä palveluun asiakkaansa työmaan. Työmaan hyväksytyt työpäivät laskutetaan viikoittain kohdan 8.4 tavoin: palvelu muodostaa maanantaisin kuljetusliikkeen nimissä ja sen puolesta laskun hyväksytyistä, vielä laskuttamattomista työpäivistä kuljetusliikkeen tiedoilla (Y-tunnus, tilinumero, laskunumerointi, arvonlisävero) ja lähettää sen asiakkaalle sähköpostitse. Kuljetusliike voi työmaakohtaisesti valita, että se lähettää laskun itse palvelussa napin painalluksella tai laskuttaa omasta laskutusjärjestelmästään; tällöin se laskuttaa asiakasta itse, kuitenkin vähintään kerran viikossa. Laskulle tulevat vain hyväksytyt työpäivät, kukin kerran. Maksu suoritetaan suoraan kuljetusliikkeelle; Aivomaa Oy ei ole laskun osapuoli eikä peri saatavaa. Kuljetusliike vastaa laskun tietojen oikeellisuudesta ja asiakkaan laskutustiedoista.$t$,
    $t$Worksite haulage invoices: a carrier may add its customer's worksite to the service. The approved working days at a worksite are invoiced weekly in the same way as under clause 8.4: on Mondays the service draws up, in the carrier's name and on its behalf, an invoice for the approved working days not yet invoiced, with the carrier's details (business ID, bank account, invoice numbering, VAT), and sends it to the customer by email. For an individual worksite the carrier may choose to send the invoice itself in the service at the press of a button or to invoice from its own invoicing system; it then invoices the customer itself, at least once a week. Only approved working days are invoiced, each once. Payment is made directly to the carrier; Aivomaa Oy is not a party to the invoice and does not collect the receivable. The carrier is responsible for the correctness of the invoice details and of the customer's billing details.$t$);

  -- 8.9 без евро «по переходному правилу».
  perform pg_temp.cut(v_doc, '{8,9}',
    $t$Kohdan 8.4 siirtymäsäännöksen tilausten hinnat, palvelumaksut, laskut ja tilitykset ovat euroissa. $t$,
    $t$The prices, service fees, invoices and settlements of orders under the transitional provision of clause 8.4 are in euros. $t$);

  -- 8.11 без платёжной истории по заказам, выставленным Aivomaa.
  perform pg_temp.cut(v_doc, '{8,11}',
    $t$Jos tilaajalla on kohdan 8.4 siirtymäsäännöksen mukaisia kuljetuksia, joista Aivomaa Oy on laskuttanut sitä, palvelu voi näyttää myös tilaajan maksukäyttäytymisen niissä. $t$,
    $t$Where the shipper has transports under the transitional provision of clause 8.4 that Aivomaa Oy has invoiced to it, the service may also show the shipper's payment record for those transports. $t$);

  -- 8.15 задержка 48 ч после смены IBAN — и для недельных счетов (как в коде).
  perform pg_temp.swap2(v_doc, '{8,15}',
    $t$Työmaalaskuja ei lähetetä automaattisesti 48 tuntiin tilinumeron muuttumisen jälkeen.$t$,
    $t$Kuljetusliikkeen nimissä lähetettäviä kuljetus- ja työmaalaskuja ei lähetetä automaattisesti 48 tuntiin tilinumeron muuttumisen jälkeen.$t$,
    $t$Worksite invoices are not sent automatically within 48 hours of a change of the account number.$t$,
    $t$Transport and worksite invoices sent in the carrier's name are not sent automatically within 48 hours of a change of the account number.$t$);

  -- 11.3 «tilitysasiakirjat» → «laskutusasiakirjat».
  perform pg_temp.swap2(v_doc, '{11,3}',
    $t$sopimus- ja tilitysasiakirjat$t$,
    $t$sopimus- ja laskutusasiakirjat$t$,
    $t$contractual and settlement documents$t$,
    $t$contractual and invoicing documents$t$);

  -- 12.4 (в середине главы) — вместо претензий через Aivomaa короткое верное правило.
  perform pg_temp.put(v_doc, '{12,4}',
    $t$Aivomaa Oy ei ole minkään palvelussa tehdyn kuljetuksen sopimuskumppani, joten kaikki kuljetusta koskevat reklamaatiot käsitellään tilaajan ja kuljetusliikkeen kesken kohtien 12.1 ja 12.2 mukaisesti. Aivomaa Oy ei toimi reklamaatioissa välittäjänä, sovittelijana eikä ratkaisijana.$t$,
    $t$Aivomaa Oy is not the contracting party in any transport made in the service, so all claims concerning a transport are handled between the shipper and the carrier as set out in clauses 12.1 and 12.2. Aivomaa Oy does not act as an intermediary, mediator or adjudicator in claims.$t$);
end;
$$;


-- ── SHIPPER_AGREEMENT ──────────────────────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('SHIPPER_AGREEMENT');
begin
  -- 1.2 не посредник, оплату не гарантирует.
  perform pg_temp.swap2(v_doc, '{1,2}',
    $t$Aivomaa Oy ei ole kuljetussopimuksen osapuoli eikä rahdinkuljettaja tai huolitsija, ei laskuta rahtia,$t$,
    $t$Aivomaa Oy ei ole kuljetussopimuksen osapuoli eikä rahdinkuljettaja, huolitsija, rahdinvälittäjä tai muu kuljetusten välittäjä, ei laskuta rahtia omissa nimissään, ei takaa osapuolten välisiä maksuja,$t$,
    $t$Aivomaa Oy is not a party to the contract of carriage, nor a carrier or a freight forwarder; it does not invoice freight,$t$,
    $t$Aivomaa Oy is not a party to the contract of carriage, nor a carrier, a freight forwarder, a freight broker or any other intermediary of transport; it does not invoice freight in its own name, does not guarantee payments between the parties,$t$);

  -- 2.6, 2.8, 3.4 без ссылок на 9.7.
  perform pg_temp.cut(v_doc, '{2,6}',
    $t$Kohdan 9.7 mukaisten aiempien tilausten hinta, palvelumaksu ja laskutus ovat euroissa. $t$,
    $t$The price, service fee and invoicing of earlier orders under clause 9.7 are in euros. $t$);
  perform pg_temp.cut(v_doc, '{2,8}',
    $t$ sekä, jos tilaajalla on kohdan 9.7 mukaisia Aivomaa Oy:n laskuttamia kuljetuksia, maksukäyttäytymisestä niissä$t$,
    $t$ and, where the shipper has transports under clause 9.7 invoiced by Aivomaa Oy, its payment record for those transports$t$);
  perform pg_temp.cut(v_doc, '{3,4}',
    $t$ Kohdan 9.7 mukaisiin aiempiin tilauksiin sovelletaan niiden vahvistamishetkellä voimassa olleita palvelumaksuja.$t$,
    $t$ The service fees in force when they were confirmed apply to earlier orders under clause 9.7.$t$);

  -- 5.3 ожидание — строкой в недельном счёте перевозчика.
  perform pg_temp.put(v_doc, '{5,3}',
    $t$Jos osapuolet ovat sopineet odotusajan korvauksesta, kuljetusliike laskuttaa sen tilaajalta omalla laskullaan, tavallisesti kohdan 9.1 mukaisella laskulla, jolla odotusaika on omana rivinään tilauksen tunnuksella. Paikka, toimenpide, laskennan alku ja loppu sekä kesto käyvät ilmi palveluun tilaukselle kirjatuista ajoista, ja kuljetusliike antaa tilaajan pyynnöstä niistä laskelman.$t$,
    $t$Where the parties have agreed on compensation for waiting time, the carrier invoices it to the shipper on its own invoice, as a rule on the invoice under clause 9.1, on which the waiting time is a separate line with the order reference. The place, the operation, the start and end of the calculation and the duration appear from the times recorded for the order in the service, and the carrier provides the shipper with a calculation of them on request.$t$);

  -- 5.6 — последний пункт главы 5 (ожидание по старым условиям).
  perform pg_temp.drop_clause(v_doc, '{5,6}');

  -- 9.1 недельный счёт.
  perform pg_temp.put(v_doc, '{9,1}',
    $t$Kuljetusliike laskuttaa tilaajaa omissa nimissään valmistuneista kuljetuksista ja sovituista lisistä, kuten odotusajasta. Laskut laaditaan kuljetusliikkeen ja tilaajan sopimalla laskutusvälillä käyttöehtojen kohdan 8.4 mukaisesti, ja kunnes toisin sovitaan, kerran viikossa: palvelu muodostaa sovittuna laskutuspäivänä kuljetusliikkeen nimissä ja sen puolesta laskun valmistuneista ja vielä laskuttamattomista kuljetuksista ja lähettää sen tilaajalle sähköpostitse PDF-liitteenä; työmaakuljetukset laskutetaan samoin hyväksytyistä työpäivistä. Jos kuljetusliike laskuttaa omasta laskutusjärjestelmästään, se lähettää laskun itse sovitulla laskutusvälillä. Sama kuljetus laskutetaan vain kerran. Laskun maksuaika on osapuolten sopima, ja ellei muuta ole sovittu, 14 päivää. Aivomaa Oy ei ole laskun osapuoli eikä ota vastaan maksua.$t$,
    $t$The carrier invoices the shipper in its own name for completed transports and the agreed extras, such as waiting time. Invoices are issued at the invoicing interval agreed by the carrier and the shipper as set out in clause 8.4 of the terms of use and, until otherwise agreed, once a week: on the agreed invoicing day the service draws up, in the carrier's name and on its behalf, an invoice for the completed transports not yet invoiced and sends it to the shipper by email with a PDF attachment; worksite transports are invoiced in the same way on the basis of the approved working days. If the carrier invoices from its own invoicing system, it sends the invoice itself at the agreed invoicing interval. The same transport is invoiced only once. The payment term of the invoice is as agreed by the parties and, unless otherwise agreed, 14 days. Aivomaa Oy is not a party to the invoice and does not receive the payment.$t$);

  -- 9.5 отчёт по понедельникам.
  perform pg_temp.put(v_doc, '{9,5}',
    $t$Viikkoraportti: palvelu lähettää maanantaisin kello 4.00 UTC, mikä on Suomen aikaa 6.00 talvella ja 7.00 kesällä, jokaiselle osapuolelle raportin edellisen viikon (maanantaista sunnuntaihin) kuljetuksista ja työmaapäivistä. Raportti lähetetään tilaajalle myös silloin, kun kuljetusliike on itse lisännyt sen palveluun asiakkaakseen, niiltä viikoilta, joilla sillä oli kuljetuksia. Palvelua käyttävälle tilaajalle raportti lähetetään myös viikoilta, joilla kuljetuksia ei ollut; tällöin raportissa kerrotaan, ettei kuljetuksia ollut. Raportti palvelee täsmäytystä eikä ole lasku.$t$,
    $t$Weekly report: on Mondays at 04:00 UTC, which is 06:00 Finnish time in winter and 07:00 in summer, the service sends every party a report on the transports and worksite days of the previous week (Monday to Sunday). The report is sent to the shipper also where a carrier has itself added the shipper to the service as its customer, for the weeks in which it had transports. To a shipper using the service the report is sent also for weeks without transports, in which case it states that there were no transports. The report serves reconciliation and is not an invoice.$t$);

  -- 9.7 и 10.5 — последние пункты своих глав (переходное правило).
  perform pg_temp.drop_clause(v_doc, '{9,7}');
  perform pg_temp.drop_clause(v_doc, '{10,5}');
end;
$$;


-- ── CARRIER_AGREEMENT ──────────────────────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('CARRIER_AGREEMENT');
begin
  -- 1.2 без «Aivomaa välittää toimeksiantoja».
  perform pg_temp.swap2(v_doc, '{1,2}',
    $t$Sopimus on puitesopimus palvelun käytöstä eikä velvoita Aivomaa Oy:tä välittämään kuljetusliikkeelle tiettyä määrää toimeksiantoja, liikevaihtoa, ajosuoritetta tai jatkuvaa työtä.$t$,
    $t$Sopimus on puitesopimus palvelun käytöstä. Aivomaa Oy ei välitä kuljetuksia; toimeksiannot julkaisevat tai lähettävät tilaajat, eikä sopimus takaa kuljetusliikkeelle tiettyä määrää toimeksiantoja, liikevaihtoa, ajosuoritetta tai jatkuvaa työtä.$t$,
    $t$The agreement is a framework agreement on the use of the service and does not oblige Aivomaa Oy to pass on to the carrier any particular volume of assignments, turnover, mileage or continuous work.$t$,
    $t$The agreement is a framework agreement on the use of the service. Aivomaa Oy does not broker transports; assignments are published or sent by shippers, and the agreement does not guarantee the carrier any particular volume of assignments, turnover, mileage or continuous work.$t$);

  -- 2.1 бывшие субподрядчики: без расчётов по главе 12.
  perform pg_temp.swap2(v_doc, '{2,1}',
    $t$Sitä käyttänyt kuljetusliike siirtyy kuukausimaksuun kohdan 3.2 mukaisesti, ja sen ennen tämän sopimusversion voimaantuloa alihankintana vahvistamat toimeksiannot ajetaan loppuun ja tilitetään luvun 12 mukaisesti.$t$,
    $t$Sitä käyttänyt kuljetusliike siirtyy kuukausimaksuun kohdan 3.2 mukaisesti, eikä palvelussa ole enää toimeksiantoja, joissa Aivomaa Oy olisi tilaajan sopimuskumppani.$t$,
    $t$A carrier that used it moves to the monthly fee as set out in section 3.2, and the assignments it confirmed as subcontracting before this version of the agreement entered into force are completed and settled as set out in section 12.$t$,
    $t$A carrier that used it moves to the monthly fee as set out in section 3.2, and there are no longer any assignments in the service in which Aivomaa Oy is the shipper's contracting party.$t$);

  -- 2.2 только оператор: не посредник, оплату не гарантирует.
  perform pg_temp.put(v_doc, '{2,2}',
    $t$Aivomaa Oy on ainoastaan palvelun ylläpitäjä. Se ei osallistu kuljetuksiin, ei ole palvelussa tehtävien kuljetussopimusten osapuoli eikä toimi rahdinkuljettajana, sopimusrahdinkuljettajana, huolitsijana, rahdinvälittäjänä tai muuna kuljetusten välittäjänä. Aivomaa Oy ei laskuta tilaajaa omissa nimissään, ei ota vastaan rahtimaksuja, ei tilitä niitä kuljetusliikkeelle eikä takaa osapuolten välisiä maksuja. Kuljetusliike vastaa kuljetuksesta tilaajalle tiekuljetussopimuslain ja soveltuvin osin CMR-yleissopimuksen mukaisesti. Kuljetusliike vastaa siitä, että sen palveluun antamat asiakas-, kuljetus- ja laskutustiedot ovat oikeita.$t$,
    $t$Aivomaa Oy is only the operator of the service. It does not take part in transports, is not a party to the contracts of carriage made in the service and does not act as a carrier, a contracting carrier, a freight forwarder, a freight broker or any other intermediary of transport. Aivomaa Oy does not invoice the shipper in its own name, does not receive freight payments, does not settle them to the carrier and does not guarantee payments between the parties. The carrier is liable for the transport to the shipper under the Finnish Road Transport Contracts Act (tiekuljetussopimuslaki) and, where applicable, the CMR Convention. The carrier is responsible for ensuring that the customer, transport and invoicing data it enters in the service are correct.$t$);

  -- 2.3 отчёт по понедельникам.
  perform pg_temp.swap2(v_doc, '{2,3}',
    $t$Aivomaa Oy toimittaa palvelussa raportin tehdystä työstä.$t$,
    $t$Palvelu lähettää maanantaisin kello 4.00 UTC (Suomen aikaa 6.00 talvella ja 7.00 kesällä) jokaiselle osapuolelle, kuljetusliikkeille ja tilaajille, myös kuljetusliikkeen itse palveluun lisäämille asiakkaille, raportin edellisen viikon (maanantaista sunnuntaihin) töistä työmaapäivineen. Kuljetusliikkeelle raportti lähetetään myös viikoilta, joilla kuljetuksia ei ollut, ja siinä kerrotaan tällöin, ettei kuljetuksia ollut. Raportti ei ole lasku; laskutuksesta määrätään luvussa 13.$t$,
    $t$Aivomaa Oy provides a report of the work done in the service.$t$,
    $t$On Mondays at 04:00 UTC (06:00 Finnish time in winter and 07:00 in summer) the service sends every party, carriers and shippers, including customers the carrier has itself added to the service, a report on the work of the previous week (Monday to Sunday), including worksite days. To the carrier the report is also sent for weeks without transports, in which case it states that there were no transports. The report is not an invoice; invoicing is governed by section 13.$t$);

  -- 2.7, 2.9 без главы 12 и платёжной истории по счетам Aivomaa.
  perform pg_temp.cut(v_doc, '{2,7}',
    $t$ Luvun 12 toimeksiantojen hinta, palvelumaksu ja tilitys ovat euroissa.$t$,
    $t$ The price, service fee and settlement of assignments under section 12 are in euros.$t$);
  perform pg_temp.swap2(v_doc, '{2,9}',
    $t$Tilaajasta näytettävät maksutiedot, joihin voi sisältyä tilaajan maksukäyttäytyminen niissä aiemmissa kuljetuksissa, joista Aivomaa Oy on laskuttanut sitä, sekä rekisteritiedot ja tarkastettujen yritysasiakirjojen merkinnät,$t$,
    $t$Tilaajasta näytettävät maksutiedot, joihin sisältyvät kuljetusliikkeiden maksuilmoitusten yhteenveto, rekisteritiedot ja tarkastettujen yritysasiakirjojen merkinnät,$t$,
    $t$The payment information shown about a shipper, which may include the shipper's payment record for earlier transports invoiced to it by Aivomaa Oy as well as register data and the marks of checked company documents,$t$,
    $t$The payment information shown about a shipper, which includes the summary of carriers' payment reports, register data and the marks of checked company documents,$t$);

  -- 3.5 подписка — своим счётом, без зачёта из денег за перевозки.
  perform pg_temp.swap2(v_doc, '{3,5}',
    $t$14 päivän maksuajalla. Jos kuljetusliikkeelle maksetaan vielä luvun 12 mukaista tilitystä, erääntynyt kuukausimaksu voidaan vähentää siitä.$t$,
    $t$14 päivän maksuajalla omalla laskullaan. Aivomaa Oy ei käsittele kuljetusliikkeen rahtisaatavia eikä kuittaa kuukausimaksua niistä.$t$,
    $t$with 14 days' payment terms. Where a settlement under section 12 is still paid to the carrier, a monthly fee that has fallen due may be deducted from it.$t$,
    $t$with 14 days' payment terms on its own invoice. Aivomaa Oy does not handle the carrier's freight receivables and does not set off the monthly fee against them.$t$);

  -- 9.1 ожидание — между заказчиком и перевозчиком, в недельном счёте; 9.2–9.5 — конец главы.
  perform pg_temp.put(v_doc, '{9,1}',
    $t$Lastaus- ja purkupaikoilla hintaan sisältyvästä ajasta ja odotusajan korvauksesta sopivat kuljetusliike ja tilaaja toimeksiannossa tai keskenään. Aivomaa Oy ei maksa, laskuta, peri eikä oikaise odotusaikalisää. Palvelu kirjaa kuljettajan merkitsemät saapumis- ja valmistumisajat, ja osapuolet voivat käyttää niitä odotusajan näyttönä. Sovittu odotusajan korvaus laskutetaan tilaajalta kuljetusliikkeen laskulla luvun 13 mukaisesti, ja kuljetusliike antaa tilaajan pyynnöstä laskelman ajoista.$t$,
    $t$The time included in the price at loading and unloading places and compensation for waiting time are agreed between the carrier and the shipper in the assignment or between themselves. Aivomaa Oy does not pay, invoice, collect or adjust a waiting surcharge. The service records the arrival and completion times entered by the driver, and the parties may use them as evidence of waiting time. Agreed compensation for waiting time is invoiced to the shipper on the carrier's invoice as set out in section 13, and the carrier provides the shipper with a calculation of the times on request.$t$);
  perform pg_temp.drop_clause(v_doc, '{9,2}');
  perform pg_temp.drop_clause(v_doc, '{9,3}');
  perform pg_temp.drop_clause(v_doc, '{9,4}');
  perform pg_temp.drop_clause(v_doc, '{9,5}');

  -- 11.2 документы — только заказчику.
  perform pg_temp.cut(v_doc, '{11,2}',
    $t$ Luvun 12 toimeksiannoissa asiakirjat toimitetaan Aivomaa Oy:lle, joka voi käsitellä ja edelleen toimittaa ne asiakkaalle.$t$,
    $t$ In assignments under section 12 the documents are delivered to Aivomaa Oy, which may handle them and forward them to the customer.$t$);

  -- Глава 12: переходного режима нет; 12.1 — короткое верное правило, 12.2–12.6 — конец главы.
  perform pg_temp.retitle(v_doc, 12, 'Aiempi Alihankkija-malli', 'Former Subcontractor model');
  perform pg_temp.put(v_doc, '{12,1}',
    $t$Aiempi Alihankkija-malli ja toimeksiannot, joissa Aivomaa Oy oli tilaajan sopimuskumppani, ovat päättyneet, eikä palvelussa ole enää tällaisia toimeksiantoja. Aivomaa Oy ei tee kuljetusliikkeelle tilityksiä, ei laadi sen puolesta laskuja itselaskutuksena, ei kuittaa kuljetusliikkeen saatavia eikä tarjoa factoringia tai muuta rahoitusta.$t$,
    $t$The former Subcontractor model and assignments in which Aivomaa Oy was the shipper's contracting party have ended, and there are no longer any such assignments in the service. Aivomaa Oy makes no settlements to the carrier, does not draw up invoices on its behalf by self-billing, does not set off the carrier's receivables and offers no factoring or other financing.$t$);
  perform pg_temp.drop_clause(v_doc, '{12,2}');
  perform pg_temp.drop_clause(v_doc, '{12,3}');
  perform pg_temp.drop_clause(v_doc, '{12,4}');
  perform pg_temp.drop_clause(v_doc, '{12,5}');
  perform pg_temp.drop_clause(v_doc, '{12,6}');

  -- 13.1 поручение RAHTIS выставлять недельный счёт от имени перевозчика.
  perform pg_temp.put(v_doc, '{13,1}',
    $t$Kuljetusliike laskuttaa omia asiakkaitaan ja palvelussa olevia tilaajia omissa nimissään kaikista palvelussa tehdyistä kuljetuksista, ja asiakas tai tilaaja maksaa kuljetusmaksun suoraan kuljetusliikkeelle. Laskutusvälin ja maksuajan kuljetusliike sopii kunkin tilaajan kanssa palvelussa käyttöehtojen kohdan 8.4 mukaisesti; kunnes toisin sovitaan, lasku laaditaan kerran viikossa. Hyväksymällä tämän sopimuksen kuljetusliike valtuuttaa RAHTIS-palvelun muodostamaan sovittuna laskutuspäivänä kuljetusliikkeen nimissä ja sen puolesta kullekin asiakkaalle laskun valmistuneista ja vielä laskuttamattomista kuljetuksista ja sovituista lisistä sekä lähettämään sen asiakkaalle sähköpostitse PDF-liitteenä. Laskussa käytetään kuljetusliikkeen nimeä, Y-tunnusta, tilinumeroa ja sen omaa laskunumerointia. Työmaakuljetukset laskutetaan samoin viikoittain hyväksytyistä työpäivistä käyttöehtojen mukaisesti. Kuljetusliike voi kytkeä kuljetusten laskujen lähettämisen pois tilinsä asetuksista ja työmaan laskutuksen työmaan asetuksista, jos se laskuttaa omasta laskutusjärjestelmästään; tällöin se laskuttaa asiakasta itse sovitulla laskutusvälillä, työmaatyön kuitenkin vähintään kerran viikossa. Kuljetusliike vastaa laskulle tulevien hintojen ja lisien sekä omien tietojensa, kuten nimen, Y-tunnuksen, arvonlisäverotunnisteen ja tilinumeron, oikeellisuudesta. Aivomaa Oy ei ole laskun osapuoli, velkoja eikä maksun vastaanottaja, eikä se vastaa tilaajan tai asiakkaan maksun viivästymisestä, maksukyvyttömyydestä tai perinnästä.$t$,
    $t$The carrier invoices its own customers and the shippers in the service in its own name for all transports made in the service, and the customer or shipper pays the freight charge directly to the carrier. The carrier agrees the invoicing interval and the payment term with each shipper in the service as set out in clause 8.4 of the terms of use; until otherwise agreed, invoices are issued once a week. By accepting this agreement the carrier authorises the RAHTIS service to draw up on the agreed invoicing day, in the carrier's name and on its behalf, an invoice to each customer for the completed transports not yet invoiced and the agreed extras, and to send it to the customer by email with a PDF attachment. The invoice uses the carrier's name, business ID, bank account and its own invoice numbering. Worksite transports are invoiced weekly in the same way on the basis of the approved working days, in accordance with the terms of use. The carrier may switch the sending of transport invoices off in its account settings, and the invoicing of a worksite in the worksite's settings, if it invoices from its own invoicing system; it then invoices the customer itself at the agreed invoicing interval, and worksite work at least once a week. The carrier is responsible for the correctness of the prices and extras on the invoice and of its own details, such as its name, business ID, VAT number and bank account. Aivomaa Oy is not a party to the invoice, its creditor or the recipient of the payment, and is not responsible for late payment, insolvency or collection on the part of the shipper or customer.$t$);

  -- 13.2 (вместо «расчёты по главе 12») — один раз, НДС, срок, когда счёт не уходит.
  perform pg_temp.put(v_doc, '{13,2}',
    $t$Kuljetus laskutetaan vain kerran: palvelu ei laskuta kuljetusta, josta kuljetusliike on merkinnyt palveluun oman laskunsa. Arvonlisävero määräytyy seuraavasti: kotimaisessa kaupassa sovelletaan myyjän maan yleistä verokantaa, EU-maiden välisessä kaupassa laskutetaan 0 prosentin verokannalla käännetyn verovelvollisuuden perusteella ostajan arvonlisäverotunnisteella ja, kun myyjä tai ostaja on EU:n ulkopuolelta, 0 prosentin verokannalla laskuun tehtävin merkinnöin. Kuljetusliike vastaa siitä, että arvonlisäverokäsittely soveltuu sen myyntiin. Laskun maksuaika on osapuolten sopima, ja ellei muuta ole sovittu, 14 päivää. Palvelu ei lähetä laskua automaattisesti 48 tuntiin kuljetusliikkeen tilinumeron muuttumisen jälkeen eikä silloin, kun laskun edellyttämiä tietoja, kuten tilinumero tai ostajan arvonlisäverotunniste, puuttuu; tällöin kuljetusliike täydentää tiedot tai laskuttaa itse.$t$,
    $t$A transport is invoiced only once: the service does not invoice a transport for which the carrier has recorded its own invoice in the service. Value added tax is determined as follows: in domestic sales the standard rate of the seller's country applies; in sales between EU countries the invoice is issued at a 0 per cent rate under the reverse charge with the buyer's VAT number; and where the seller or the buyer is outside the EU, at a 0 per cent rate with a note on the invoice. The carrier is responsible for ensuring that this VAT treatment is appropriate to its sales. The payment term of the invoice is as agreed by the parties and, unless otherwise agreed, 14 days. The service does not send an invoice automatically within 48 hours of a change of the carrier's bank account number or where details required for the invoice, such as the bank account or the buyer's VAT number, are missing; the carrier then completes the details or invoices itself.$t$);

  -- 14.1 перевозчик ↔ субподрядчик — напрямую, раз в неделю.
  perform pg_temp.swap2(v_doc, '{14,1}',
    $t$Luvun 12 toimeksiantojen siirtämiseen tarvitaan lisäksi Aivomaa Oy:n suostumus.$t$,
    $t$Kuljetusliike ja sen alihankkija laskuttavat toisiaan suoraan keskenään sopimallaan laskutusvälillä; Aivomaa Oy ei ole niiden välisen sopimuksen eikä laskun osapuoli.$t$,
    $t$Passing on an assignment under section 12 also requires the consent of Aivomaa Oy.$t$,
    $t$The carrier and its subcontractor invoice each other directly at the invoicing interval they agree; Aivomaa Oy is not a party to the contract or the invoice between them.$t$);

  -- 15.3 — последний пункт главы 15 (регресс Aivomaa по главе 12).
  perform pg_temp.drop_clause(v_doc, '{15,3}');

  -- 16.1, 19.2 без главы 12.
  perform pg_temp.cut(v_doc, '{16,1}',
    $t$ Luvun 12 toimeksiannoissa tilaajan tiedot näytetään niiden vahvistamishetkellä voimassa olleiden ehtojen mukaisesti.$t$,
    $t$ In assignments under section 12 the shipper's details are shown under the terms in force when they were confirmed.$t$);
  perform pg_temp.cut(v_doc, '{19,2}',
    $t$ Luvun 12 toimeksiannoista jo ansaitut kuljetuskorvaukset maksetaan sen tilitysaikataulun mukaisesti.$t$,
    $t$ Freight charges already earned on assignments under section 12 are paid according to its settlement schedule.$t$);
end;
$$;


-- ── PRIVACY ────────────────────────────────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('PRIVACY');
begin
  perform pg_temp.swap2(v_doc, '{2,1}',
    $t$Yritys- ja tilitystiedot:$t$, $t$Yritys- ja laskutustiedot:$t$,
    $t$Company and settlement data:$t$, $t$Company and billing data:$t$);

  perform pg_temp.cut(v_doc, '{2,23}',
    $t$ sekä, jos tilaajalla on aiempia kuljetuksia, joissa Aivomaa Oy oli sen sopimuskumppani ja laskutti sitä, maksukäyttäytymisestä niissä$t$,
    $t$ and, where the customer has earlier transports in which Aivomaa Oy was its contracting party and invoiced it, its payment record for those transports$t$);

  perform pg_temp.swap2(v_doc, '{4,5}',
    $t$rekisteröinti, työn suorittaminen tai tilitykset eivät ole mahdollisia.$t$,
    $t$rekisteröinti, työn suorittaminen tai laskutus ei ole mahdollista.$t$,
    $t$registration, performance of the work or settlement may not be possible.$t$,
    $t$registration, performance of the work or invoicing may not be possible.$t$);

  perform pg_temp.swap2(v_doc, '{5,5}',
    $t$pankeille ja maksuliikenteeseen tilityksiä varten$t$,
    $t$pankeille ja maksuliikenteeseen Aivomaa Oy:n omien maksujen laskutusta ja perintää varten$t$,
    $t$to banks and payment infrastructure for settlements$t$,
    $t$to banks and payment infrastructure for invoicing and collecting Aivomaa Oy's own fees$t$);

  perform pg_temp.swap2(v_doc, '{8,1}',
    $t$tilitys- ja kuljetusasiakirjojen$t$, $t$laskutus- ja kuljetusasiakirjojen$t$,
    $t$all settlement and transport documents$t$, $t$all invoicing and transport documents$t$);

  perform pg_temp.swap2(v_doc, '{8,4}',
    $t$tilaukset, laskut, tilitykset ja rahtikirjat (CMR)$t$, $t$tilaukset, laskut ja rahtikirjat (CMR)$t$,
    $t$orders, invoices, settlements and consignment notes (CMR)$t$, $t$orders, invoices and consignment notes (CMR)$t$);

  perform pg_temp.cut(v_doc, '{10,2}',
    $t$Niissä aiemmissa keikoissa, joissa Aivomaa Oy on tilaajan sopimuskumppani, tilaaja ei näe kuljetusliikkeen nimeä eikä sen henkilöstön yhteystietoja, eikä kuljetusliike näe tilaajan nimeä, yhteystietoja eikä laskutustietoja. $t$,
    $t$In earlier jobs in which Aivomaa Oy is the shipper's contracting party, the shipper does not see the carrier's name or its personnel contact details, and the carrier does not see the shipper's name, contact details or billing details. $t$);

  -- 2.30 (новый, в конец главы 2): недельные счета от имени перевозчика и отчёты.
  perform pg_temp.put(v_doc, '{2,30}',
    $t$Laskut ja viikkoraportit: palvelu muodostaa kuljetusliikkeen nimissä ja sen puolesta laskut sen asiakkaille palvelussa tehdyistä kuljetuksista ja työmaapäivistä ja lähettää ne asiakkaan laskutussähköpostiin. Laskulla ovat osapuolten yritys- ja maksutiedot (nimi, Y-tunnus, arvonlisäverotunniste, osoite, laskutussähköposti ja viite sekä kuljetusliikkeen tilinumero) ja laskutettavat kuljetukset. Käsittelemme näitä tietoja kuljetusliikkeen lukuun ja sen ohjeiden mukaisesti; Aivomaa Oy ei ole laskun osapuoli. Lisäksi lähetämme maanantaisin jokaiselle osapuolelle raportin sen edellisen viikon töistä yrityksen yhteys- tai laskutussähköpostiin. Laskut säilytetään kohdan 8.4 mukaisesti. Omissa nimissään Aivomaa Oy laskuttaa ainoastaan omat palvelumaksunsa, ja tätä laskutusta varten käsitellään kohdan 2.1 tietoja.$t$,
    $t$Invoices and weekly reports: the service draws up, in the carrier's name and on its behalf, invoices to its customers for the transports and worksite days made in the service and sends them to the customer's invoicing email address. The invoice contains the parties' company and payment details (name, business ID, VAT number, address, invoicing email address and reference, and the carrier's bank account) and the transports invoiced. We process this data on behalf of the carrier and in accordance with its instructions; Aivomaa Oy is not a party to the invoice. In addition, on Mondays we send every party a report on its own work in the previous week to the company's contact or invoicing email address. Invoices are retained as set out in section 8.4. In its own name Aivomaa Oy invoices only its own service fees, and the data in section 2.1 is processed for that invoicing.$t$);
end;
$$;


-- ── Проверка: в черновиках не осталось старого режима ──────────────

do $$
declare
  v_hit record;
begin
  select d.kind, array_to_string(c.path, '.') as path, c.locale, m.phrase
  into v_hit
  from public.legal_documents d
  join public.legal_clauses c on c.document_id = d.id
  cross join unnest(array[
    'siirtymäsäännö', 'transitional provision',
    'luvun 12 ', 'luvun 12.', 'section 12 ', 'section 12.', 'section 12,', 'kohdan 9.7', 'clause 9.7',
    'kohdat 9.2', 'sections 9.2',
    'tilitysaikataulu', 'settlement schedule', 'puolen kuukauden', 'half-month',
    'laskuttanut sitä', 'laskutti sitä', 'laskuttamia kuljetuksia',
    'invoiced by Aivomaa', 'invoiced to it by Aivomaa', 'and invoiced it',
    'aiemmissa keikoissa', 'earlier jobs in which',
    'tilityksiä varten', 'for settlements', 'tilitys- ja', 'settlement and transport',
    'tilitykset ja', 'settlements and consignment', 'tilitystiedot', 'settlement data',
    'tilitysasiakirjat', 'settlement documents', 'tai tilitykset', 'or settlement may',
    'välittämään kuljetusliikkeelle', 'pass on to the carrier any',
    'tavanomaisin maksuehdoin', 'on the usual payment terms',
    'joka toinen viikko', 'every other week'
  ]) as m(phrase)
  where d.id in (
    pg_temp.draft_of('TERMS'), pg_temp.draft_of('SHIPPER_AGREEMENT'),
    pg_temp.draft_of('CARRIER_AGREEMENT'), pg_temp.draft_of('PRIVACY')
  )
    and (coalesce(c.title, '') || ' ' || coalesce(c.body, '')) ilike '%' || m.phrase || '%'
  limit 1;

  if found then
    raise exception '% % (%): осталось «%»', v_hit.kind, v_hit.path, v_hit.locale, v_hit.phrase;
  end if;
end;
$$;
