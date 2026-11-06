-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: полис экспедитора для прямого договора (6.11.2026)
--
-- Под поведение 20261106120000_forwarder_insurance. Новые пункты в конце
-- разделов (номер — следующий свободный):
--   TERMS — раздел 8: договор напрямую с перевозчиком описан там же
--     (8.5), туда и условие допуска к нему;
--   SHIPPER_AGREEMENT — раздел 2: заверения заказчика-экспедитора;
--   CARRIER_AGREEMENT — раздел 2: что значит «полис проверен до …».
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
  perform pg_temp.append(pg_temp.draft_of('TERMS'), 8, 'Huolitsijan vastuuvakuutus:',
    'Huolitsijan vastuuvakuutus: tilaaja, joka toimii huolitsijana tai muuna kuljetusten välittäjänä, voi julkaista toimeksiannon suoraan kuljetusliikkeen kanssa tehtävänä sopimuksena tai lähettää suoran tilauksen kuukausimaksulla palvelua käyttävän kuljetusliikkeen ajoneuvolle vain, jos sillä on voimassa oleva huolitsijan vastuuvakuutus, jonka Aivomaa Oy on tarkastanut. Vakuutuksen vastuumäärän on oltava vähintään 250 000 euroa vahinkotapahtumaa kohden ja vähintään 500 000 euroa vakuutuskautta kohden yhteensä; muussa valuutassa ilmoitettu vastuumäärä muunnetaan euroiksi Euroopan keskuspankin viitekurssilla tarkastuspäivänä. Vakuutuksen on katettava huolintatoiminta niissä maissa, joissa tilaaja toimeksiantoja julkaisee, vähintään Euroopan talousalueella ja Norjassa. Jos tilaaja ottaa kuljetuksen hoitaakseen omissa nimissään sopimusrahdinkuljettajana, sillä on oltava myös tiekuljetussopimuslain ja CMR-yleissopimuksen mukaisen vastuun kattava vakuutus. Puolalaisella tilaajalla on lisäksi oltava voimassa oleva lupa tavarankuljetusten välitykseen (licencja na pośrednictwo przy przewozie rzeczy). Vaatimus ei koske tilaajaa, joka kuljettaa omia tavaroitaan, eikä toimeksiantoja, joissa Aivomaa Oy on tilaajan sopimuskumppani. Aivomaa Oy voi pyytää vakuutuksen voimassaolosta vahvistuksen suoraan vakuutuksenantajalta sekä keskeyttää suorien sopimusten julkaisemisen, jos vakuutus on päättynyt, sen vastuumäärä on laskenut alle vaaditun tai sen voimassaoloa ei ole voitu vahvistaa. Keskeytys ei koske jo vahvistettuja kuljetuksia. Aivomaa Oy:n tekemä tarkastus ei ole takuu vakuutuksen voimassaolosta, korvauksista eikä tilaajan maksukyvystä, eikä se vapauta osapuolia tekemästä omaa selvitystään sopimuskumppanistaan.',
    'Freight forwarder''s liability insurance: a customer acting as a freight forwarder or other intermediary of transport may publish an assignment as a contract to be made directly with a carrier, or send a direct order to a vehicle of a carrier using the service for a monthly fee, only if it holds valid freight forwarder''s liability insurance that Aivomaa Oy has checked. The limit of indemnity must be at least EUR 250,000 per occurrence and at least EUR 500,000 in the aggregate per insurance period; a limit stated in another currency is converted into euros at the European Central Bank reference rate on the date of the check. The insurance must cover forwarding activities in the countries in which the customer publishes assignments, at least in the European Economic Area and Norway. If the customer undertakes a transport in its own name as a contracting carrier, it must also hold insurance covering its liability under the Finnish Road Transport Contracts Act (tiekuljetussopimuslaki) and the CMR Convention. A Polish customer must in addition hold a valid licence for intermediation in the carriage of goods (licencja na pośrednictwo przy przewozie rzeczy). The requirement does not apply to a customer transporting its own goods, nor to assignments in which Aivomaa Oy is the customer''s contracting party. Aivomaa Oy may request confirmation of the insurance directly from the insurer and may suspend the publication of direct contracts if the insurance has ended, its limit has fallen below the required amount or its validity could not be confirmed. A suspension does not affect transports already confirmed. The check made by Aivomaa Oy is not a guarantee of the validity of the insurance, of any indemnity or of the customer''s ability to pay, and it does not release the parties from making their own enquiries about their contracting party.');

  perform pg_temp.append(pg_temp.draft_of('SHIPPER_AGREEMENT'), 2, 'Huolitsijana toimiva tilaaja:',
    'Huolitsijana toimiva tilaaja: tilaaja ilmoittaa palvelussa, toimiiko se huolitsijana vai kuljettaako se omia tavaroitaan, ja vakuuttaa ilmoituksen oikeaksi. Huolitsijana toimiva tilaaja vakuuttaa, että sillä on käyttöehtojen mukainen huolitsijan vastuuvakuutus koko sen ajan, jonka se julkaisee toimeksiantoja suoraan kuljetusliikkeen kanssa tehtävinä sopimuksina tai lähettää suoria tilauksia kuukausimaksulla palvelua käyttävien kuljetusliikkeiden ajoneuvoille. Tilaajan on ilmoitettava Aivomaa Oy:lle vakuutuksen päättymisestä, irtisanomisesta, vastuumäärän alentamisesta tai muusta olennaisesta muutoksesta viiden (5) arkipäivän kuluessa muutoksesta sekä toimitettava pyynnöstä vakuutuksenantajan antama vakuutustodistus. Aivomaa Oy saa tarkistaa vakuutuksen tiedot vakuutuksenantajalta. Vakuutuksen puuttuminen tai riittämättömyys ei rajoita tilaajan vastuuta kuljetusliikkeelle.',
    'Customer acting as a freight forwarder: the customer states in the service whether it acts as a freight forwarder or transports its own goods, and warrants that the statement is correct. A customer acting as a freight forwarder warrants that it holds freight forwarder''s liability insurance in accordance with the terms of use for as long as it publishes assignments as contracts to be made directly with a carrier or sends direct orders to vehicles of carriers using the service for a monthly fee. The customer must notify Aivomaa Oy of the expiry or cancellation of the insurance, a reduction of its limit or any other material change within five (5) business days of the change, and provide on request an insurance certificate issued by the insurer. Aivomaa Oy may verify the details of the insurance with the insurer. The absence or insufficiency of the insurance does not limit the customer''s liability towards the carrier.');

  perform pg_temp.append(pg_temp.draft_of('CARRIER_AGREEMENT'), 2, 'Tilaajan vakuutustieto:',
    'Tilaajan vakuutustieto: suoraan tilaajan kanssa tehtävän toimeksiannon yhteydessä palvelu voi näyttää kuljetusliikkeelle merkinnän, jonka mukaan tilaajan huolitsijan vastuuvakuutus on tarkastettu ja voimassa tiettyyn päivään asti. Merkintä perustuu tilaajan toimittamiin asiakirjoihin ja Aivomaa Oy:n tarkastukseen. Se on tieto eikä takuu: Aivomaa Oy ei takaa vakuutuksen voimassaoloa, korvausta eikä rahdin maksamista, eikä merkintä muuta sitä, että kuljetussopimus ja maksu ovat kuljetusliikkeen ja tilaajan välisiä.',
    'Customer''s insurance information: in connection with an assignment made directly with a customer, the service may show the carrier a note stating that the customer''s freight forwarder''s liability insurance has been checked and is valid until a certain date. The note is based on documents provided by the customer and on a check made by Aivomaa Oy. It is information, not a guarantee: Aivomaa Oy does not guarantee the validity of the insurance, any indemnity or the payment of the freight, and the note does not change the fact that the contract of carriage and the payment are between the carrier and the customer.');
end;
$$;
