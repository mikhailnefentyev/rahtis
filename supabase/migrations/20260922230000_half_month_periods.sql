-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · расчётный период снова полмесяца
--
-- 21.09.2026 пользователь уточнил: счета выставляются за 1–15 и за 16–
-- конец месяца, а не за двухнедельные периоды (миграция two_week_periods
-- того же дня). Правило периодов возвращается к исходному
-- (payout_schedule): 1–15 и 16–конец, выплата перевозчику 15-го и 30-го
-- (или в последний день короткого месяца) следующего месяца. Срок
-- заказчику — конец периода плюс 15 дней, он считается от
-- payout_period_end и сам следует за правилом.
--
-- Что остаётся от two_week_periods: счёт с номером из сплошной серии и
-- автоматическая отметка рейсов INVOICED в момент выпуска. Это не
-- зависит от длины периода.
--
-- Расписание — снова 1-го и 16-го, утром: период закрыт целиком, и
-- добавить в него уже нечего.
--
-- Черновики TERMS v8 и SHIPPER_AGREEMENT v4 заводились только ради
-- двух недель и ничем больше от действующих редакций не отличаются —
-- они удаляются, действующие тексты (половина месяца) верны.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.payout_period_start(p_moment timestamptz)
returns date
language sql
stable
as $$
  select case
    when extract(day from d) <= 15 then date_trunc('month', d)::date
    else (date_trunc('month', d)::date + 15)
  end
  from (select (p_moment at time zone 'Europe/Helsinki')::date as d) s;
$$;

create or replace function app.payout_period_end(p_start date)
returns date
language sql
immutable
as $$
  select case
    when extract(day from p_start) = 1 then p_start + 14
    else (date_trunc('month', p_start) + interval '1 month' - interval '1 day')::date
  end;
$$;

create or replace function app.payout_due(p_moment timestamptz)
returns date
language sql
stable
as $$
  select case
    when extract(day from st) = 1 then nm + 14
    else least(nm + 29, (nm + interval '1 month' - interval '1 day')::date)
  end
  from (
    select st, (date_trunc('month', st) + interval '1 month')::date as nm
    from (select app.payout_period_start(p_moment) as st) a
  ) b;
$$;

comment on function app.payout_period_start(timestamptz) is
  'Начало расчётного периода по Хельсинки: 1-е или 16-е число.';
comment on function app.payout_period_end(date) is
  'Конец расчётного периода: 15-е либо последний день месяца.';
comment on function app.payout_due(timestamptz) is
  'День оплаты: за 1–15 — 15-е следующего месяца, за 16–конец — 30-е (или последний день короткого месяца).';


-- ── Расписание: 1-го и 16-го ───────────────────────────────────────

do $$
begin
  perform cron.unschedule('rahtis-period-settlement');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'rahtis-period-settlement',
  '20 4 1,16 * *',
  $$ select app.run_period_settlement(); $$
);


-- ── Расчёты оператора: день выплаты по правилу, а не «+30» ─────────

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
    and (o.billing <> 'SETTLED' or o.settled_at > now() - interval '90 days')
  order by o.closed_at;
end;
$$;


-- ── Черновики «двух недель» не нужны ───────────────────────────────

delete from public.legal_documents d
where d.status = 'DRAFT'
  and ((d.kind = 'TERMS' and d.version = 8) or (d.kind = 'SHIPPER_AGREEMENT' and d.version = 4))
  and exists (
    select 1 from public.legal_clauses c
    where c.document_id = d.id and c.locale = 'fi' and c.body like 'Tilityskausi on kaksi viikkoa%'
  );
