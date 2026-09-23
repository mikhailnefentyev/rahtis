-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · в недельной сводке появилась плата заказчика
--
-- Выручка оператора складывается из двух частей: 3 % с перевозчика по
-- подряду и 3 % с заказчика за заказ со стола. Недельная сводка знала
-- только первую, и показать оператору, сколько заработано за неделю,
-- было нечем — на странице расчётов динамики нет вовсе.
--
-- Перевозчику плата заказчика не отдаётся: это чужие деньги, к его
-- выплате отношения не имеющие. Заказчик видит свою.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.weekly_totals(integer);

create or replace function public.weekly_totals(p_weeks integer default 8)
returns table (
  week date,
  orders_count integer,
  distance_km bigint,
  rate_cents bigint,
  commission_cents bigint,
  payout_cents bigint,
  shipper_fee_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.party_role;
  v_company uuid;
begin
  v_role := (select app.current_party_role());
  v_company := (select app.current_company_id());

  return query
  select
    app.report_week(app.closed_moment(o)) as w,
    count(*)::integer,
    sum(coalesce(o.distance_km, 0))::bigint,
    sum(coalesce(o.rate_cents, 0))::bigint,
    case when v_role <> 'SHIPPER'
      then sum(app.commission_cents(o.rate_cents, app.order_bps(o)))::bigint end,
    case when v_role <> 'SHIPPER'
      then sum(app.payout_cents(o.rate_cents, app.order_bps(o)))::bigint end,
    case when v_role <> 'CARRIER'
      then sum(app.shipper_fee_cents(o.rate_cents, o.shipper_fee_bps))::bigint end
  from public.orders o
  where o.status = 'DONE'
    and (
      (v_role = 'SHIPPER' and o.shipper_company_id = v_company)
      or (v_role = 'CARRIER' and o.assigned_company_id = v_company)
      or v_role = 'ADMIN'
    )
  group by w
  order by w desc
  limit greatest(1, least(coalesce(p_weeks, 8), 104));
end;
$$;

revoke all on function public.weekly_totals(integer) from public, anon;
grant execute on function public.weekly_totals(integer) to authenticated;
