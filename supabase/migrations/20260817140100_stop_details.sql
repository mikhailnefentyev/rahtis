-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 4+ · грузовые поля точек маршрута
--
-- Реальные рейсы устроены так:
--
--   порт (забор гружёного прицепа) → выгрузка → загрузка → возврат в порт
--   терминал (забор пустого)       → загрузка → выгрузка → возврат на паркинг
--
-- Разбирается это на уже существующие роли без ломки модели: PICKUP —
-- «забрать прицеп», а собственно загрузка груза — это EXTRA_LOAD. Поэтому
-- здесь только колонки и ограничения, структура маршрута не меняется.
--
-- Какое поле к какой роли применимо (● обязательно, ○ можно, — запрещено):
--
--   поле             PICKUP  EXTRA_LOAD  EXTRA_UNLOAD  DELIVERY  CONT  RETURN
--   note                ○         ○           ○           ○       ○      ○
--   booking_ref         ○*        ○*          ○*          —       —      ○*
--   cargo_weight_kg     ○         ○           —           —       ○      —
--   consignee           —         ○           —           —       ○      —
--   seal_required       ○         ○           —           —       ○      —
--   place_kind          ●         ○           ○           ○       ○      ●
--
--   * только когда place_kind = PORT или TERMINAL
--
-- Вес и пломба разрешены и у PICKUP: в первом сценарии прицеп забирают
-- из порта уже гружёным, точки загрузки в маршруте нет — она была за
-- морем. Получателя у PICKUP при этом нет: его называют там, где груз
-- принимают на борт.
-- ═══════════════════════════════════════════════════════════════════

alter table public.order_stops
  /*
   * Номер брони, по которому в порту или на терминале выдают и принимают
   * прицеп. Без него на воротах не отдадут железо.
   *
   * Это не external_ref. Бронь предъявляют на проходной и она про место;
   * external_ref — номер заказа в чужой системе и он про груз. У точки
   * «продолжение рейса в порту» нужны оба сразу, поэтому колонки разные.
   *
   * Привязка — к типу места, а не к списку портов: иначе Vuosaari и Turku
   * пришлось бы дописывать в код вслед за Kotka, Rauma и Hanko.
   */
  add column booking_ref text,

  /*
   * Вес груза в килограммах, целым числом. В форме — тонны с дробью.
   *
   * Килограммы, а не тонны с плавающей точкой, по той же причине, по
   * которой деньги хранятся центами: это число попадает в накладную и
   * в расчёт нагрузки на ось, и накопленная ошибка округления здесь
   * стоит дороже удобства.
   *
   * Верхняя граница финская: 76 тонн для сцепок HCT. По ЕС предел 40,
   * но заказ, оформленный в Финляндии, вправе быть финским.
   */
  add column cargo_weight_kg integer,

  /*
   * Получатель груза с точки загрузки. Не company_name: на загрузке
   * company_name — кто отдаёт груз, consignee — кому он в итоге едет.
   * На выгрузке получатель и есть company_name, поэтому там колонки нет.
   */
  add column consignee text,

  add column seal_required boolean;

comment on column public.order_stops.booking_ref is
  'Номер брони в порту или на терминале. Предъявляется на воротах.';
comment on column public.order_stops.cargo_weight_kg is
  'Вес груза, кг. Целое: число идёт в накладную и в расчёт нагрузки на ось.';
comment on column public.order_stops.consignee is
  'Получатель груза, названный на точке загрузки. Третье лицо — на столе не показывается.';


-- ── Возврат прицепа получает тип места ─────────────────────────────

/*
 * place_kind становится обязательным у TRAILER_RETURN: именно он решает,
 * нужна ли бронь. Возврат в порт её требует, возврат на паркинг — нет,
 * и без типа места это правило не выразить.
 *
 * Существующие строки заполняются значением ADDRESS. Это не догадка о
 * том, чем место было на самом деле: до сих пор возврат вводился просто
 * названием места и адресом, без различения типа, и «просто адрес» —
 * ровно то, чем эти строки являются.
 */
update public.order_stops
set place_kind = 'ADDRESS'
where role = 'TRAILER_RETURN' and place_kind is null;


-- ── Ограничения по матрице ─────────────────────────────────────────

alter table public.order_stops
  add constraint order_stops_return_has_place_kind
    check (role <> 'TRAILER_RETURN' or place_kind is not null),

  /* Бронь бывает только там, где есть ворота и оператор терминала. */
  add constraint order_stops_booking_ref_needs_gate
    check (booking_ref is null or place_kind in ('PORT', 'TERMINAL')),

  add constraint order_stops_booking_ref_length
    check (booking_ref is null or length(btrim(booking_ref)) between 2 and 64),

  /* Вес и пломба — свойства груза, значит только там, где груз берут. */
  add constraint order_stops_cargo_only_on_load
    check (
      role in ('PICKUP', 'EXTRA_LOAD', 'CONTINUATION')
      or (cargo_weight_kg is null and seal_required is null)
    ),

  /* Получателя называют на загрузке; на выгрузке это company_name. */
  add constraint order_stops_consignee_only_on_load
    check (
      role in ('EXTRA_LOAD', 'CONTINUATION')
      or consignee is null
    ),

  add constraint order_stops_weight_range
    check (cargo_weight_kg is null or cargo_weight_kg between 1 and 76000),

  add constraint order_stops_consignee_length
    check (consignee is null or length(btrim(consignee)) between 2 and 200);


-- ── Запись новых полей при публикации ──────────────────────────────

create or replace function public.create_order(
  p_order jsonb,
  p_stops jsonb,
  p_publish boolean default true
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_company public.companies;
  v_stop jsonb;
  v_seq smallint := 0;
  v_has_pickup boolean := false;
  v_has_delivery boolean := false;
begin
  select * into v_company
  from public.companies
  where id = (select app.current_company_id());

  if v_company.id is null or v_company.kind <> 'SHIPPER' then
    raise exception 'Публиковать заказы может только заказчик.' using errcode = '42501';
  end if;

  /*
   * Заказ можно публиковать только активной компании: пока не заполнены
   * реквизиты, платформе некому выставить счёт за этот рейс.
   */
  if v_company.status <> 'ACTIVE' then
    raise exception 'Заполните реквизиты компании — без них заказ не опубликовать.'
      using errcode = '55000';
  end if;

  insert into public.orders (
    shipper_company_id, shipper_ref, order_type, trailer,
    distance_km, rate_cents, comment, created_by, status
  )
  values (
    v_company.id,
    nullif(btrim(coalesce(p_order->>'shipper_ref', '')), ''),
    (p_order->>'order_type')::public.order_type,
    nullif(btrim(coalesce(p_order->>'trailer', '')), ''),
    nullif(p_order->>'distance_km', '')::integer,
    nullif(p_order->>'rate_cents', '')::integer,
    nullif(btrim(coalesce(p_order->>'comment', '')), ''),
    (select auth.uid()),
    'DRAFT'
  )
  returning * into v_order;

  for v_stop in select * from jsonb_array_elements(p_stops) loop
    insert into public.order_stops (
      order_id, sequence, role, place_kind, place_name, company_name,
      address, city, contact_name, contact_phone,
      scheduled_date, scheduled_time, external_ref, returns_loaded, note,
      booking_ref, cargo_weight_kg, consignee, seal_required
    )
    values (
      v_order.id,
      v_seq,
      (v_stop->>'role')::public.stop_role,
      nullif(v_stop->>'place_kind', '')::public.place_kind,
      nullif(btrim(coalesce(v_stop->>'place_name', '')), ''),
      nullif(btrim(coalesce(v_stop->>'company_name', '')), ''),
      btrim(coalesce(v_stop->>'address', '')),
      btrim(coalesce(v_stop->>'city', '')),
      nullif(btrim(coalesce(v_stop->>'contact_name', '')), ''),
      nullif(regexp_replace(coalesce(v_stop->>'contact_phone', ''), '[\s-]', '', 'g'), ''),
      nullif(v_stop->>'scheduled_date', '')::date,
      nullif(v_stop->>'scheduled_time', '')::time,
      nullif(btrim(coalesce(v_stop->>'external_ref', '')), ''),
      case when v_stop ? 'returns_loaded' then (v_stop->>'returns_loaded')::boolean end,
      nullif(btrim(coalesce(v_stop->>'note', '')), ''),
      nullif(btrim(coalesce(v_stop->>'booking_ref', '')), ''),
      nullif(v_stop->>'cargo_weight_kg', '')::integer,
      nullif(btrim(coalesce(v_stop->>'consignee', '')), ''),
      case when v_stop ? 'seal_required' then (v_stop->>'seal_required')::boolean end
    );

    if (v_stop->>'role') = 'PICKUP' then v_has_pickup := true; end if;
    if (v_stop->>'role') = 'DELIVERY' then v_has_delivery := true; end if;

    v_seq := v_seq + 1;
  end loop;

  if p_publish then
    if not (v_has_pickup and v_has_delivery) then
      raise exception 'Маршрут неполон: нужны забор и выгрузка.' using errcode = '22023';
    end if;

    if v_order.distance_km is null or v_order.rate_cents is null then
      raise exception 'Укажите пробег и ставку.' using errcode = '22023';
    end if;

    update public.orders
    set status = 'OPEN', published_at = now()
    where id = v_order.id
    returning * into v_order;
  end if;

  return v_order;
end;
$$;

comment on function public.create_order(jsonb, jsonb, boolean) is
  'Создаёт заказ вместе с маршрутом одной транзакцией и, по умолчанию, публикует.';


-- ── Стол: новые поля, кроме получателя ─────────────────────────────

/*
 * Получатель груза на стол не выходит.
 *
 * Это персональные данные третьего лица ровно того же рода, что контакт
 * на выгрузке, и скрываются они по той же причине: до того как заказ взят,
 * перевозчику незачем знать, кому едет груз. После взятия получатель виден
 * через my_assignments, который отдаёт строку точки целиком.
 */
create or replace function public.desk_orders(
  p_region text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  ref text,
  order_type public.order_type,
  trailer text,
  distance_km integer,
  rate_cents integer,
  comment text,
  shipper_name text,
  published_at timestamptz,
  pickup_city text,
  pickup_date date,
  pickup_time time,
  delivery_city text,
  offers_count integer,
  taken_by_me boolean,
  stops jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Стол заказов доступен только перевозчику.' using errcode = '42501';
  end if;

  v_company_id := (select app.current_company_id());

  if not app.has_dispatchable_vehicle(v_company_id) then
    return;
  end if;

  return query
  select
    o.id,
    o.ref,
    o.order_type,
    o.trailer,
    o.distance_km,
    o.rate_cents,
    o.comment,
    c.name,
    o.published_at,
    pickup.city,
    pickup.scheduled_date,
    pickup.scheduled_time,
    delivery.city,
    /*
     * У заказа с истёкшей бронью отклики ещё лежат в таблице, но силы уже
     * не имеют: их сотрёт первое же действие или уборка планировщика.
     * Показывать их числом было бы обманом — место свободно.
     */
    case
      when app.order_deadline_passed(o.status, o.deadline_at) then 0
      else (select count(*)::integer from public.order_offers f where f.order_id = o.id)
    end,
    case
      when app.order_deadline_passed(o.status, o.deadline_at) then false
      else exists (
        select 1 from public.order_offers f
        where f.order_id = o.id and f.carrier_company_id = v_company_id
      )
    end,
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'sequence', s.sequence,
          'role', s.role,
          'place_kind', s.place_kind,
          'place_name', s.place_name,
          'company_name', s.company_name,
          'address', s.address,
          'city', s.city,
          'scheduled_date', s.scheduled_date,
          'scheduled_time', s.scheduled_time,
          'external_ref', s.external_ref,
          'returns_loaded', s.returns_loaded,
          'note', s.note,
          /*
           * Бронь, вес и пломба — то, по чему перевозчик решает, берётся
           * ли он вообще: пройдёт ли машина по массе и успеет ли к окну
           * на терминале. Персональных данных здесь нет.
           */
          'booking_ref', s.booking_ref,
          'cargo_weight_kg', s.cargo_weight_kg,
          'seal_required', s.seal_required
        )
        order by s.sequence
      )
      from public.order_stops s
      where s.order_id = o.id
    )
  from public.orders o
  join public.companies c on c.id = o.shipper_company_id
  join public.order_stops pickup
    on pickup.order_id = o.id and pickup.role = 'PICKUP'
  left join public.order_stops delivery
    on delivery.order_id = o.id and delivery.role = 'DELIVERY'
  where (
      o.status = 'OPEN'
      or app.order_deadline_passed(o.status, o.deadline_at)
      or (
        o.status = 'REQUESTED'
        and exists (
          select 1 from public.order_offers f
          where f.order_id = o.id and f.carrier_company_id = v_company_id
        )
      )
    )
    and (p_region is null or pickup.city = p_region)
  order by o.published_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

comment on function public.desk_orders(text, integer) is
  'Стол заказов. Просроченная бронь считается снятой, контакты и получатель не отдаются.';
