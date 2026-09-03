-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · снятый рейс остаётся видимым перевозчику
--
-- Уведомление о снятии теперь приходит, но карточки в кабинете всё равно
-- не было: my_assignments отдавала только AWAIT_DRIVER и IN_PROGRESS.
-- Перевозчик получал строку в списке уведомлений — и пустое место там,
-- где привык смотреть свои рейсы.
--
-- Снятые возвращаются в выдачу и уходят в конец списка: они не требуют
-- действий, а сообщают о случившемся. Причина берётся из журнала заказа,
-- а не дублируется сюда: там она лежит вместе с автором и временем, и
-- второй экземпляр той же строки однажды разойдётся с первым.
--
-- Тридцать дней — чтобы список не превращался в кладбище. Дольше снятый
-- рейс нужен уже не в работе, а в разборе, и место ему в журнале.
--
-- Набор колонок не меняется, поэтому create or replace без drop.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.my_assignments()
returns table (
  id uuid,
  ref text,
  order_type public.order_type,
  haul_kind public.haul_kind,
  container_feet smallint,
  status public.order_status,
  deadline_at timestamptz,
  trailer text,
  trailer_plate text,
  distance_km integer,
  rate_cents integer,
  comment text,
  shipper_name text,
  vehicle_plate text,
  route_geometry text,
  route_bounds jsonb,
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
    raise exception 'Раздел доступен только перевозчику.' using errcode = '42501';
  end if;

  v_company_id := (select app.current_company_id());

  return query
  select
    o.id, o.ref, o.order_type, o.haul_kind, o.container_feet, o.status, o.deadline_at,
    o.trailer, o.trailer_plate, o.distance_km, o.rate_cents, o.comment,
    c.name, v.plate,
    o.route_geometry, o.route_bounds,
    (
      select jsonb_agg(to_jsonb(s) order by s.sequence)
      from public.order_stops s
      where s.order_id = o.id
    )
  from public.orders o
  join public.companies c on c.id = o.shipper_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where o.assigned_company_id = v_company_id
    /*
     * DONE ушёл: выполненный рейс живёт во вкладке выполненных.
     *
     * CANCELLED вернулся, и это не противоречие. Снятый рейс перестал
     * быть работой, но перевозчик, чей водитель едет к площадке, обязан
     * увидеть, что ехать больше некуда, — и прочитать почему. Уведомление
     * приходит один раз и теряется в списке; карточка стоит там, где он
     * привык смотреть свои рейсы.
     *
     * Тридцать дней — чтобы список не превращался в кладбище. Дольше
     * снятый рейс нужен уже не в работе, а в разборе, и место ему в
     * журнале заказа, который никуда не девается.
     */
    and (
      o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
      or (o.status = 'CANCELLED' and o.updated_at > now() - interval '30 days')
    )
  /* Снятые — в конец: они не требуют действий, а сообщают о случившемся. */
  order by (o.status = 'CANCELLED'), o.deadline_at nulls last, o.published_at desc;
end;
$$;

comment on function public.my_assignments() is
  'Рейсы перевозчика: идущие, ждущие подтверждения и снятые за последний месяц.';
