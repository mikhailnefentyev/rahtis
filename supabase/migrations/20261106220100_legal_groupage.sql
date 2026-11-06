-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: догрузы — свободное место в машине (6.11.2026)
--
-- Под 20261106220000_groupage. Новые пункты в конце разделов (номер —
-- следующий свободный):
--   TERMS — раздел 8: место показывается только с согласия перевозчика
--     (каждый раз или автоматически, отзыв в любой момент); что видно
--     другим; принятый запрос — прямой договор заказчик — перевозчик;
--     каботаж — ответственность перевозчика, предупреждение — справка;
--   PRIVACY — раздел 2: маршрут городами и место видят участники.
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
  perform pg_temp.append(pg_temp.draft_of('TERMS'), 8, 'Vapaa tila kuljetuksessa:',
    'Vapaa tila kuljetuksessa: palvelu laskee kuljetusliikkeen ajoneuvon kuljetukselle vapaana olevan tilan (lavametrit, paino ja kuljetusliikkeen ilmoittamat lavapaikat) ajoneuvon ja yhdistelmän tietojen sekä ajoneuvolle osoitettujen toimeksiantojen perusteella. Laskelma on arvio, ja kuljetusliike voi korjata sen. Vapaa tila näytetään muille palvelun käyttäjille vain kuljetusliikkeen suostumuksella: kuljetusliike julkaisee sen kerrallaan tai valitsee yritykselle tai ajoneuvolle automaattisen julkaisun, josta se saa ilmoituksen ja jonka se voi perua milloin tahansa; perumisen yhteydessä automaattisesti julkaistu tila poistetaan näkyvistä. Valinnan tekijä ja ajankohta tallennetaan. Muille näytetään lähtö- ja määräpaikka paikkakunnan tarkkuudella, päivämäärät, vapaa tila, ajoneuvo- ja koritiedot, kuljetusliikkeen nimi ja tieto palvelun tarkastuksesta; tarkkoja osoitteita, reittiä tai ajoneuvon rekisterinumeroa ei näytetä ennen kuin pyyntö on hyväksytty. Julkaistu tila poistuu, kun kuljetus on ohittanut osuuden alkupisteen tai päivä on mennyt. Tilaaja voi lähettää tilasta pyynnön omalla toimeksiannollaan ja hinnallaan; kun kuljetusliike hyväksyy pyynnön, toimeksianto syntyy suoraan tilaajan ja kuljetusliikkeen välisenä sopimuksena, johon sovelletaan näitä ehtoja suorista toimeksiannoista, eikä Aivomaa Oy ole sen osapuoli. Kabotaasi: jos kuljetusliike on sijoittautunut eri maahan kuin se, jossa kuorma lastataan ja puretaan, palvelu näyttää molemmille osapuolille muistutuksen kabotaasisäännöistä (asetus (EY) N:o 1072/2009, 8 artikla, sellaisena kuin se on muutettuna asetuksella (EU) 2020/1055: enintään kolme kabotaasikuljetusta seitsemän päivän kuluessa kansainvälisen kuljetuksen purkamisesta, minkä jälkeen neljän päivän tauko samassa maassa) sekä palvelun tietojen mukaisen määrän kuljetusliikkeen viimeaikaisista kuljetuksista kyseisessä maassa. Muistutus on vain tiedoksi; kabotaasisääntöjen noudattaminen on kuljetusliikkeen vastuulla.',
    'Free space on a transport: the service calculates the space available on a carrier''s vehicle during a transport (loading metres, weight and pallet places stated by the carrier) from the data of the vehicle and combination and the assignments allocated to the vehicle. The calculation is an estimate, and the carrier may correct it. Free space is shown to other users of the service only with the carrier''s consent: the carrier publishes it each time or chooses automatic publication for the company or a vehicle, of which it is notified and which it may revoke at any time; on revocation, space published automatically is removed from view. Who made the choice and when is recorded. Others are shown the places of departure and destination at town level, the dates, the free space, the vehicle and body details, the name of the carrier and whether it has been checked by the service; exact addresses, the route or the registration number of the vehicle are not shown until a request has been accepted. Published space is removed when the transport has passed the start of the section or the date has passed. A customer may send a request for the space with its own assignment and price; when the carrier accepts the request, the assignment is formed as a contract directly between the customer and the carrier, to which these terms on direct assignments apply, and Aivomaa Oy is not a party to it. Cabotage: where the carrier is established in a country other than the one in which the load is loaded and unloaded, the service shows both parties a reminder of the cabotage rules (Regulation (EC) No 1072/2009, Article 8, as amended by Regulation (EU) 2020/1055: no more than three cabotage operations within seven days of unloading an international carriage, followed by a four-day cooling-off period in the same country) and the number of the carrier''s recent transports in that country according to the data of the service. The reminder is for information only; compliance with the cabotage rules is the responsibility of the carrier.');

  perform pg_temp.append(pg_temp.draft_of('PRIVACY'), 2, 'Vapaa tila kuljetuksessa:',
    'Vapaa tila kuljetuksessa: kun kuljetusliike julkaisee ajoneuvon vapaan tilan itse tai valitsemallaan automaattisella julkaisulla, näytämme palvelun tilaajille lähtö- ja määräpaikan paikkakunnan tarkkuudella, päivämäärät, vapaan tilan, ajoneuvo- ja koritiedot sekä kuljetusliikkeen nimen. Haussa ja etäisyyksissä käytämme paikkakunnan likimääräistä sijaintia (noin 0,1 asteen ruudukko) emmekä tarkkoja osoitteita. Tilaajan pyynnöstä näytämme kuljetusliikkeelle tilaajan nimen, kuorman lähtö- ja määräpaikkakunnat, päivät, kuorman koon ja kuvauksen sekä hinnan; tarkat osoitteet, yhteyshenkilöt ja ajoneuvon rekisterinumero näytetään osapuolille vasta, kun pyyntö on hyväksytty ja toimeksianto syntynyt. Tallennamme myös, kuka kuljetusliikkeessä valitsi automaattisen julkaisun ja milloin. Tiedot säilytetään samoin kuin toimeksiantojen tiedot. Peruste on palvelun käyttäjien kanssa tehty sopimus ja kuljetusliikkeen antama suostumus vapaan tilan julkaisemiseen.',
    'Free space on a transport: when a carrier publishes a vehicle''s free space itself or through automatic publication that it has chosen, we show the customers of the service the places of departure and destination at town level, the dates, the free space, the vehicle and body details and the name of the carrier. In search and distances we use an approximate location of the town (a grid of about 0.1 degrees) and not exact addresses. On a customer''s request we show the carrier the customer''s name, the towns of departure and destination of the load, the dates, the size and description of the load and the price; exact addresses, contact persons and the registration number of the vehicle are shown to the parties only once the request has been accepted and the assignment formed. We also record who at the carrier chose automatic publication and when. The data is kept in the same way as the data of assignments. The legal basis is the contract with the users of the service and the carrier''s consent to the publication of free space.');
end;
$$;
