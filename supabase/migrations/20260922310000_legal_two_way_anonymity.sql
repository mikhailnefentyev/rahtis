-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: анонимность в обе стороны
--
-- С миграции carrier_sees_no_shipper перевозчик не видит, чей заказ:
-- заказчики в разделе «Asiakkaat» и в письмах — кодом. Черновики TERMS
-- (6.7) и PRIVACY (10.2), заведённые миграцией known_vehicle_contacts,
-- дополняются этим. Точки маршрута (место погрузки и выгрузки, контакт
-- на месте) перевозчик видит, как и раньше: без них работу не сделать.
-- Активация — решение пользователя.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_terms uuid;
  v_privacy uuid;
begin
  select id into v_terms from public.legal_documents
  where kind = 'TERMS' and status = 'DRAFT' order by version desc limit 1;
  select id into v_privacy from public.legal_documents
  where kind = 'PRIVACY' and status = 'DRAFT' order by version desc limit 1;

  if v_terms is null or v_privacy is null then
    raise exception 'Нет черновиков TERMS и PRIVACY — сначала known_vehicle_contacts.' using errcode = '55007';
  end if;

  update public.legal_clauses set body = case locale
    when 'fi' then 'Kuljetusliike päättää, mitkä tilaajat saavat lähettää suoria tilauksia sen ajoneuvoille, ja voi perua luvan milloin tahansa; peruminen ei vaikuta jo lähetettyihin tilauksiin. Tällaisista ajoneuvoista tilaaja näkee rekisteritunnuksen, ajoneuvon tiedot ja kuljetusliikkeen arvosanan sekä yhteydenpitoa varten kuljettajan nimen, puhelinnumeron ja sähköpostiosoitteen, mutta ei kuljetusliikkeen nimeä eikä sen muita tietoja. Vastaavasti kuljetusliike ei näe tilaajan nimeä: tilaajat näkyvät sille koodilla, keikkamäärällä ja viimeisimmällä reitillä. Kuljetuksen suorittamiseen tarvittavat lastaus- ja purkupaikkojen tiedot näkyvät kuljetusliikkeelle ja kuljettajalle.'
    else 'The carrier decides which shippers may send direct orders to its vehicles and may withdraw that permission at any time; withdrawal does not affect orders already sent. For such vehicles the shipper sees the registration number, the vehicle''s details and the carrier''s rating and, for contact, the driver''s name, telephone number and email address, but not the carrier''s company name or its other details. Likewise, the carrier does not see the shipper''s name: shippers are shown to it by a code, the number of jobs and the latest route. The loading and unloading place details needed to perform the transport are visible to the carrier and the driver.'
  end
  where document_id = v_terms and path = array[6, 7];

  update public.legal_clauses set body = case locale
    when 'fi' then 'Tilaaja ei näe kuljetusliikkeen nimeä eikä sen henkilöstön yhteystietoja, eikä kuljetusliike näe tilaajan nimeä, yhteystietoja eikä laskutustietoja; kuljetusliikkeelle tilaaja näkyy koodilla. Lastaus- ja purkupaikkojen tiedot näkyvät kuljetusliikkeelle ja kuljettajalle siltä osin kuin kuljetus sitä edellyttää. Kuljetusliike ei näe muiden kuljetusliikkeiden kalustoa eikä niiden sijaintia. Ajoneuvoista, jotka ovat ajaneet tilaajan keikkoja ja joiden kuljetusliike on sallinut suorat tilaukset, tilaaja näkee rekisteritunnuksen ja kuljetusliikkeen arvosanan sekä yhteydenpitoa varten kuljettajan nimen, puhelinnumeron ja sähköpostiosoitteen. [Kohta täydennetään juristin kanssa: kuljettajan yhteystietojen luovuttamisen peruste ja kuljettajalle annettava tieto.]'
    else 'A shipper does not see the carrier''s name or its personnel contact details, and a carrier does not see the shipper''s name, contact details or billing details; the shipper is shown to the carrier by a code. Loading and unloading place details are visible to the carrier and the driver to the extent the transport requires. A carrier does not see other carriers'' vehicles or their locations. For vehicles that have performed the shipper''s jobs and whose carrier has allowed direct orders, the shipper sees the registration number and the carrier''s rating and, for contact, the driver''s name, telephone number and email address. [This clause is to be completed with counsel: the basis for disclosing the driver''s contact details and the information given to the driver.]'
  end
  where document_id = v_privacy and path = array[10, 2];
end;
$$;
