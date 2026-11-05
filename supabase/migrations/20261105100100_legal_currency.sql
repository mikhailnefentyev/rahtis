-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: своя валюта компании (5.11.2026)
--
-- Под поведение 20261105100000_currency: деньги RAHTIS — евро; свои
-- рейсы, расходы, топливо, зарплата, свои объекты и заказы «напрямую с
-- перевозчиком» — в валюте компании (EUR, SEK, NOK, DKK, PLN); пересчёты
-- по курсу ЕЦБ справочные. Новые пункты в конце разделов:
--   TERMS — раздел 8 (цены и оплата);
--   CARRIER_AGREEMENT — раздел 2 (свои рейсы, прямые заказы);
--   SHIPPER_AGREEMENT — раздел 2 (прямые заказы).
-- Номер — следующий свободный в разделе. Черновики, активация — решение
-- пользователя.
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
  perform pg_temp.append(pg_temp.draft_of('TERMS'), 8, 'Valuutat:',
    'Valuutat: RAHTIS-palvelun kautta välitettyjen kuljetusten hinnat, palvelumaksut, kuukausimaksut ja Aivomaa Oy:n laskut ja tilitykset ovat aina euroissa. Yritys voi valita palvelussa oman valuuttansa (euro, Ruotsin, Norjan tai Tanskan kruunu tai Puolan złoty). Sitä käytetään yrityksen omissa keikoissa, ajoneuvojen kuluissa, polttoainekirjauksissa, palkkalaskelmissa ja omissa työmaissa sekä tilauksissa, jotka sovitaan suoraan tilaajan ja kuljetusliikkeen välillä. Polttoaineen ostot kirjataan kuitin valuutassa. Kukin summa säilytetään siinä valuutassa, jossa se on kirjattu, eikä valuutan vaihtaminen muuta aiempia summia. Palvelun näyttämät muunnokset ja yhteenvedot lasketaan Euroopan keskuspankin viitekursseilla kirjauspäivältä; ne ovat suuntaa-antavia eivätkä muuta sovittua hintaa tai laskun valuuttaa.',
    'Currencies: the prices of transports arranged through the RAHTIS service, the service fees, the monthly fees and the invoices and settlements of Aivomaa Oy are always in euros. A company may choose its own currency in the service (euro, Swedish, Norwegian or Danish krone, or Polish złoty). It is used for the company''s own jobs, vehicle costs, fuel records, pay calculations and own worksites, and for orders agreed directly between a customer and a carrier. Fuel purchases are recorded in the currency of the receipt. Each amount is kept in the currency in which it was recorded, and changing the currency does not change earlier amounts. Conversions and totals shown by the service are calculated at the European Central Bank reference rates of the day of the record; they are indicative and do not change the agreed price or the currency of an invoice.');

  perform pg_temp.append(pg_temp.draft_of('CARRIER_AGREEMENT'), 2, 'Valuutta:',
    'Valuutta: oman keikan ja suoraan tilaajan kanssa sovitun kuljetuksen hinta voidaan merkitä kuljetusliikkeen tai tilaajan valitsemassa valuutassa palvelun käyttöehtojen mukaisesti, ja tällaisen kuljetuksen laskutus tapahtuu osapuolten välillä tässä valuutassa. Kun Aivomaa Oy on kuljetuksen sopimuskumppani, kuljetuksen hinta, palvelumaksu ja tilitys ovat euroissa. Palvelun näyttämät muunnokset muihin valuuttoihin ovat suuntaa-antavia.',
    'Currency: the price of an own job and of a transport agreed directly with a customer may be recorded in the currency chosen by the carrier or the customer in accordance with the terms of use of the service, and such a transport is invoiced between the parties in that currency. When Aivomaa Oy is the contracting party of a transport, its price, the service fee and the settlement are in euros. Conversions into other currencies shown by the service are indicative.');

  perform pg_temp.append(pg_temp.draft_of('SHIPPER_AGREEMENT'), 2, 'Valuutta:',
    'Valuutta: kun tilaaja tekee tilauksen suoraan kuljetusliikkeen kanssa, tilaaja voi valita hinnan valuutaksi euron, Ruotsin, Norjan tai Tanskan kruunun tai Puolan złotyn. Valuutta näkyy kuljetusliikkeelle ennen kuin se ottaa kuljetuksen vastaan, ja laskutus tapahtuu osapuolten välillä tässä valuutassa. Kun Aivomaa Oy on tilaajan sopimuskumppani, kuljetuksen hinta, palvelumaksu ja laskutus ovat euroissa. Palvelun näyttämät muunnokset muihin valuuttoihin ovat suuntaa-antavia.',
    'Currency: when the customer places an order directly with a carrier, the customer may choose the euro, the Swedish, Norwegian or Danish krone or the Polish złoty as the currency of the price. The currency is shown to the carrier before it accepts the transport, and invoicing between the parties takes place in that currency. When Aivomaa Oy is the customer''s contracting party, the price of the transport, the service fee and invoicing are in euros. Conversions into other currencies shown by the service are indicative.');
end;
$$;
