-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 4 · стол заказов
--
-- Единственное место, через которое перевозчик видит чужие заказы.
-- Здесь же гейт из ТЗ §3.5: стол открыт только компании, у которой есть
-- хотя бы одна машина, способная выйти на рейс, — то есть допущенная
-- и с действующими документами компании.
-- ═══════════════════════════════════════════════════════════════════

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

  /*
   * Гейт. Пустой результат вместо ошибки: интерфейс объясняет причину
   * сам — нет допущенной машины или просрочены документы, — и падать
   * ради этого незачем.
   */
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
     * Маршрут без контактных полей. Имя и телефон получателя — данные
     * третьего лица, и до того как заказ закреплён за перевозчиком, они
     * ему не нужны. Здесь их просто нет в выборке, а не скрыты на клиенте.
     */
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
          'note', s.note
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
  where o.status = 'OPEN'
    and (p_region is null or pickup.city = p_region)
  order by o.published_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

comment on function public.desk_orders(text, integer) is
  'Стол заказов для перевозчика. Проверяет допуск и не отдаёт контакты получателей.';

/*
 * Регионы забора, по которым сейчас есть открытые заказы, — для фильтра.
 * Считаются на сервере, чтобы список не приходилось собирать из выдачи
 * с ограничением по количеству строк.
 */
create or replace function public.desk_regions()
returns table (city text, open_orders integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Стол заказов доступен только перевозчику.' using errcode = '42501';
  end if;

  if not app.has_dispatchable_vehicle((select app.current_company_id())) then
    return;
  end if;

  return query
  select s.city, count(*)::integer
  from public.orders o
  join public.order_stops s on s.order_id = o.id and s.role = 'PICKUP'
  where o.status = 'OPEN'
  group by s.city
  order by count(*) desc, s.city;
end;
$$;

revoke all on function public.desk_orders(text, integer) from public, anon;
revoke all on function public.desk_regions() from public, anon;

grant execute on function public.desk_orders(text, integer) to authenticated, service_role;
grant execute on function public.desk_regions() to authenticated, service_role;
