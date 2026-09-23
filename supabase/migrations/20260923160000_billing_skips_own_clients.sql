-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · расчёты не трогают рейсы своего клиента
--
-- У подписчика прямой рейс идёт по его собственному договору: счёт
-- заказчику выставляет он, деньги идут мимо нас. В сводке оператора
-- такие рейсы стояли рядом со всеми прочими — с платой заказчика,
-- комиссией и выплатой, — то есть выглядели деньгами, которых у нас
-- нет. Отсюда один шаг до счёта, который не должен был выставляться.
--
-- Теперь денежные выборки берут только рейсы, где сторона договора мы.
-- Работа никуда не девается: рейс виден в заказах, в отчёте за период и
-- в недельном отчёте перевозчика отдельной строкой «laskutat itse».
--
-- Денежные выборки этих рейсов не показывают вовсе: страница расчётов
-- отвечает на вопрос «кому платить и кто заплатил», и строка, к которой
-- этот вопрос неприменим, там только мешает.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.billing_overview()
returns table (
  id uuid,
  ref text,
  shipper_ref text,
  closed_at timestamptz,
  period_start date,
  period_end date,
  invoice_due date,
  payout_due date,
  billing public.billing_status,
  invoice_ref text,
  invoiced_at timestamptz,
  paid_at timestamptz,
  settled_at timestamptz,
  rate_cents integer,
  shipper_fee_cents integer,
  commission_cents integer,
  payout_cents integer,
  route_from text,
  route_to text,
  shipper_id uuid,
  shipper_name text,
  shipper_business_id text,
  shipper_country text,
  shipper_billing_email text,
  carrier_id uuid,
  carrier_name text,
  carrier_business_id text,
  carrier_country text,
  carrier_iban text,
  carrier_bic text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Расчёты видны только оператору.' using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.ref,
    o.shipper_ref,
    o.closed_at,
    p.st,
    app.payout_period_end(p.st),
    app.invoice_due(p.st),
    app.payout_due(app.closed_moment(o)),
    o.billing,
    o.invoice_ref,
    o.invoiced_at,
    o.paid_at,
    o.settled_at,
    o.rate_cents,
    app.shipper_fee_cents(o.rate_cents, o.shipper_fee_bps),
    app.commission_cents(o.rate_cents, app.order_bps(o)),
    app.payout_cents(o.rate_cents, app.order_bps(o)),
    (select s.city from public.order_stops s where s.order_id = o.id order by s.sequence limit 1),
    (select e.city from app.route_end(o.id) e),
    sh.id,
    sh.name,
    sh.business_id,
    sh.country::text,
    coalesce(sh.billing_email, sh.contact_email),
    ca.id,
    ca.name,
    ca.business_id,
    ca.country::text,
    ca.iban,
    ca.bic
  from public.orders o
  cross join lateral (select app.payout_period_start(app.closed_moment(o)) as st) p
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  where o.status = 'DONE'
    and o.contract_party = 'RAHTIS'
    and not sh.is_test
    and not coalesce(ca.is_test, false)
    and (o.billing <> 'SETTLED' or o.settled_at > now() - interval '90 days')
  order by o.closed_at;
end;
$$;

revoke all on function public.billing_overview() from public, anon;
grant execute on function public.billing_overview() to authenticated;

/*
 * Очередь расчётов — то же правило: она про работу с деньгами, а рейс
 * своего клиента денег через нас не приносит.
 */
create or replace function public.billing_queue(p_limit integer default 50)
returns table (
  id uuid,
  ref text,
  rate_cents integer,
  commission_bps integer,
  billing public.billing_status,
  invoice_ref text,
  closed_at timestamptz,
  shipper_name text,
  carrier_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Очередь расчётов видна только оператору.' using errcode = '42501';
  end if;

  return query
  select o.id, o.ref, o.rate_cents, app.order_bps(o), o.billing, o.invoice_ref, o.closed_at,
         sh.name, ca.name
  from public.orders o
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  where o.status = 'DONE'
    and o.contract_party = 'RAHTIS'
  /* Незакрытые расчёты первыми: это работа, а не архив. */
  order by (o.billing <> 'SETTLED') desc, o.closed_at desc nulls last
  limit least(greatest(coalesce(p_limit, 50), 1), 500);
end;
$$;

revoke all on function public.billing_queue(integer) from public, anon;
grant execute on function public.billing_queue(integer) to authenticated;
