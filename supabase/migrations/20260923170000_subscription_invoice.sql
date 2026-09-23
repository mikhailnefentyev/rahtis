-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · месячный сбор выставляется счётом, а не только удержанием
--
-- Сбор 29,90 € за активную машину удерживался из выплаты перевозчику.
-- У подписчика, который возит своих клиентов и прямых заказчиков,
-- выплаты от нас нет вовсе: удерживать не из чего. Начисление ложилось
-- в carrier_subscription_fees и оставалось висеть — счёта на него не
-- существовало, в сводке оператора оно не всплывало, заметить было
-- нечем. То есть ветка подписки не умела брать деньги, хотя это её
-- единственный доход.
--
-- Теперь у сбора есть обе дороги:
--   · есть выплата — как раньше, удержание (apply_carrier_fees);
--   · выплаты не хватило или её нет — счёт с номером из той же сплошной
--     серии, что и счета заказчикам.
--
-- Счёт выставляется на ОСТАТОК: сначала месяц закрывается расчётами и
-- удержаниями, и только потом выписывается то, что не покрыто. Поэтому
-- invoice_subscription_fees вызывается после выпуска документов периода,
-- а не вместе с начислением.
--
-- Повторный вызов ничего не дублирует: счёт у начисления один.
-- ═══════════════════════════════════════════════════════════════════

-- ── Счёт знает, за что он ──────────────────────────────────────────

/*
 * Счёт за подписку — третий вид документа рядом с недельным отчётом и
 * документом периода: перевозчик должен видеть его там же, где видит
 * остальные, а не искать в почте.
 */
alter type public.report_kind add value if not exists 'SUBSCRIPTION';

create type public.invoice_kind as enum ('TRANSPORT', 'SUBSCRIPTION');

comment on type public.invoice_kind is
  'За что счёт: за перевозки периода или за месячный сбор с активных машин.';

alter table public.invoices
  add column kind public.invoice_kind not null default 'TRANSPORT';

comment on column public.invoices.kind is
  'Счёт за перевозки заказчику или за месячный сбор перевозчику-подписчику.';

/* У компании один счёт за период КАЖДОГО вида: перевозки и сбор не смешиваются. */
alter table public.invoices
  drop constraint invoices_one_per_period,
  add constraint invoices_one_per_period unique (company_id, period_start, kind);

alter table public.carrier_subscription_fees
  add column invoice_id uuid references public.invoices (id) on delete set null,
  add column paid_at timestamptz;

comment on column public.carrier_subscription_fees.invoice_id is
  'Счёт на непокрытый удержаниями остаток сбора. NULL — всё ушло из выплаты.';
comment on column public.carrier_subscription_fees.paid_at is
  'Когда оплачен счёт на остаток. Удержанная часть оплаты не требует.';


-- ── Сколько осталось получить ──────────────────────────────────────

create or replace function app.subscription_open_cents(p_fee_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select greatest(
    f.gross_cents - coalesce((
      select sum(d.amount_cents)::integer
      from public.carrier_fee_deductions d
      where d.fee_id = f.id
    ), 0),
    0
  )
  from public.carrier_subscription_fees f
  where f.id = p_fee_id;
$$;

comment on function app.subscription_open_cents(uuid) is
  'Остаток месячного сбора с ALV: начислено минус удержано из выплат.';

grant execute on function app.subscription_open_cents(uuid) to authenticated, service_role;


-- ── Счёт на остаток ────────────────────────────────────────────────

/*
 * Выписать счета за месяц. Берётся только то, что не покрыто
 * удержаниями, и только у компаний, которым вообще выставляем: тестовые
 * не участвуют. Номер — из общей серии, как у счетов заказчикам.
 */
create or replace function public.invoice_subscription_fees(p_month date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_year integer := extract(year from (now() at time zone 'Europe/Helsinki'))::integer;
  v_fee record;
  v_next integer;
  v_invoice uuid;
  v_count integer := 0;
begin
  for v_fee in
    select f.id, f.carrier_company_id
    from public.carrier_subscription_fees f
    join public.companies c on c.id = f.carrier_company_id
    where f.month = v_month
      and f.invoice_id is null
      and not c.is_test
      and app.subscription_open_cents(f.id) > 0
    order by c.name
  loop
    insert into app.invoice_counters (year, last) values (v_year, 1)
    on conflict (year) do update set last = app.invoice_counters.last + 1
    returning last into v_next;

    insert into public.invoices (number, company_id, period_start, kind)
    values (v_year::text || '-' || lpad(v_next::text, 4, '0'),
            v_fee.carrier_company_id, v_month, 'SUBSCRIPTION')
    returning id into v_invoice;

    update public.carrier_subscription_fees set invoice_id = v_invoice where id = v_fee.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.invoice_subscription_fees(date) from public, anon, authenticated;
grant execute on function public.invoice_subscription_fees(date) to service_role;


-- ── Оператору: что начислено, что удержано, что ждёт оплаты ────────

create or replace function public.subscription_fees_overview()
returns table (
  fee_id uuid,
  month date,
  carrier_id uuid,
  carrier_name text,
  carrier_country text,
  carrier_email text,
  partnership public.partnership_mode,
  active_vehicles integer,
  unit_cents integer,
  net_cents integer,
  vat_bps integer,
  gross_cents integer,
  deducted_cents integer,
  open_cents integer,
  invoice_number text,
  invoiced_on date,
  paid_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Сборы видны только оператору.' using errcode = '42501';
  end if;

  return query
  select
    f.id,
    f.month,
    c.id,
    c.name,
    c.country::text,
    coalesce(c.billing_email, c.contact_email),
    c.partnership,
    f.active_vehicles,
    f.unit_cents,
    f.net_cents,
    f.vat_bps,
    f.gross_cents,
    f.gross_cents - app.subscription_open_cents(f.id),
    app.subscription_open_cents(f.id),
    i.number,
    i.issued_on,
    f.paid_at
  from public.carrier_subscription_fees f
  join public.companies c on c.id = f.carrier_company_id
  left join public.invoices i on i.id = f.invoice_id
  order by f.month desc, c.name;
end;
$$;

revoke all on function public.subscription_fees_overview() from public, anon;
grant execute on function public.subscription_fees_overview() to authenticated;

/* Оплату сбора отмечает оператор — как и поступление по счёту заказчика. */
create or replace function public.set_subscription_paid(p_fee_id uuid, p_paid boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Оплату отмечает только оператор.' using errcode = '42501';
  end if;

  update public.carrier_subscription_fees
  set paid_at = case when p_paid then now() else null end
  where id = p_fee_id;

  perform app.audit('subscription.paid', p_fee_id::text, jsonb_build_object('paid', p_paid));
end;
$$;

revoke all on function public.set_subscription_paid(uuid, boolean) from public, anon;
grant execute on function public.set_subscription_paid(uuid, boolean) to authenticated, service_role;
