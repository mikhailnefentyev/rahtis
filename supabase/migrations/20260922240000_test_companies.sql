-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · тестовые компании не участвуют в расчётах
--
-- До первого настоящего заказа на платформе работают только тестовые
-- компании, и их рейсы попадали в документы периода: 1 октября им ушли
-- бы счета с первыми номерами боевой серии (2026-0001…). Серия счетов
-- обязана быть сплошной, и номер, отданный тестовой компании, уже не
-- вернуть.
--
-- Отметка «тестовая» у компании (решение пользователя от 21.09.2026).
-- Рейс, в котором заказчик или перевозчик тестовый, не попадает ни в
-- счета, ни в выплаты, ни на страницу расчётов оператора. Недельные
-- отчёты тестовые компании получают как раньше: они и нужны, чтобы
-- проверять, как всё выглядит.
--
-- Все пять компаний, заведённых на 21.09.2026, — тестовые. Новая
-- компания по умолчанию настоящая; отметку ставит и снимает оператор на
-- странице компании.
-- ═══════════════════════════════════════════════════════════════════

alter table public.companies
  add column is_test boolean not null default false;

comment on column public.companies.is_test is
  'Тестовая компания: её рейсы не попадают в счета, выплаты и расчёты оператора.';

update public.companies set is_test = true;

/* Переключить отметку. Только оператору. */
create or replace function public.set_company_test(p_company_id uuid, p_test boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Отметку тестовой компании ставит только оператор.' using errcode = '42501';
  end if;

  update public.companies set is_test = p_test where id = p_company_id;

  if not found then
    raise exception 'Компания не найдена.' using errcode = 'P0002';
  end if;

  perform app.audit('company.test', p_company_id::text, jsonb_build_object('is_test', p_test));
end;
$$;

revoke all on function public.set_company_test(uuid, boolean) from public, anon;
grant execute on function public.set_company_test(uuid, boolean) to authenticated;


-- ── Расчёты оператора без тестовых рейсов ──────────────────────────

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
    and not sh.is_test
    and not coalesce(ca.is_test, false)
    and (o.billing <> 'SETTLED' or o.settled_at > now() - interval '90 days')
  order by o.closed_at;
end;
$$;
