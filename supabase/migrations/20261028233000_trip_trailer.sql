-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · прицеп рейса (28.10.2026, этап B конструктора)
--
-- orders.assigned_trailer_id — прицеп или полуприцеп перевозчика, с
-- которым идёт рейс (не единица заказчика: та — trailer_plate).
--   · при выборе отклика сцепкой — прицеп из отклика (choose_offer);
--   · в своих рейсах и прямых заказах, а также при замене — перевозчик
--     сам в карточке рейса (carrier_set_trip_trailer): прицеп свой,
--     цепляется к машине рейса и подходит под кузов и загрузку заказа;
--   · сменилась машина рейса или её сняли — прицеп снимается сам.
-- Водитель видит прицеп рейса (driver_trip_trailers).
-- ═══════════════════════════════════════════════════════════════════

alter table public.orders
  add column assigned_trailer_id uuid references public.trailers (id) on delete set null;

/* Машина рейса сменилась или снята, а прицеп не назначен заново — прицеп снимается. */
create or replace function app.trip_trailer_follows_vehicle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assigned_vehicle_id is distinct from old.assigned_vehicle_id
     and new.assigned_trailer_id is not distinct from old.assigned_trailer_id then
    new.assigned_trailer_id := null;
  end if;
  return new;
end;
$$;

revoke all on function app.trip_trailer_follows_vehicle() from public, anon, authenticated;

create trigger orders_trip_trailer_follows_vehicle
  before update of assigned_vehicle_id, assigned_trailer_id on public.orders
  for each row execute function app.trip_trailer_follows_vehicle();

/* Выбор отклика: прицеп сцепки из отклика становится прицепом рейса. */
do $$
declare
  v_def text := replace(pg_get_functiondef('public.choose_offer(uuid)'::regprocedure), E'\r\n', E'\n');
  v_new text;
begin
  v_new := replace(v_def,
    E'      assigned_vehicle_id = v_offer.vehicle_id,\n',
    E'      assigned_vehicle_id = v_offer.vehicle_id,\n      assigned_trailer_id = v_offer.trailer_id,\n');
  if v_new = v_def then
    raise exception 'choose_offer: место правки не найдено';
  end if;
  execute v_new;
end;
$$;

/*
 * Перевозчик ставит или меняет прицеп своего рейса. null — без прицепа.
 * Прицеп свой, цепляется к машине рейса (полуприцеп — к тягачу, прицеп —
 * к грузовику или нуппи) и подходит под кузов и загрузку заказа.
 */
create or replace function public.carrier_set_trip_trailer(p_order_id uuid, p_trailer_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_vehicle public.vehicles;
  v_trailer public.trailers;
  v_company uuid := (select app.current_company_id());
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.assigned_company_id is distinct from v_company then
    raise exception 'Рейс не найден.' using errcode = '42501';
  end if;
  if v_order.status not in ('AWAIT_DRIVER', 'IN_PROGRESS') then
    raise exception 'Прицеп меняется только у назначенного рейса.' using errcode = '55000';
  end if;

  if p_trailer_id is not null then
    select * into v_vehicle from public.vehicles where id = v_order.assigned_vehicle_id;
    select * into v_trailer from public.trailers where id = p_trailer_id and company_id = v_company;
    if v_trailer.id is null then
      raise exception 'Прицеп не найден.' using errcode = '42501';
    end if;
    if (v_trailer.kind = 'SEMI' and v_vehicle.vehicle_class <> 'TRACTOR')
       or (v_trailer.kind <> 'SEMI' and v_vehicle.vehicle_class not in ('TRUCK', 'TIPPER')) then
      raise exception 'Этот прицеп к машине рейса не цепляется.' using errcode = '22023';
    end if;
    if v_order.required_body is not null
       and v_trailer.body_type::text is distinct from v_order.required_body
       and v_vehicle.body_type::text is distinct from v_order.required_body then
      raise exception 'Нужен другой кузов.' using errcode = '55003';
    end if;
    if not ((coalesce(v_vehicle.loading, '{}') || coalesce(v_trailer.loading, '{}')) @> coalesce(v_order.required_loading, '{}')) then
      raise exception 'Нет нужного способа загрузки.' using errcode = '55003';
    end if;
  end if;

  update public.orders set assigned_trailer_id = p_trailer_id where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.carrier_set_trip_trailer(uuid, uuid) from public, anon;
grant execute on function public.carrier_set_trip_trailer(uuid, uuid) to authenticated;

/* Прицеп рейса для водителя: только его рейсы. */
create or replace function public.driver_trip_trailers()
returns table (order_id uuid, plate text, kind public.trailer_kind, body_type public.body_type)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, t.plate, t.kind, t.body_type
  from public.orders o
  join public.trailers t on t.id = o.assigned_trailer_id
  where o.assigned_driver_id = (select app.current_driver_id())
    and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS', 'DONE');
$$;

revoke all on function public.driver_trip_trailers() from public, anon;
grant execute on function public.driver_trip_trailers() to authenticated;
