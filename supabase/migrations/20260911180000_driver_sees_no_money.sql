-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · водитель получает рейс, а не деньги компании
--
-- Прогон всех инструментов по всем аудиториям показал расхождение в
-- одном месте, и оно там, где дороже всего.
--
-- Собственный канал водителя — driver_active_trips — ставку не отдаёт
-- вовсе: поля rate в нём нет, и это решение принято сознательно. А
-- инструменты кабинетов считают аудиторию DRIVER «стороной перевозчика»
-- наравне с CARRIER и отдают ей ставку рейса, дату выплаты, недельные
-- суммы компании и весь график оплат.
--
-- Один и тот же человек получал разный ответ в зависимости от того,
-- каким путём спросил. Деньги — дело компании, а не того, кто сидит за
-- рулём: водитель наёмный, и заработок работодателя ему не показывают.
--
-- Сегодня это не выстрелило только потому, что тредов с аудиторией
-- DRIVER никто не создаёт: /api/agent/ask ставит роль вошедшего, а таких
-- пользователей не бывает. Но схема треда прямо предусматривает приход
-- водителя из WhatsApp — комментарий к колонке channel написан именно об
-- этом. Дыра, которая откроется в тот день, когда её заведут.
--
-- Отказ, а не пустая выдача. Пустой ответ на вопрос про деньги выглядит
-- как «ничего не заработали», и его не с чем сравнить; отказ агент
-- перескажет человеку словами.
-- ═══════════════════════════════════════════════════════════════════

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
  v_driver boolean;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);
  v_driver := v_ctx.audience = 'DRIVER';

  return query
  select
    o.ref, o.status, o.order_type, o.haul_kind, o.container_feet, o.distance_km,
    /*
     * Ставка водителю не показывается. Не из секретности, а по
     * последовательности: собственный канал водителя, driver_active_trips,
     * не отдаёт её вовсе — ни поля rate там нет. Инструменты кабинетов
     * отдавали, и один и тот же человек получал разный ответ в
     * зависимости от того, каким путём спросил. Деньги — дело компании,
     * а не того, кто сидит за рулём.
     */
    case when not v_driver then o.rate_cents end,
    o.trailer, o.trailer_plate, o.published_at, o.closed_at,
    /*
     * Дата появляется только у закрытого рейса: у незакрытого нет
     * момента, от которого её считать, и названная наугад дата хуже
     * честного пропуска.
     */
    case when o.status = 'DONE' and not v_driver then app.payout_period_start(app.closed_moment(o)) end,
    case when o.status = 'DONE' and not v_driver then app.payout_due(app.closed_moment(o)) end,
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
  'Карточка заказа для агента: единица и её размер; деньги — всем, кроме водителя; контрагент — только оператору.';

revoke all on function public.agent_order_by_ref(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.agent_order_by_ref(uuid, uuid, text) to agent, service_role;


-- ── Деньги компании водителю не показываются ───────────────────────

/*
 * Отказ стоит до выборки, а не после: он про право спросить, а не про
 * то, что нашлось. Код 42501 разбирается в админке и у агента как
 * «не положено», и тот перескажет человеку словами, а не покажет ноль.
 */
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

  if v_ctx.audience = 'DRIVER' then
    raise exception 'Суммы компании водителю не показываются. Спросите у своей транспортной компании.'
      using errcode = '42501';
  end if;

  v_carrier := v_ctx.audience = 'CARRIER';
  v_admin := v_ctx.audience = 'ADMIN';

  return query
  select
    app.report_week(app.closed_moment(o)) as w,
    count(*)::integer,
    sum(coalesce(o.rate_cents, 0))::bigint,
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
  'Деньги по неделям: своей компании — стороне, всей платформы — оператору. Водителю отказ.';

revoke all on function public.agent_company_money(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.agent_company_money(uuid, uuid, integer) to agent, service_role;


-- ── График оплат: тот же отказ водителю ────────────────────────────

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

  if v_ctx.audience = 'DRIVER' then
    raise exception 'График оплат водителю не показывается. Спросите у своей транспортной компании.'
      using errcode = '42501';
  end if;

  v_carrier := v_ctx.audience = 'CARRIER';
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
  'Расчётные периоды: заказчику срок счёта, перевозчику день выплаты, оператору обе даты. Водителю отказ.';

revoke all on function public.agent_payout_schedule(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.agent_payout_schedule(uuid, uuid, integer) to agent, service_role;
