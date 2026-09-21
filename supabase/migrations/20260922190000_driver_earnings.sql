-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · водитель видит свой заработок
--
-- 21.09.2026 решено: водитель после каждого рейса видит, сколько
-- заработал, и сумму за месяц нарастающим итогом. До этого деньги в
-- приложении не показывались вовсе — расчёт видел только перевозчик.
--
-- Функция отдаёт то же, из чего перевозчик собирает отчёт (смены с
-- перерывами, закрытые рейсы, ставки и правила TES), но только по
-- водителю текущей сессии. Считает приложение тем же калькулятором
-- lib/driverPay — поэтому у водителя и в отчёте перевозчика одно число.
--
-- Чего водитель не получает: выплату перевозчику за рейс. Модели «процент
-- от выплаты» нужна только его доля, и она считается здесь, по ставке,
-- действовавшей в день закрытия рейса. Сколько получила компания —
-- дело компании.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.driver_earnings(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select app.current_driver_id());
begin
  if v_driver is null then
    raise exception 'Заработок виден только водителю.' using errcode = '42501';
  end if;

  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'Период не больше двух месяцев.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    /* Смены с запасом в сутки: граница периода — местная дата начала смены. */
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'started_at', s.started_at,
        'ended_at', s.ended_at,
        'odometer_start', s.odometer_start,
        'odometer_end', s.odometer_end,
        'breaks', coalesce((
          select jsonb_agg(jsonb_build_object('started_at', b.started_at, 'ended_at', b.ended_at))
          from public.driver_breaks b
          where b.shift_id = s.id
        ), '[]'::jsonb)
      ) order by s.started_at)
      from public.driver_shifts s
      where s.driver_id = v_driver
        and s.started_at >= (p_from - 1)::timestamptz
        and s.started_at < (p_to + 2)::timestamptz
    ), '[]'::jsonb),

    'trips', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'ref', o.ref,
        'closed_at', o.closed_at,
        'distance_km', o.distance_km,
        'stops_done', (select count(*) from public.order_stops s
                        where s.order_id = o.id and s.completed_at is not null),
        'route_from', (select s.city from public.order_stops s
                        where s.order_id = o.id order by s.sequence limit 1),
        'route_to', (select e.city from app.route_end(o.id) e),
        'share_cents', coalesce((
          select round(app.payout_cents(o.rate_cents, coalesce(o.commission_bps, 0)) * p.trip_bps / 10000.0)::integer
          from public.driver_pay_profiles p
          where p.driver_id = v_driver
            and p.valid_from <= (o.closed_at at time zone 'Europe/Helsinki')::date
          order by p.valid_from desc
          limit 1
        ), 0)
      ) order by o.closed_at)
      from public.orders o
      where o.assigned_driver_id = v_driver
        and o.status = 'DONE'
        and (o.closed_at at time zone 'Europe/Helsinki')::date between p_from and p_to
    ), '[]'::jsonb),

    /* Ставки без процента: доля уже посчитана в share_cents. */
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'valid_from', p.valid_from,
        'model', p.model,
        'per_km_cents', p.per_km_cents,
        'hourly_cents', p.hourly_cents,
        'tes', case when r.id is null then null else to_jsonb(r) - 'company_id' - 'created_by' end
      ) order by p.valid_from)
      from public.driver_pay_profiles p
      left join public.tes_rule_sets r on r.id = p.tes_rule_set_id
      where p.driver_id = v_driver
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.driver_earnings(date, date) is
  'Смены, закрытые рейсы с долей водителя и ставки — для экрана заработка в приложении водителя.';

revoke all on function public.driver_earnings(date, date) from public, anon;
grant execute on function public.driver_earnings(date, date) to authenticated;
