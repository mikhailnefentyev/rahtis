-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · две ветки: подписка на платформу и подряд
--
-- 23.09.2026 решение пользователя после переговоров с перевозчиками.
-- Платформой можно пользоваться двумя разными способами, и это разные
-- товары, а не два тарифа за одно и то же:
--
--   ПОДПИСКА (SUBSCRIBER) — «работу привёл ты».
--     Перевозчик возит своих клиентов, мы даём приложение, рабочее
--     время водителей, карту, автоматизацию и доступ к столу. В деньгах
--     и документах его собственных рейсов мы не участвуем: счёт клиенту
--     выставляет он сам. Плата — 29,90 € в месяц за активную машину.
--
--   ПОДРЯД (SUBCONTRACTOR) — «работу привели мы».
--     Перевозчик становится нашим субподрядчиком: счёт клиенту от
--     Aivomaa Oy, живые CMR, отчёты заказчику, претензии — на нас.
--     Плата — 3 % с цены рейса, удерживаются из выплаты. Месячного
--     сбора за машины нет: в трёх процентах всё включено.
--
-- Ключевое: плата следует за ЗАКАЗОМ, а не за компанией. Перевозчик
-- почти всегда живёт в обеих ветках сразу — свои рейсы плюс добор со
-- стола, — поэтому сторона договора записана на самом заказе:
--
--   contract_party = 'RAHTIS'  — договор с клиентом у нас: 3 % с
--     перевозчика, счёт и документы наши, стороны друг друга не видят;
--   contract_party = 'CARRIER' — договор у перевозчика с его клиентом:
--     процента нет, счёта от нас нет, клиента видно по имени.
--
-- Заказ со стола — ВСЕГДА подряд, кем бы он ни был взят: иначе стол
-- отдаёт клиента после первого рейса и перестаёт быть столом. Значит,
-- подписчик, взявший заказ со стола, платит за него 3 % сверх своей
-- подписки, а заказчик — свои 3 %, как и раньше.
--
-- Сегодняшние перевозчики — субподрядчики: нынешняя платформа это и
-- есть ветка подряда. Настоящих счетов ещё не выставлялось, поэтому
-- перевод никого не задевает задним числом.
--
-- Заказы «своего клиента» (contract_party = 'CARRIER') появятся
-- следующим шагом вместе со справочником клиентов перевозчика; здесь
-- заложены только деньги и признак, от которого они считаются.
-- ═══════════════════════════════════════════════════════════════════

-- ── Ветка компании ─────────────────────────────────────────────────

create type public.partnership_mode as enum ('SUBCONTRACTOR', 'SUBSCRIBER');

comment on type public.partnership_mode is
  'Как перевозчик пользуется платформой: подряд (3 % с рейса) или подписка (29,90 € за активную машину).';

alter table public.companies
  add column partnership public.partnership_mode,
  add constraint companies_partnership_carrier_only
    check (partnership is null or kind = 'CARRIER');

comment on column public.companies.partnership is
  'Ветка перевозчика. NULL = подряд: так работала платформа до 23.09.2026.';

/* Нынешние перевозчики работают по подряду — это сегодняшнее поведение. */
update public.companies set partnership = 'SUBCONTRACTOR' where kind = 'CARRIER';

grant select (partnership) on public.companies to authenticated;

/*
 * Ветку меняет оператор: она решает, кто кому выставляет счета, и
 * менять её себе перевозчик не может.
 */
create or replace function public.set_company_partnership(
  p_company_id uuid,
  p_mode public.partnership_mode
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.party_role;
begin
  if not (select app.is_admin()) then
    raise exception 'Ветку перевозчика меняет только оператор.' using errcode = '42501';
  end if;

  select kind into v_kind from public.companies where id = p_company_id;

  if v_kind is distinct from 'CARRIER' then
    raise exception 'Ветка есть только у перевозчика.' using errcode = '22023';
  end if;

  update public.companies set partnership = p_mode where id = p_company_id;

  perform app.audit('company.partnership', p_company_id::text,
    jsonb_build_object('mode', p_mode));
end;
$$;

revoke all on function public.set_company_partnership(uuid, public.partnership_mode) from public, anon;
grant execute on function public.set_company_partnership(uuid, public.partnership_mode)
  to authenticated, service_role;


-- ── Сторона договора в заказе ──────────────────────────────────────

create type public.contract_party as enum ('RAHTIS', 'CARRIER');

comment on type public.contract_party is
  'Чей договор с заказчиком: наш (подряд) или самого перевозчика (подписка).';

alter table public.orders
  add column contract_party public.contract_party not null default 'RAHTIS';

comment on column public.orders.contract_party is
  'Сторона договора с клиентом. RAHTIS — счёт и документы наши, 3 % с перевозчика. CARRIER — рейс своего клиента: процента и счёта от нас нет.';

grant select (contract_party) on public.orders to authenticated;


-- ── Деньги ─────────────────────────────────────────────────────────

/*
 * Процент с перевозчика вернулся — но только там, где договор с
 * клиентом наш. С 22.09.2026 он был нулевым для всех; теперь ноль
 * остаётся только у рейсов своего клиента.
 */
create or replace function app.current_commission_bps()
returns integer
language sql
immutable
as $$
  select 300;
$$;

comment on function app.current_commission_bps() is
  'Плата перевозчика за рейс по подряду: 300 б.п. = 3 % с цены, удерживаются из выплаты.';

/*
 * Ставки замораживаются в момент закрытия рейса: обе сразу и в одном
 * месте. Позднее изменение тарифа не переписывает закрытые рейсы.
 *
 * Плата заказчика — только за рейс, пришедший через стол.
 * Плата перевозчика — только за рейс, где сторона договора мы.
 * Бесплатный период компании обнуляет её собственную плату, но не
 * плату другой стороны: у них разные компании и разные месяцы.
 */
create or replace function app.freeze_order_fees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin public.offer_origin;
  v_closed date;
  v_free date;
begin
  if new.status = 'DONE' and old.status is distinct from 'DONE' then
    select f.origin into v_origin from public.order_offers f where f.id = new.chosen_offer_id;
    v_closed := (coalesce(new.closed_at, now()) at time zone 'Europe/Helsinki')::date;

    v_free := app.free_until(new.shipper_company_id);
    new.shipper_fee_bps := case
      when v_origin = 'DIRECT' then 0
      when v_free is not null and v_closed <= v_free then 0
      else app.current_shipper_fee_bps()
    end;

    v_free := app.free_until(new.assigned_company_id);
    new.commission_bps := case
      when new.contract_party = 'CARRIER' then 0
      when v_free is not null and v_closed <= v_free then 0
      else app.current_commission_bps()
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_freeze_shipper_fee on public.orders;
drop function if exists app.freeze_shipper_fee();

create trigger orders_freeze_order_fees
  before update of status on public.orders
  for each row execute function app.freeze_order_fees();

/*
 * Месячный сбор — только у подписчиков. У субподрядчика в трёх
 * процентах всё включено, и машины ему не считаются.
 */
create or replace function public.issue_monthly_subscriptions(p_month date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  v_count integer;
begin
  insert into public.carrier_subscription_fees (
    carrier_company_id, month, active_vehicles, unit_cents, net_cents, vat_bps, gross_cents
  )
  select
    a.company_id, v_month, a.vehicles, app.subscription_unit_cents(),
    a.vehicles * app.subscription_unit_cents(),
    case when c.country = 'FI' then 2550 else 0 end,
    a.vehicles * app.subscription_unit_cents()
      + round(a.vehicles * app.subscription_unit_cents()
              * (case when c.country = 'FI' then 2550 else 0 end) / 10000.0)::integer
  from (
    select o.assigned_company_id as company_id, count(distinct o.assigned_vehicle_id)::integer as vehicles
    from public.orders o
    where o.status = 'DONE'
      and o.assigned_vehicle_id is not null
      and (app.closed_moment(o) at time zone 'Europe/Helsinki')::date between v_month and v_end
    group by o.assigned_company_id
  ) a
  join public.companies c on c.id = a.company_id
  where not c.is_test
    and c.partnership = 'SUBSCRIBER'
    and (app.free_until(c.id) is null or app.free_until(c.id) < v_end)
  on conflict (carrier_company_id, month) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.issue_monthly_subscriptions(date) from public, anon, authenticated;
grant execute on function public.issue_monthly_subscriptions(date) to service_role;
