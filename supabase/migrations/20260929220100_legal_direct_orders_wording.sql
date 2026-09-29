-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: прямой заказ и запись операции — по поведению
--
-- Сверка документов с поведением 29.09.2026.
--
-- TERMS 6.6 заканчивался фразой «Aivomaa Oy — сторона договора и в прямых
-- заказах», а 8.5(a), договор заказчика 2.5 и договор перевозчика 2.3
-- говорят обратное для перевозчика на подписке: там договор перевозки —
-- между заказчиком и перевозчиком, Aivomaa лишь передаёт данные и отчёт.
-- Код работает по второму (contract_party = CARRIER). Фраза приведена к
-- тому, что уже решено в 8.5(a) и 2.5.
--
-- Договор заказчика 5.5 обещал запись «прибытия, начала и конца
-- операции»; приложение записывает прибытие на точку и её завершение,
-- отдельного начала операции нет. Текст — по тому, что записывается.
--
-- Черновик; активация — решение пользователя.
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
  v_shipper uuid := pg_temp.draft_of('SHIPPER_AGREEMENT');
begin
  perform pg_temp.put(v_terms, array[6, 6],
    'Tilaaja voi lähettää toimeksiannon suoraan ajoneuvolle, joka on ajanut sen keikkoja, jos ajoneuvon kuljetusliike on sallinut tältä tilaajalta suorat tilaukset. Suora tilaus ei mene tarjouspöydälle eikä sillä ole määräaikaa: se odottaa, kunnes kuljetusliike tai sen kuljettaja vahvistaa sen, ja kuljetussopimus syntyy vahvistuksesta kuten kohdassa 6.3. Ennen vahvistusta tilaaja voi siirtää toimeksiannon tarjouspöydälle ja kuljetusliike voi kieltäytyä; kummassakin tapauksessa toimeksianto julkaistaan tarjouspöydällä. Jos ajoneuvon kuljetusliike käyttää palvelua kuukausimaksulla, suora tilaus tehdään tilaajan ja kuljetusliikkeen välille kohdan 8.5 (a) mukaisesti: kuljetusliike laskuttaa tilaajaa itse ja vastaa kuljetuksesta, ja Aivomaa Oy välittää tiedot ja raportin tehdystä työstä. Muissa tapauksissa Aivomaa Oy on tilaajan sopimuskumppani myös suorissa tilauksissa.',
    'The shipper may send a job directly to a vehicle that has performed its jobs, provided the vehicle''s carrier has allowed direct orders from that shipper. A direct order does not go to the board and has no deadline: it waits until the carrier or its driver confirms it, and the contract of carriage is formed on confirmation as under clause 6.3. Before confirmation the shipper may move the job to the board and the carrier may decline; in either case the job is published on the board. If the vehicle''s carrier uses the service for a monthly fee, the direct order is made between the shipper and the carrier as set out in clause 8.5 (a): the carrier invoices the shipper itself and is responsible for the transport, and Aivomaa Oy passes on the data and a report of the work done. In other cases Aivomaa Oy is the shipper''s contracting party in direct orders as well.');

  perform pg_temp.put(v_shipper, array[5, 5],
    'Ajoneuvon saapuminen pisteeseen ja toimenpiteen päättyminen kirjataan sovelluksessa tilaukselle aikoineen. Näyttönä toimivat sovelluksen merkinnät ja käytettävissä olevat asiakirjat, valokuvat, kohteen merkinnät tai muu viivettä koskeva selvitys. Tilaaja voi pyytää laskelman ja esittää perustellut huomautukset. Kohteen edustajan allekirjoituksen puuttuminen ei sinänsä tee odotusaikaa toteennäytetyksi eikä näyttämättömäksi.',
    'The arrival of the vehicle at the stop and the completion of the operation are recorded on the order in the application with their times. Evidence consists of the entries in the application and the available documents, photographs, site records or other information concerning the delay. The shipper may request the calculation and submit reasoned objections. The absence of a signature by a representative of the site does not in itself make the claimed waiting time proved or disproved.');

  raise notice 'Черновики: TERMS v%, SHIPPER_AGREEMENT v%',
    (select version from public.legal_documents where id = v_terms),
    (select version from public.legal_documents where id = v_shipper);
end;
$$;
