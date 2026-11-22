-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · счета: исправления после проверки (22.11.2026)
--
--   1. Рейс, уже вошедший в недельный счёт RAHTIS, нельзя отметить
--      вторым, ручным счётом. Проверка стояла в приложении и читала
--      orders.carrier_invoice_id под сессией перевозчика, а колонка
--      ему не выдана (права на orders поимённые): запрос падал с 42501,
--      ошибку никто не смотрел, проверка проходила всегда. Теперь её
--      делает сама save_freight_invoice, а freight_invoice_targets
--      отдаёт такому рейсу editable = false — форма не показывается.
--
--   2. Месячный сбор (MONTH) и год вперёд (ANNUAL) в одном месяце.
--      Счёт за подписку у компании и месяца один
--      (invoices_one_per_period), а сборов может быть два: второй insert
--      падал с 23505 и откатывал invoice_subscription_fees целиком —
--      счёта в этот месяц не получал никто. Теперь оба сбора идут в
--      один счёт двумя строками.
--
-- Новых колонок и таблиц нет; выставленные счета не меняются.
-- ═══════════════════════════════════════════════════════════════════


-- ── Ручной счёт перевозчика: рейс уже в недельном счёте ────────────

/*
 * Исходное определение — 20261106170000_trust_quick_wins. Добавлена одна
 * проверка: orders.carrier_invoice_id заполнен — рейс уже в счёте,
 * который RAHTIS составил от имени перевозчика; второй счёт за него был
 * бы двойным. Код 55006 — чтобы приложение отличило этот отказ от
 * «счёт уже оплачен» (55000) и показало свой текст.
 */
create or replace function public.save_freight_invoice(
  p_order_id uuid,
  p_number text,
  p_amount_cents bigint,
  p_currency text,
  p_issued_on date,
  p_due_on date,
  p_send_to text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shipper uuid;
  v_id uuid;
  v_send_to text := lower(btrim(coalesce(p_send_to, '')));
begin
  if not app.can_report_payment(p_order_id) then
    raise exception 'Счёт отмечает перевозчик рейса по прямому договору в течение 180 дней после закрытия.'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.orders o where o.id = p_order_id and o.carrier_invoice_id is not null) then
    raise exception 'Рейс уже вошёл в счёт, составленный RAHTIS: второй счёт за него не записывается.'
      using errcode = '55006';
  end if;

  if exists (select 1 from public.freight_invoices f where f.order_id = p_order_id and f.paid_at is not null) then
    raise exception 'Счёт уже оплачен.' using errcode = '55000';
  end if;

  select o.shipper_company_id into v_shipper from public.orders o where o.id = p_order_id;

  /*
   * Напоминания уходят от RAHTIS — адрес только заказчика: его почта для
   * счетов, общая почта или почта его пользователей. Иначе через сервис
   * можно было бы слать письма кому угодно.
   */
  if v_send_to = '' then
    select lower(coalesce(nullif(btrim(c.billing_email), ''), c.contact_email)) into v_send_to
    from public.companies c where c.id = v_shipper;
  elsif not exists (
    select 1 from public.companies c
    where c.id = v_shipper and v_send_to in (lower(btrim(coalesce(c.billing_email, ''))), lower(btrim(coalesce(c.contact_email, ''))))
  ) and not exists (
    select 1 from public.profiles pr join auth.users u on u.id = pr.id
    where pr.company_id = v_shipper and lower(u.email) = v_send_to
  ) then
    raise exception 'Напоминания отправляются только на адрес заказчика (почта для счетов, общая почта или почта его пользователей).'
      using errcode = '22023';
  end if;

  insert into public.freight_invoices (
    order_id, carrier_company_id, shipper_company_id, number, amount_cents, currency,
    issued_on, due_on, send_to, created_by
  )
  values (
    p_order_id, (select app.current_company_id()), v_shipper, btrim(coalesce(p_number, '')), p_amount_cents,
    upper(btrim(coalesce(p_currency, 'EUR'))), p_issued_on, p_due_on, v_send_to, (select auth.uid())
  )
  on conflict (order_id) do update set
    number = excluded.number,
    amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    issued_on = excluded.issued_on,
    send_to = excluded.send_to,
    reminder_1_at = case when freight_invoices.due_on = excluded.due_on then freight_invoices.reminder_1_at end,
    reminder_2_at = case when freight_invoices.due_on = excluded.due_on then freight_invoices.reminder_2_at end,
    collection_hint_at = case when freight_invoices.due_on = excluded.due_on then freight_invoices.collection_hint_at end,
    due_on = excluded.due_on,
    updated_at = now()
  where freight_invoices.carrier_company_id = (select app.current_company_id())
  returning id into v_id;

  if v_id is null then
    raise exception 'Счёт не найден.' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

revoke all on function public.save_freight_invoice(uuid, text, bigint, text, date, date, text) from public, anon;
grant execute on function public.save_freight_invoice(uuid, text, bigint, text, date, date, text) to authenticated;

/*
 * Список выполненных у перевозчика. Исходное определение —
 * 20261106170000_trust_quick_wins; изменена одна колонка: editable ложно
 * и для рейса, вошедшего в недельный счёт (carrier_invoice_id). Функция
 * security definer — колоночные права перевозчика ей не мешают.
 */
create or replace function public.freight_invoice_targets()
returns table (
  order_id uuid,
  editable boolean,
  default_amount_cents bigint,
  default_currency text,
  default_send_to text,
  invoice_id uuid,
  number text,
  amount_cents bigint,
  currency text,
  issued_on date,
  due_on date,
  send_to text,
  paid_at date,
  paid_marked_side text,
  paid_confirmed_at timestamptz,
  reminder_1_at timestamptz,
  reminder_2_at timestamptz,
  report_prefilled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    app.closed_moment(o) > now() - interval '180 days' and o.carrier_invoice_id is null,
    o.rate_cents::bigint,
    o.currency::text,
    coalesce(sh.billing_email, sh.contact_email),
    f.id,
    f.number,
    f.amount_cents,
    f.currency::text,
    f.issued_on,
    f.due_on,
    f.send_to,
    f.paid_at,
    f.paid_marked_side,
    f.paid_confirmed_at,
    f.reminder_1_at,
    f.reminder_2_at,
    coalesce(r.prefilled and r.removed_at is null, false)
  from public.orders o
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.freight_invoices f on f.order_id = o.id
  left join public.direct_payment_reports r on r.order_id = o.id
  where o.assigned_company_id = (select app.current_company_id())
    and (select app.current_party_role()) = 'CARRIER'
    and o.status = 'DONE'
    and o.contract_party = 'CARRIER'
    and sh.client_of is null
    and (app.closed_moment(o) > now() - interval '180 days' or f.id is not null);
$$;

revoke all on function public.freight_invoice_targets() from public, anon;
grant execute on function public.freight_invoice_targets() to authenticated;


-- ── Счёт за подписку: месячный сбор и год вперёд в одном месяце ────

/*
 * Исходное определение — 20260923170000_subscription_invoice.
 *
 * Счёт за подписку у компании и месяца по-прежнему один, но сборов за
 * месяц может быть два: месячный и год вперёд, купленный в этом же
 * месяце (carrier_annual_plan_create ставит ему месяц покупки). Оба идут
 * в один счёт: первый сбор компании счёт создаёт, второй к нему
 * присоединяется.
 *
 * Счёт, по которому документ уже выпущен (есть строка weekly_reports),
 * не дополняется: выставленный счёт не меняется задним числом. Сбор,
 * появившийся после этого, остаётся без счёта — приложение сообщает о
 * нём оператору (generateMonthlyFees), а задание идёт дальше, не
 * откатывая счета остальных.
 *
 * Возвращает число созданных счетов.
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
    order by c.name, f.carrier_company_id, f.kind
    for update of f
  loop
    select i.id into v_invoice
    from public.invoices i
    where i.company_id = v_fee.carrier_company_id
      and i.period_start = v_month
      and i.kind = 'SUBSCRIPTION';

    if v_invoice is null then
      insert into app.invoice_counters (year, last) values (v_year, 1)
      on conflict (year) do update set last = app.invoice_counters.last + 1
      returning last into v_next;

      insert into public.invoices (number, company_id, period_start, kind)
      values (v_year::text || '-' || lpad(v_next::text, 4, '0'),
              v_fee.carrier_company_id, v_month, 'SUBSCRIPTION')
      returning id into v_invoice;

      v_count := v_count + 1;
    elsif exists (
      select 1 from public.weekly_reports r
      where r.week = v_month
        and r.company_id = v_fee.carrier_company_id
        and r.kind = 'SUBSCRIPTION'
    ) then
      /* Счёт уже выпущен документом — не дополняем. */
      continue;
    end if;

    update public.carrier_subscription_fees set invoice_id = v_invoice where id = v_fee.id;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.invoice_subscription_fees(date) from public, anon, authenticated;
grant execute on function public.invoice_subscription_fees(date) to service_role;
