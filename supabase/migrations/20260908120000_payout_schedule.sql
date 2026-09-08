-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · когда придут деньги
--
-- Перевозчик спросил агента «когда за него оплата?» и не получил
-- ответа: платформа знала суммы по неделям, но не знала правила, по
-- которому эти суммы превращаются в дату. Агент честно сказал, что
-- такого инструмента нет, — и это был верный ответ на неверно
-- устроенную систему.
--
-- Правило:
--
--   Расчётный период — половина месяца: с 1 по 15 число и с 16 по
--   последнее. Рейс попадает в период по дате закрытия.
--
--   Оплата приходит через месяц: за первую половину — 15 числа
--   следующего месяца, за вторую — 30 числа следующего месяца.
--
-- Февраль и другие короткие месяцы: тридцатого числа там может не
-- быть, и тогда берётся последний день месяца. Переносить оплату на
-- первое марта было бы решением не в пользу перевозчика, а правило,
-- которое в спорный день трактуется против него, будет истолковано
-- против нас.
--
-- Неделя отчёта и период оплаты — разные вещи и намеренно не сведены к
-- одному: неделя показывает выработку, период показывает деньги. Неделя
-- со среды по вторник запросто ложится в два разных периода.
-- ═══════════════════════════════════════════════════════════════════


-- ── Расчётный период ───────────────────────────────────────────────

/*
 * Начало периода, в который попадает момент. Хельсинки, а не UTC: то
 * же время, по которому в продукте считаются недели и рабочие дни.
 */
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

/* Конец периода: 15-е либо последний день месяца. */
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

/*
 * День, когда за период платят.
 *
 * Отсчёт от периода, а не от даты рейса: два рейса одного периода
 * оплачиваются вместе, иначе «отсрочка 30 дней» превратилась бы в
 * тридцать разных дат внутри одного счёта.
 */
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
comment on function app.payout_due(timestamptz) is
  'День оплаты: за 1–15 — 15-е следующего месяца, за 16–конец — 30-е (или последний день короткого месяца).';

revoke all on function app.payout_period_start(timestamptz) from public, anon, authenticated;
revoke all on function app.payout_period_end(date) from public, anon, authenticated;
revoke all on function app.payout_due(timestamptz) from public, anon, authenticated;
grant execute on function app.payout_period_start(timestamptz) to service_role;
grant execute on function app.payout_period_end(date) to service_role;
grant execute on function app.payout_due(timestamptz) to service_role;


-- ── Карточка заказа знает свою дату оплаты ─────────────────────────

/*
 * Дата оплаты рядом со ставкой, а не отдельным вопросом. «Когда за него
 * оплата» — второй вопрос после «сколько за него», и разделять их
 * значит заставлять человека спрашивать дважды.
 *
 * Набор колонок меняется, поэтому через drop.
 */
drop function if exists public.agent_order_by_ref(uuid, uuid, text);

create or replace function public.agent_order_by_ref(
  p_conversation_id uuid,
  p_token uuid,
  p_ref text
)
returns table (
  ref text,
  status public.order_status,
  order_type public.order_type,
  haul_kind public.haul_kind,
  container_feet smallint,
  distance_km integer,
  rate_cents integer,
  trailer text,
  trailer_plate text,
  published_at timestamptz,
  closed_at timestamptz,
  payout_period_start date,
  payout_due date,
  counterparty text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx public.conversations;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);

  return query
  select
    o.ref, o.status, o.order_type, o.haul_kind, o.container_feet, o.distance_km, o.rate_cents,
    o.trailer, o.trailer_plate, o.published_at, o.closed_at,
    /*
     * Дата появляется только у закрытого рейса: у незакрытого нет
     * момента, от которого её считать, и названная наугад дата хуже
     * честного пропуска.
     */
    case when o.status = 'DONE' then app.payout_period_start(app.closed_moment(o)) end,
    case when o.status = 'DONE' then app.payout_due(app.closed_moment(o)) end,
    /*
     * Контрагент показывается только оператору. Заказчик и перевозчик
     * работают с Aivomaa, а не друг с другом (ТЗ §1), и агент не должен
     * знать больше, чем знает тот, кто его спрашивает.
     */
    case when v_ctx.audience = 'ADMIN'
      then coalesce(sh.name, '') || ' → ' || coalesce(ca.name, '')
    end
  from public.orders o
  left join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  where upper(o.ref) = upper(btrim(p_ref))
    and (
      v_ctx.audience = 'ADMIN'
      or o.shipper_company_id = v_ctx.company_id
      or o.assigned_company_id = v_ctx.company_id
    );
end;
$$;

comment on function public.agent_order_by_ref(uuid, uuid, text) is
  'Карточка заказа для агента: единица, её размер и дата оплаты; контрагент — только оператору.';

revoke all on function public.agent_order_by_ref(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.agent_order_by_ref(uuid, uuid, text) to agent, service_role;


-- ── График оплат ───────────────────────────────────────────────────

/*
 * Периоды и даты оплаты по компании, а не по одному рейсу.
 *
 * Перевозчику это ответ на «когда деньги», заказчику — на «когда с меня
 * спишут»: правило одно, стороны разные. Комиссия и выплата остаются
 * делом перевозчика, как и в недельной сводке.
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
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);
  v_carrier := v_ctx.audience in ('CARRIER', 'DRIVER');

  return query
  select
    p.st,
    app.payout_period_end(p.st),
    p.due,
    (p.due - current_date)::integer,
    p.cnt,
    p.gross,
    case when v_carrier then p.payout end
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
        (v_carrier and o.assigned_company_id = v_ctx.company_id)
        or (not v_carrier and o.shipper_company_id = v_ctx.company_id)
      )
    group by 1, 2
  ) p
  order by p.st desc
  limit greatest(1, least(coalesce(p_periods, 6), 24));
end;
$$;

comment on function public.agent_payout_schedule(uuid, uuid, integer) is
  'График оплат по расчётным периодам: сколько за период и в какой день это платится.';

revoke all on function public.agent_payout_schedule(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.agent_payout_schedule(uuid, uuid, integer) to agent, service_role;
