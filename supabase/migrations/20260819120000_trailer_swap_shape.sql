-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · форма перецепа
--
-- Перецеп устроен так: забрали прицеп где-то, съездили на выгрузку или
-- загрузку, отвезли в порт, на парковку или терминал и отцепили.
--
-- Схема этого не отражала и в двух местах расходилась с делом.
--
-- Первое: публикация требовала выгрузку. Рейс «забрали пустой прицеп на
-- терминале → загрузились → отвезли в порт» выгрузки не содержит вовсе,
-- и опубликовать его было нельзя. Работа посередине — это выгрузка ИЛИ
-- загрузка, а не обязательно выгрузка.
--
-- Второе: отцепка прицепа считалась необязательным довеском, который
-- добавляют кнопкой. Для перецепа она не довесок, а окончание рейса: без
-- неё непонятно, где машина расстаётся с железом, и рейс нечем закрыть.
--
-- Для кругорейса и груза в один конец правила прежние: там прицеп свой и
-- отцеплять его негде.
-- ═══════════════════════════════════════════════════════════════════

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
  v_role text;
  v_seq smallint := 0;
  v_has_pickup boolean := false;
  /* Любая работа с грузом: выгрузка, загрузка, доп.точка того и другого. */
  v_has_work boolean := false;
  v_has_return boolean := false;
  v_geometry text;
begin
  select * into v_company
  from public.companies
  where id = (select app.current_company_id());

  if v_company.id is null or v_company.kind <> 'SHIPPER' then
    raise exception 'Публиковать заказы может только заказчик.' using errcode = '42501';
  end if;

  if v_company.status <> 'ACTIVE' then
    raise exception 'Заполните реквизиты компании — без них заказ не опубликовать.'
      using errcode = '55000';
  end if;

  v_geometry := nullif(btrim(coalesce(p_order->>'route_geometry', '')), '');

  insert into public.orders (
    shipper_company_id, shipper_ref, order_type, trailer,
    distance_km, rate_cents, comment, created_by, status,
    distance_source, distance_auto_km,
    route_geometry, route_bounds, route_fingerprint, route_computed_at
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
    'DRAFT',
    coalesce(nullif(p_order->>'distance_source', ''), 'MANUAL')::public.distance_source,
    nullif(p_order->>'distance_auto_km', '')::integer,
    v_geometry,
    case when p_order ? 'route_bounds' then p_order->'route_bounds' end,
    nullif(btrim(coalesce(p_order->>'route_fingerprint', '')), ''),
    case when v_geometry is not null then now() end
  )
  returning * into v_order;

  for v_stop in select * from jsonb_array_elements(p_stops) loop
    insert into public.order_stops (
      order_id, sequence, role, place_kind, place_name, company_name,
      address, city, contact_name, contact_phone,
      scheduled_date, scheduled_time, external_ref, returns_loaded, note,
      booking_ref, cargo_weight_kg, consignee, seal_required,
      lat, lon, geocode_score, leg_distance_m, leg_duration_s
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
      case when v_stop ? 'seal_required' then (v_stop->>'seal_required')::boolean end,
      nullif(v_stop->>'lat', '')::double precision,
      nullif(v_stop->>'lon', '')::double precision,
      nullif(v_stop->>'geocode_score', '')::numeric,
      nullif(v_stop->>'leg_distance_m', '')::integer,
      nullif(v_stop->>'leg_duration_s', '')::integer
    );

    v_role := v_stop->>'role';

    if v_role = 'PICKUP' then v_has_pickup := true; end if;
    if v_role = 'TRAILER_RETURN' then v_has_return := true; end if;
    if v_role in ('DELIVERY', 'EXTRA_LOAD', 'EXTRA_UNLOAD', 'CONTINUATION') then
      v_has_work := true;
    end if;

    v_seq := v_seq + 1;
  end loop;

  if p_publish then
    if not v_has_pickup then
      raise exception 'Маршрут неполон: нужна точка забора.' using errcode = '22023';
    end if;

    /*
     * Работа посередине — выгрузка или загрузка. Требовать именно
     * выгрузку значило бы запретить рейс «забрали пустой прицеп →
     * загрузились → отвезли в порт», который ничем не реже обратного.
     */
    if not v_has_work then
      raise exception 'Маршрут неполон: нужна выгрузка или загрузка.' using errcode = '22023';
    end if;

    /*
     * Перецеп заканчивается отцепкой. Без неё неизвестно, где машина
     * расстаётся с прицепом, и рейс нечем закрыть. У кругорейса и груза
     * в один конец прицеп свой — там отцепка не требуется.
     */
    if v_order.order_type = 'TRAILER_SWAP' and not v_has_return then
      raise exception 'Перецеп заканчивается отцепкой прицепа — укажите, где его оставить.'
        using errcode = '22023';
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
