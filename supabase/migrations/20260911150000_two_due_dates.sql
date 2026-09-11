-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · у периода две даты, а не одна
--
-- Агент показал заказчику «Eräpäivä: 30.9.2026» за период 16–31.8. Это
-- день, когда МЫ платим перевозчику, а не день, когда заказчик платит
-- нам. Ошибка не в агенте: agent_payout_schedule отдаёт одну дату всем
-- сторонам, и в её комментарии так и записано — «правило одно, стороны
-- разные». Это было верно ровно до того дня, когда у заказчика появился
-- собственный срок.
--
-- Теперь сроков два, и оба считаются от конца периода:
--
--   заказчик платит нам   — конец периода + 15 дней;
--   мы платим перевозчику — конец периода + 30 дней.
--
-- Пятнадцать дней зазора и есть то, что отделяет посредника от того, кто
-- платит из своего кармана. Обе даты от одной точки, поэтому зазор
-- постоянный и его видно числом, а не выводят вычитанием в уме.
--
-- ПРИВЯЗКА К ПЕРИОДУ, А НЕ К ДНЮ ВЫСТАВЛЕНИЯ. Документ считал срок как
-- «сегодня плюс четырнадцать»: запустись задание на день позже, и срок
-- уехал бы вместе с ним, а агент, у которого дня выставления нет вовсе,
-- назвать его не мог — он так и написал в ответе, что не знает. От конца
-- периода дату знают оба, и она одна.
--
-- Заказчику дата выплаты перевозчику не показывается, а перевозчику —
-- срок счёта заказчика: не потому что секрет, а потому что именно их
-- смешение и породило неверный ответ. Оператор видит обе: это его
-- касается с двух сторон.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.invoice_due(p_period_start date)
returns date
language sql
immutable
set search_path = ''
as $$
  select app.payout_period_end(p_period_start) + 15;
$$;

comment on function app.invoice_due(date) is
  'Срок оплаты сводки заказчиком: конец расчётного периода плюс пятнадцать дней.';

revoke all on function app.invoice_due(date) from public, anon, authenticated;
grant execute on function app.invoice_due(date) to service_role;


-- ── Границы периода отдают обе даты ────────────────────────────────

drop function if exists public.settlement_period(timestamptz);

create or replace function public.settlement_period(p_moment timestamptz default now())
returns table (period_start date, period_end date, invoice_due date, payout_due date)
language sql
stable
security definer
set search_path = ''
as $$
  select
    app.payout_period_start(p_moment),
    app.payout_period_end(app.payout_period_start(p_moment)),
    app.invoice_due(app.payout_period_start(p_moment)),
    app.payout_due(p_moment);
$$;

comment on function public.settlement_period(timestamptz) is
  'Границы расчётного периода и обе его даты: срок счёта заказчику и день выплаты перевозчику.';

revoke all on function public.settlement_period(timestamptz) from public, anon, authenticated;
grant execute on function public.settlement_period(timestamptz) to service_role;


-- ── График оплат называет ту дату, что касается спросившего ────────

drop function if exists public.agent_payout_schedule(uuid, uuid, integer);

create or replace function public.agent_payout_schedule(
  p_conversation_id uuid,
  p_token uuid,
  p_periods integer default 6
)
returns table (
  period_start date,
  period_end date,
  /* Заказчику — когда платить нам. Перевозчику не показывается. */
  invoice_due date,
  /* Перевозчику — когда придут деньги. Заказчику не показывается. */
  payout_due date,
  days_left integer,
  orders_count integer,
  gross_cents bigint,
  payout_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx public.conversations;
  v_carrier boolean;
  v_admin boolean;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);
  v_carrier := v_ctx.audience in ('CARRIER', 'DRIVER');
  v_admin := v_ctx.audience = 'ADMIN';

  return query
  select
    p.st,
    app.payout_period_end(p.st),
    case when not v_carrier then app.invoice_due(p.st) end,
    case when v_carrier or v_admin then p.due end,
    /*
     * Дней осталось — до той даты, что касается спросившего. Оператору
     * до выплаты: она его обязательство, а счёт заказчику он выставил.
     */
    case
      when v_carrier or v_admin then (p.due - current_date)::integer
      else (app.invoice_due(p.st) - current_date)::integer
    end,
    p.cnt,
    p.gross,
    case when v_carrier or v_admin then p.payout end
  from (
    select
      app.payout_period_start(app.closed_moment(o)) as st,
      app.payout_due(app.closed_moment(o)) as due,
      count(*)::integer as cnt,
      sum(coalesce(o.rate_cents, 0))::bigint as gross,
      sum(app.payout_cents(o.rate_cents, app.order_bps(o)))::bigint as payout
    from public.orders o
    where o.status = 'DONE'
      and (
        v_admin
        or (v_carrier and o.assigned_company_id = v_ctx.company_id)
        or (not v_carrier and o.shipper_company_id = v_ctx.company_id)
      )
    group by 1, 2
  ) p
  order by p.st desc
  limit greatest(1, least(coalesce(p_periods, 6), 24));
end;
$$;

comment on function public.agent_payout_schedule(uuid, uuid, integer) is
  'Расчётные периоды: заказчику срок счёта, перевозчику день выплаты, оператору обе даты.';

revoke all on function public.agent_payout_schedule(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.agent_payout_schedule(uuid, uuid, integer) to agent, service_role;
