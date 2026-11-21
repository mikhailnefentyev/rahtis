-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · условия и политика: продажа техники в рассрочку (22.11.2026)
--
-- Под поведение 20261122100000_installment_sales. Черновики (если
-- черновика нет — копия действующей версии), активация — решение
-- пользователя.
--   TERMS, раздел 8 — новый пункт «Kaluston osamaksukauppa»: кто может
--     продавать и покупать, согласование по очереди, договор и первый
--     счёт от имени продавца; Aivomaa Oy не сторона и денег не проводит;
--     шаблон и калькулятор — помощь, а не консультация.
--   PRIVACY, раздел 2 — что хранится, кто видит. Данные GPS и рейсов
--     машины во время рассрочки пока не передаются (этап 3) — так и
--     сказано.
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

do $$
declare
  v_terms uuid := pg_temp.draft_of('TERMS');
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
  v_no integer;
begin
  if not exists (
    select 1 from public.legal_clauses
    where document_id = v_terms and locale = 'fi' and body like 'Kaluston osamaksukauppa:%'
  ) then
    select coalesce(max(path[2]), 0) + 1 into v_no
    from public.legal_clauses where document_id = v_terms and cardinality(path) = 2 and path[1] = 8;

    insert into public.legal_clauses (document_id, locale, path, title, body) values
      (v_terms, 'fi', array[8, v_no], null,
       'Kaluston osamaksukauppa: kuljetusliike voi ilmoittaa palvelussa oman ajoneuvonsa myytäväksi osamaksulla, ja toinen kuljetusliike voi tehdä siitä tarjouksen. Myyjänä ja ostajana voi toimia vain yritys, jolla on palvelussa voimassa oleva rekisteriote ja vakuutus, ja kaupan tekee yrityksen pääkäyttäjä. Osapuolet sopivat ehdoista palvelussa vuorotellen, ja kumpikin voi hyväksyä vain ne ehdot, jotka se on nähnyt. Kun ehdot on sovittu, palvelu muodostaa osamaksukaupasta annetun lain (91/1966) mukaisen osamaksusopimuksen pohjan sekä myyjän nimissä ja myyjän tiedoilla ensimmäisen laskun, jolla laskutetaan käsiraha ja koko kauppahinnan arvonlisävero. Kauppa ja sopimus syntyvät myyjän ja ostajan välille. Aivomaa Oy ei ole kaupan osapuoli, ei välitä eikä vastaanota maksuja, ei tarkasta ajoneuvon kuntoa, omistusta eikä kiinnityksiä eikä vastaa osapuolten velvoitteista. Sopimuspohja ja laskuri ovat apuvälineitä eivätkä korvaa oikeudellista tai verotuksellista neuvontaa; osapuolet vastaavat sopimuksen sisällöstä ja allekirjoittamisesta, ajoneuvon rekisteröinnistä ja vakuutuksista sekä kaupan verotuksesta.'),
      (v_terms, 'en', array[8, v_no], null,
       'Equipment installment sales: a carrier may list its own vehicle in the service for sale in instalments, and another carrier may make an offer for it. Only a company with a valid register extract and insurance in the service may act as seller or buyer, and the sale is made by the company''s owner user. The parties agree on the terms in the service in turns, and each may accept only terms it has seen. Once the terms are agreed, the service produces a hire-purchase contract template under the Finnish Hire-Purchase Act (91/1966) and, in the seller''s name and with the seller''s details, the first invoice for the down payment and the VAT on the whole price. The sale and the contract are between the seller and the buyer. Aivomaa Oy is not a party to the sale, does not handle or receive payments, does not check the vehicle''s condition, ownership or registered charges and is not liable for the parties'' obligations. The contract template and the calculator are aids and do not replace legal or tax advice; the parties are responsible for the content and signing of the contract, the registration and insurance of the vehicle and the taxation of the sale.');
  end if;

  if not exists (
    select 1 from public.legal_clauses
    where document_id = v_privacy and locale = 'fi' and body like 'Kaluston osamaksukauppa:%'
  ) then
    select coalesce(max(path[2]), 0) + 1 into v_no
    from public.legal_clauses where document_id = v_privacy and cardinality(path) = 2 and path[1] = 2;

    insert into public.legal_clauses (document_id, locale, path, title, body) values
      (v_privacy, 'fi', array[2, v_no], null,
       'Kaluston osamaksukauppa: myynti-ilmoituksesta tallennetaan ajoneuvon tiedot, hinta- ja maksuehdot, matkamittarilukema ja kuvaus; neuvottelusta osapuolet sekä kunkin ehdotuksen ehdot, ehdottaja ja ajankohta; sovitusta kaupasta sopimusnumero ja myyjän ensimmäinen lasku. Ilmoituksen näkevät palvelussa kuljetusliikkeet, joilla on voimassa oleva rekisteriote ja vakuutus. Neuvottelun ja kaupan tiedot näkevät vain myyjä, ostaja ja palvelun ylläpito. Tiedot ovat pääosin yritystietoja, mutta niissä voi olla yhteyshenkilöiden nimiä ja yhteystietoja. Tietoja käsitellään palvelun tarjoamiseksi osapuolten pyynnöstä. Ajoneuvon sijainti- ja käyttötietoja ei tämän toiminnon kautta jaeta myyjälle. Laskut säilytetään kirjanpitolain edellyttämän ajan.'),
      (v_privacy, 'en', array[2, v_no], null,
       'Equipment installment sales: for a listing, the vehicle''s details, the price and payment terms, the odometer reading and the description are stored; for a negotiation, the parties and the terms, proposer and time of each proposal; for an agreed sale, the contract number and the seller''s first invoice. Listings are visible in the service to carriers with a valid register extract and insurance. Negotiation and sale details are visible only to the seller, the buyer and the service administrators. The data is mainly company data but may include contact persons'' names and contact details. The data is processed to provide the service at the parties'' request. The vehicle''s location and usage data are not shared with the seller through this function. Invoices are kept for the period required by the Accounting Act.');
  end if;
end;
$$;
