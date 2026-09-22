-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · заказчик видит контакты водителя знакомой машины
--
-- 22.09.2026 пользователь уточнил: выбирая и подтверждая постоянные
-- машины, заказчик видит номер машины, имя водителя, его телефон и
-- почту для связи — и не видит, чья это компания. Название и реквизиты
-- перевозчика по-прежнему скрыты (anonymity: контрагент заказчика —
-- Aivomaa Oy).
--
-- Раньше телефон водителя заказчику сознательно не показывался, а почты
-- у водителя не было вовсе. Теперь:
--   · у водителя есть почта (необязательно, вводит перевозчик);
--   · known_vehicles_for_shipper отдаёт телефон и почту текущего
--     водителя машины;
--   · черновики TERMS (6.7) и PRIVACY (2.2, 10.2) называют это. Основание
--     передачи контактов водителя заказчику — правовой выбор, под
--     маркером юриста. Активация — решение пользователя.
-- ═══════════════════════════════════════════════════════════════════

alter table public.drivers
  add column email text,
  add constraint drivers_email_format
    check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254);

comment on column public.drivers.email is
  'Почта водителя для связи. Видна перевозчику и заказчикам знакомой машины.';

grant insert (email) on public.drivers to authenticated;
grant update (email) on public.drivers to authenticated;


-- ── Знакомые машины: контакты водителя, без перевозчика ────────────

drop function if exists public.known_vehicles_for_shipper();

/*
 * Явный список колонок: здесь записано, что заказчик видит о знакомой
 * машине. Названия и идентификатора перевозчика нет. Телефон и почта —
 * текущего водителя машины (vehicle_drivers), а не того, кто возил
 * раньше.
 */
create or replace function public.known_vehicles_for_shipper()
returns table (
  vehicle_id uuid,
  plate text,
  driver_name text,
  driver_phone text,
  driver_email text,
  vehicle_class public.vehicle_class,
  make text,
  axles smallint,
  euro_class public.euro_class,
  payload_kg integer,
  ldm numeric,
  container_feet smallint[],
  rating numeric,
  trips integer,
  last_trip_at timestamptz,
  in_pool boolean,
  busy boolean,
  available boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select app.current_company_id() as id),
  history as (
    select o.assigned_vehicle_id as vehicle_id,
           count(*)::integer as trips,
           max(o.closed_at) as last_trip_at
    from public.orders o, me
    where o.shipper_company_id = me.id
      and o.status = 'DONE'
      and o.assigned_vehicle_id is not null
    group by o.assigned_vehicle_id
  )
  select
    v.id,
    v.plate,
    coalesce(d.full_name, v.driver_name),
    coalesce(d.phone, v.whatsapp),
    d.email,
    v.vehicle_class,
    v.make,
    v.axles,
    v.euro_class,
    v.payload_kg,
    v.ldm,
    v.container_feet,
    app.company_rating(v.company_id),
    h.trips,
    h.last_trip_at,
    exists (
      select 1 from public.shipper_vehicle_pool p, me
      where p.shipper_company_id = me.id and p.vehicle_id = v.id
    ),
    exists (
      select 1 from public.orders o
      where o.assigned_vehicle_id = v.id
        and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
    ),
    coalesce(app.vehicle_is_dispatchable(v.id), false)
  from history h
  join public.vehicles v on v.id = h.vehicle_id
  cross join me
  join public.carrier_shipper_links l
    on l.carrier_company_id = v.company_id
   and l.shipper_company_id = me.id
   and l.status = 'ACTIVE'
  left join public.drivers d on d.id = app.vehicle_driver_at(v.id, now())
  where (select app.current_party_role()) = 'SHIPPER'
  order by 16 desc, h.trips desc, v.plate;
$$;

revoke all on function public.known_vehicles_for_shipper() from public, anon;
grant execute on function public.known_vehicles_for_shipper() to authenticated;


-- ── Черновики документов ───────────────────────────────────────────

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
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
begin
  perform pg_temp.put(v_terms, array[6, 7],
    'Kuljetusliike päättää, mitkä tilaajat saavat lähettää suoria tilauksia sen ajoneuvoille, ja voi perua luvan milloin tahansa; peruminen ei vaikuta jo lähetettyihin tilauksiin. Tällaisista ajoneuvoista tilaaja näkee rekisteritunnuksen, ajoneuvon tiedot ja kuljetusliikkeen arvosanan sekä yhteydenpitoa varten kuljettajan nimen, puhelinnumeron ja sähköpostiosoitteen, mutta ei kuljetusliikkeen nimeä eikä sen muita tietoja.',
    'The carrier decides which shippers may send direct orders to its vehicles and may withdraw that permission at any time; withdrawal does not affect orders already sent. For such vehicles the shipper sees the registration number, the vehicle''s details and the carrier''s rating and, for contact, the driver''s name, telephone number and email address, but not the carrier''s company name or its other details.');

  perform pg_temp.put(v_privacy, array[2, 2],
    'Käyttäjätiedot: nimi, sähköpostiosoite, puhelinnumero, rooli ja yritys, jonka puolesta käyttäjä toimii. Kuljettajatiedot: nimi, puhelinnumero, sähköpostiosoite, käytettävät kielet, ajoneuvo, johon kuljettaja on liitetty, ja näiden liitosten historia sekä yhteys keikkaan. Puhelinnumero on kuljettajan tunnus palvelussa ja kuljettajasovelluksessa. Nämä tiedot syöttää kuljetusliike.',
    'User data: name, email address, telephone number, role and the company the user acts for. Driver data: name, telephone number, email address, languages used, the vehicle the driver is linked to and the history of those links, and the link to a job. The telephone number is the driver''s identifier in the service and in the driver app. This data is entered by the carrier.');

  perform pg_temp.put(v_privacy, array[10, 2],
    'Tilaaja ei näe kuljetusliikkeen henkilöstön yhteystietoja eikä kuljetusliike tilaajan laskutustietoja, ellei työ sitä edellytä. Kuljetusliike ei näe muiden kuljetusliikkeiden kalustoa eikä niiden sijaintia. Ajoneuvoista, jotka ovat ajaneet tilaajan keikkoja ja joiden kuljetusliike on sallinut suorat tilaukset, tilaaja näkee rekisteritunnuksen ja kuljetusliikkeen arvosanan sekä yhteydenpitoa varten kuljettajan nimen, puhelinnumeron ja sähköpostiosoitteen, mutta ei kuljetusliikkeen nimeä. [Kohta täydennetään juristin kanssa: kuljettajan yhteystietojen luovuttamisen peruste ja kuljettajalle annettava tieto.]',
    'A shipper does not see the carrier''s personnel contact details, and a carrier does not see the shipper''s billing details, unless the work requires it. A carrier does not see other carriers'' vehicles or their locations. For vehicles that have performed the shipper''s jobs and whose carrier has allowed direct orders, the shipper sees the registration number and the carrier''s rating and, for contact, the driver''s name, telephone number and email address, but not the carrier''s company name. [This clause is to be completed with counsel: the basis for disclosing the driver''s contact details and the information given to the driver.]');
end;
$$;
