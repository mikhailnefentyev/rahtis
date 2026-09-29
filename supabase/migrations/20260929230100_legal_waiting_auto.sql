-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: доплата за простой считается автоматически
--
-- Под поведение 20260929230000_waiting_surcharge (решение пользователя
-- 29.09.2026): у каждой точки свой бесплатный час; превышение меньше 15
-- минут не начисляется; от 15 минут — 45 € за начатый час; расчёт — по
-- отметкам приложения, в счёте — точка, начало, конец, часы. Прежний
-- пример «1 ч 15 + 1 ч 10 = 90 €» по новому правилу даёт 45 €.
-- Договор заказчика 5.1–5.3, 5.6; договор перевозчика 9.2–9.4.
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
  v_shipper uuid := pg_temp.draft_of('SHIPPER_AGREEMENT');
  v_carrier uuid := pg_temp.draft_of('CARRIER_AGREEMENT');
begin
  perform pg_temp.put(v_shipper, array[5, 1],
    'Hintaan sisältyy jokaisessa lastaus- ja purkupaikassa 1 tunti. Paikan käyttämätöntä aikaa ei siirretä toiseen paikkaan.',
    'The price includes 1 hour at each loading place and at each unloading place. Unused time at one place is not carried over to another.');
  perform pg_temp.put(v_shipper, array[5, 2],
    'Odotusaika lasketaan palvelussa automaattisesti kuljettajan sovellukseen kirjaamista saapumis- ja valmistumisajoista (kohta 5.4). Jos paikan maksuton tunti ylittyy vähintään 15 minuutilla, veloitetaan 45 euroa ilman arvonlisäveroa jokaiselta alkavalta ylitystunnilta; alle 15 minuutin ylitystä ei veloiteta. Sovellettava arvonlisävero lisätään.',
    'Waiting time is calculated automatically in the service from the arrival and completion times the driver records in the application (clause 5.4). Where the free hour at a place is exceeded by at least 15 minutes, EUR 45 excluding value added tax is charged for each hour of excess begun; an excess of less than 15 minutes is not charged. Applicable value added tax is added.');
  perform pg_temp.put(v_shipper, array[5, 3],
    'Esimerkkejä: lastaus 1 tunti 10 minuuttia - ei lisää; lastaus 1 tunti 15 minuuttia - 45 euroa; lastaus 2 tuntia 15 minuuttia - 90 euroa; lastaus 1 tunti 15 minuuttia ja purku 1 tunti 10 minuuttia - yhteensä 45 euroa ilman arvonlisäveroa.',
    'Examples: loading 1 hour 10 minutes - no surcharge; loading 1 hour 15 minutes - 45 euros; loading 2 hours 15 minutes - 90 euros; loading 1 hour 15 minutes and unloading 1 hour 10 minutes - 45 euros excluding value added tax in total.');
  perform pg_temp.put(v_shipper, array[5, 6],
    'Odotusaika laskutetaan kauden laskulla siten, että siitä käyvät ilmi paikka, toimenpide, laskennan alku ja loppu, kesto ja maksettavat alkavat tunnit. Tilaaja voi riitauttaa yksittäisen lisän reklamaatiolla; riidattoman osan maksua ei viivytetä yksittäisestä lisästä käytävän erimielisyyden vuoksi.',
    'Waiting time is invoiced on the period invoice so that the invoice shows the place, the operation, the start and end of the calculation, the duration and the number of hours begun that are charged. The shipper may dispute an individual surcharge by a claim; payment of the undisputed part is not delayed because of a disagreement over a single surcharge.');

  perform pg_temp.put(v_carrier, array[9, 2],
    'Kuljetuksen hintaan sisältyy jokaisessa lastaus- ja purkupaikassa 1 tunti. Paikan käyttämätöntä aikaa ei siirretä toiseen. Jos paikan maksuton tunti ylittyy vähintään 15 minuutilla, kuljetusliikkeelle maksetaan 45 euroa ilman arvonlisäveroa jokaiselta alkavalta ylitystunnilta; alle 15 minuutin ylitystä ei korvata. Lisä lasketaan palvelussa automaattisesti ja maksetaan tilityksessä kokonaisuudessaan ilman palvelumaksua.',
    'The freight price includes 1 hour at each loading place and at each unloading place. Unused time at one place is not carried over to another. Where the free hour at a place is exceeded by at least 15 minutes, the carrier is paid 45 euros excluding value added tax for each hour of excess begun; an excess of less than 15 minutes is not compensated. The surcharge is calculated automatically in the service and paid in full in the settlement without a service fee.');
  perform pg_temp.put(v_carrier, array[9, 3],
    'Esimerkiksi: lastaus 1 h 10 min - ei lisää; lastaus 1 h 15 min - 45 euroa; lastaus 2 h 15 min - 90 euroa; lastaus 1 h 15 min ja purku 1 h 10 min - yhteensä 45 euroa.',
    'For example: loading 1 h 10 min - no surcharge; loading 1 h 15 min - 45 euros; loading 2 h 15 min - 90 euros; loading 1 h 15 min and unloading 1 h 10 min - 45 euros in total.');
  perform pg_temp.put(v_carrier, array[9, 4],
    'Aika lasketaan siitä, kun kyseiseen työvaiheeseen valmis ajoneuvo on saapunut paikalle, kuitenkin aikaisintaan sovitusta saapumisajasta, siihen asti, kun työvaihe on tosiasiallisesti valmis. Kuljetusliikkeen, kuljettajan tai kaluston vastuulla olevasta syystä aiheutunutta viivettä ei lasketa maksulliseksi odotusajaksi; tällöin Aivomaa Oy voi oikaista automaattisesti lasketun lisän.',
    'Time is counted from the arrival of a vehicle ready for the operation concerned, but no earlier than the agreed arrival time, until the operation is actually completed. Delay caused by reasons for which the carrier, the driver or the equipment is responsible is not counted as chargeable waiting time; in that case Aivomaa Oy may correct the automatically calculated surcharge.');

  raise notice 'Черновики: SHIPPER_AGREEMENT v%, CARRIER_AGREEMENT v%',
    (select version from public.legal_documents where id = v_shipper),
    (select version from public.legal_documents where id = v_carrier);
end;
$$;
