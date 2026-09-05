-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · страна точки, а не только город
--
-- Выход на порты Скандинавии открыл дыру, которой раньше не было видно.
--
-- Профиль грузовика выбирается по стране точки забора — так написано в
-- lib/routing/profiles.ts с самого начала. Но страну туда никто не
-- передавал: и при публикации, и при пересчёте после правки стояла
-- жёсткая строка 'FI'. Пока платформа работала по Финляндии, это было
-- незаметно и верно. Норвежский рейс так посчитался бы по финской
-- сцепке, а из всех параметров поставщик учитывает высоту — то есть
-- маршрут провёл бы машину под мостами по чужим нормам.
--
-- Страна приходит от геокодера вместе с координатами и городом, поэтому
-- живёт рядом с ними: у точки, набранной руками, её нет так же, как нет
-- координат, и это одно и то же состояние.
--
-- Существующим точкам страна не проставляется задним числом. Соблазн
-- «все финские, поставим FI» неверен: справочник площадок финский, но в
-- заказах есть адреса, найденные поставщиком, и утверждать за них
-- нельзя. Пустая страна означает «не знаем» и даёт профиль по умолчанию —
-- ровно то поведение, что было до этой миграции.
-- ═══════════════════════════════════════════════════════════════════

alter table public.order_stops
  add column country text,

  add constraint order_stops_country_shape
    check (country is null or country ~ '^[A-Z]{2}$');

comment on column public.order_stops.country is
  'Страна точки двумя буквами, от геокодера. По стране забора выбирается профиль грузовика.';


-- ── Публикация принимает страну ────────────────────────────────────

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
  v_has_work boolean := false;
  v_has_return boolean := false;
  v_geometry text;
  v_haul public.haul_kind;
  v_feet smallint;
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

  v_haul := coalesce(nullif(p_order->>'haul_kind', ''), 'TRAILER')::public.haul_kind;
  v_feet := nullif(p_order->>'container_feet', '')::smallint;

  /*
   * Размер спрашивается здесь, а не при публикации.
   *
   * Ограничение таблицы всё равно не пропустит контейнер без длины, но
   * скажет об этом кодом 23514 и текстом про имя ограничения. Проверка
   * до вставки даёт человеку фразу, по которой понятно, что заполнить.
   */
  if v_haul = 'CONTAINER' and v_feet is null then
    raise exception 'Укажите длину контейнера в футах.' using errcode = '22023';
  end if;

  /*
   * У полуприцепа длины нет по определению, и присланную форма могла
   * оставить от переключения типа. Обнуляем здесь, а не надеемся на
   * форму: ограничение таблицы иначе отвергнет заказ, который человек
   * заполнил правильно.
   */
  if v_haul = 'TRAILER' then
    v_feet := null;
  end if;

  insert into public.orders (
    shipper_company_id, shipper_ref, order_type, haul_kind, container_feet,
    trailer, trailer_plate,
    distance_km, rate_cents, comment, created_by, status,
    distance_source, distance_auto_km,
    route_geometry, route_bounds, route_fingerprint, route_computed_at
  )
  values (
    v_company.id,
    nullif(btrim(coalesce(p_order->>'shipper_ref', '')), ''),
    (p_order->>'order_type')::public.order_type,
    v_haul,
    v_feet,
    nullif(btrim(coalesce(p_order->>'trailer', '')), ''),
    nullif(upper(btrim(coalesce(p_order->>'trailer_plate', ''))), ''),
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
      address, city, country, contact_name, contact_phone,
      scheduled_date, scheduled_time, external_ref, trailer_loaded, note,
      cargo_weight_kg, consignee, seal_required,
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
      nullif(upper(btrim(coalesce(v_stop->>'country', ''))), ''),
      nullif(btrim(coalesce(v_stop->>'contact_name', '')), ''),
      nullif(regexp_replace(coalesce(v_stop->>'contact_phone', ''), '[\s-]', '', 'g'), ''),
      nullif(v_stop->>'scheduled_date', '')::date,
      nullif(v_stop->>'scheduled_time', '')::time,
      nullif(btrim(coalesce(v_stop->>'external_ref', '')), ''),
      case when v_stop ? 'trailer_loaded' then (v_stop->>'trailer_loaded')::boolean end,
      nullif(btrim(coalesce(v_stop->>'note', '')), ''),
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
      raise exception 'Маршрут неполон: нужна точка забора прицепа.' using errcode = '22023';
    end if;

    if not v_has_work then
      raise exception 'Добавьте хотя бы одно действие: выгрузку или загрузку.'
        using errcode = '22023';
    end if;

    if v_order.order_type = 'TRAILER_SWAP' and not v_has_return then
      raise exception 'Перецеп заканчивается отцепкой прицепа — укажите, где его оставить.'
        using errcode = '22023';
    end if;

    /*
     * Единицу ищут по номеру. Без него водитель приедет на площадку и не
     * поймёт, что цеплять: сотня прицепов выглядит одинаково, а описание
     * «Тент 13.6, 3 оси» подходит к половине из них. У контейнеров то же
     * самое и хуже: на терминале их тысячи, и различает их только номер
     * по ISO 6346.
     *
     * Фраза разная, потому что искать человек будет разные вещи. Одно
     * сообщение про «номер прицепа» на контейнерном заказе отправило бы
     * его искать прицеп, которого в рейсе нет.
     */
    if v_order.trailer_plate is null then
      if v_order.haul_kind = 'CONTAINER' then
        raise exception 'Укажите номер контейнера — по нему водитель находит его на терминале.'
          using errcode = '22023';
      else
        raise exception 'Укажите регистрационный номер прицепа — по нему водитель его находит.'
          using errcode = '22023';
      end if;
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
