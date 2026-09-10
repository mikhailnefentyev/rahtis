-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · агент оператора
--
-- Инструменты агента аудиторию ADMIN знают с самого начала: оператору они
-- открывают любой заказ и показывают контрагента, которого сторонам не
-- показывают. Не было того, чем этой аудиторией воспользоваться —
-- оператор не мог даже завести тред.
--
-- Причина структурная: conversations.company_id объявлен not null, а у
-- оператора компании нет вовсе. Ограничение companies_kind_not_admin
-- запрещает заводить компанию с ролью ADMIN — и правильно: Aivomaa
-- присутствует в системе как оператор, а не как сторона сделки.
--
-- Поэтому у треда оператора компании нет, и связь эта жёсткая в обе
-- стороны: тред без компании обязан быть операторским, операторский — без
-- компании. Иначе однажды появится тред заказчика с пустой компанией, и
-- инструменты откроют ему всю базу.
--
-- ДЕНЬГИ ОПЕРАТОРА — ДЕНЬГИ ПЛАТФОРМЫ. agent_company_money и
-- agent_payout_schedule сверяют компанию треда с компанией заказа. У
-- оператора компании нет, и обе функции молча вернули бы пусто — то есть
-- ответили бы «за эту неделю ничего», когда рейсы были. Пустая выдача
-- вместо отказа хуже отказа: её не с чем сравнить.
--
-- Поэтому для ADMIN обе считают по всей платформе. Это и есть его
-- вопрос: сколько прошло через нас и сколько мы на этом заработали.
-- ═══════════════════════════════════════════════════════════════════


-- ── Тред без компании ──────────────────────────────────────────────

alter table public.conversations
  alter column company_id drop not null;

alter table public.conversations
  add constraint conversations_admin_has_no_company
    check ((audience = 'ADMIN') = (company_id is null));

comment on column public.conversations.company_id is
  'Компания треда. Пусто только у оператора: он не сторона сделки, а посредник.';

/* Свой индекс: у операторских тредов company_id пуст, и общий им не годится. */
create index if not exists conversations_admin_idx
  on public.conversations (last_message_at desc)
  where company_id is null;


-- ── Права ──────────────────────────────────────────────────────────

/*
 * Прежняя политика вставки сверяет company_id с компанией пишущего. У
 * оператора обе стороны пусты, а null = null это не «истина», а null, —
 * то есть вставка молча запрещалась.
 */
create policy conversations_insert_admin
  on public.conversations for insert to authenticated
  with check (
    (select app.is_admin())
    and company_id is null
    and audience = 'ADMIN'
  );

create policy messages_insert_admin
  on public.messages for insert to authenticated
  with check (
    sender = 'USER'
    and sender_user_id = (select auth.uid())
    and (select app.is_admin())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.company_id is null
    )
  );


-- ── Деньги: у оператора это вся платформа ──────────────────────────

create or replace function public.agent_company_money(
  p_conversation_id uuid,
  p_token uuid,
  p_weeks integer default 8
)
returns table (
  week date,
  orders_count integer,
  gross_cents bigint,
  commission_cents bigint,
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
    app.report_week(app.closed_moment(o)) as w,
    count(*)::integer,
    sum(coalesce(o.rate_cents, 0))::bigint,
    /*
     * Комиссия и выплата — дело перевозчика. Заказчику их не показываем;
     * оператору показываем обе: комиссия и есть его выручка.
     */
    case when v_carrier or v_admin
      then sum(app.commission_cents(o.rate_cents, app.order_bps(o)))::bigint end,
    case when v_carrier or v_admin
      then sum(app.payout_cents(o.rate_cents, app.order_bps(o)))::bigint end
  from public.orders o
  where o.status = 'DONE'
    and (
      v_admin
      or (v_carrier and o.assigned_company_id = v_ctx.company_id)
      or (not v_carrier and o.shipper_company_id = v_ctx.company_id)
    )
  group by w
  order by w desc
  limit greatest(1, least(coalesce(p_weeks, 8), 52));
end;
$$;

comment on function public.agent_company_money(uuid, uuid, integer) is
  'Деньги по неделям: своей компании — стороне, всей платформы — оператору.';

revoke all on function public.agent_company_money(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.agent_company_money(uuid, uuid, integer) to agent, service_role;


-- ── График оплат: у оператора это тоже вся платформа ───────────────

/*
 * Та же причина, что у agent_company_money: сверка с компанией треда у
 * оператора не срабатывает, и функция молча возвращала бы пусто. Ответ
 * «в этом периоде выплат нет» на вопрос «сколько нам платить
 * пятнадцатого» — это худший из возможных: он выглядит как ответ.
 */
create or replace function public.agent_payout_schedule(
  p_conversation_id uuid,
  p_token uuid,
  p_periods integer default 6
)
returns table (
  period_start date,
  period_end date,
  due_date date,
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
    p.due,
    (p.due - current_date)::integer,
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
  'Периоды и даты оплаты: своей компании — стороне, всей платформы — оператору.';

revoke all on function public.agent_payout_schedule(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.agent_payout_schedule(uuid, uuid, integer) to agent, service_role;
