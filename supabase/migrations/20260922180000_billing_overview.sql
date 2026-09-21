-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · расчёты оператора: кому выставить, кто должен, кому платить
--
-- Страница «Laskutus ja tilitykset» показывала рейсы строкой «номер,
-- ставка, статус» — и не отвечала ни на один из вопросов, с которыми
-- оператор приходит: кому выставить счёт и на какую сумму с налогом,
-- куда его слать, кто ещё не заплатил и как давно, кому перевести
-- выплату и на какой счёт.
--
-- Эта функция отдаёт всё это одной выборкой по каждому рейсу: суммы по
-- замороженной комиссии, этап расчётов с датами и реквизиты обеих
-- сторон. Группирует и считает налог страница — ставка ALV зависит от
-- страны и живёт в коде (vatBpsFor), как у документов периода.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.billing_overview()
returns table (
  id uuid,
  ref text,
  shipper_ref text,
  closed_at timestamptz,
  billing public.billing_status,
  invoice_ref text,
  invoiced_at timestamptz,
  paid_at timestamptz,
  settled_at timestamptz,
  rate_cents integer,
  commission_cents integer,
  payout_cents integer,
  route_from text,
  route_to text,
  shipper_id uuid,
  shipper_name text,
  shipper_business_id text,
  shipper_country text,
  shipper_billing_email text,
  shipper_billing_reference text,
  shipper_einvoice_ovt text,
  shipper_einvoice_operator text,
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
    o.billing,
    o.invoice_ref,
    o.invoiced_at,
    o.paid_at,
    o.settled_at,
    o.rate_cents,
    app.commission_cents(o.rate_cents, app.order_bps(o)),
    app.payout_cents(o.rate_cents, app.order_bps(o)),
    (select s.city from public.order_stops s where s.order_id = o.id and s.role = 'PICKUP' order by s.sequence limit 1),
    (select e.city from app.route_end(o.id) e),
    sh.id,
    sh.name,
    sh.business_id,
    sh.country::text,
    coalesce(sh.billing_email, sh.contact_email),
    sh.billing_reference,
    sh.einvoice_ovt,
    sh.einvoice_operator,
    ca.id,
    ca.name,
    ca.business_id,
    ca.country::text,
    ca.iban,
    ca.bic
  from public.orders o
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  where o.status = 'DONE'
    /* Всё незакрытое — это работа; закрытое — только за два месяца, для сверки. */
    and (o.billing <> 'SETTLED' or o.settled_at > now() - interval '60 days')
  order by o.closed_at;
end;
$$;

comment on function public.billing_overview() is
  'Расчёты оператора по рейсам: суммы, этап, реквизиты заказчика и перевозчика. Только оператору.';

revoke all on function public.billing_overview() from public, anon;
grant execute on function public.billing_overview() to authenticated;
