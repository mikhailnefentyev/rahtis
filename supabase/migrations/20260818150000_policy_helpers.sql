-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · политики точек маршрута после колоночных грантов
--
-- Починка того, что сломала предыдущая миграция.
--
-- Скрывая исполнителя, она заменила табличный грант select на orders
-- поимённым. Побочный эффект оказался неочевидным: политики order_stops
-- и order_events проверяют принадлежность заказа выражением
--
--     exists (select 1 from public.orders o where o.id = order_id and …)
--
-- а выражения политик выполняются с правами вызывающего. `select 1` не
-- ссылается ни на одну колонку, и в этом случае Postgres требует именно
-- ТАБЛИЧНУЮ привилегию — колоночные её не заменяют. Заказчик перестал
-- видеть точки собственных заказов, получая «permission denied for table
-- orders». В интерфейсе это выглядело как заказ без маршрута.
--
-- Вторая половина проблемы: две политики сверяются с assigned_company_id,
-- а его теперь нет ни у кого из authenticated — сломался бы и перевозчик.
--
-- Обе чинятся одним приёмом, уже принятым в проекте для app.is_admin():
-- проверка уезжает в функцию с security definer. Внутри неё права
-- вызывающего не действуют, поэтому ни табличный грант, ни доступ к
-- колонке исполнителя вызывающему больше не нужны.
-- ═══════════════════════════════════════════════════════════════════

/*
 * Заказ принадлежит компании вызывающего как заказчику.
 *
 * stable, а не volatile: планировщик вправе вычислить её один раз на
 * значение аргумента вместо одного раза на строку.
 */
create or replace function app.owns_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.shipper_company_id = app.current_company_id()
  );
$$;

comment on function app.owns_order(uuid) is
  'Заказ принадлежит компании вызывающего. Definer: политике не нужен грант на orders.';

/*
 * Заказ закреплён за компанией вызывающего как за перевозчиком.
 *
 * Читает assigned_company_id, который authenticated не выдаётся вовсе:
 * заказчику его знать нельзя, а перевозчику достаточно ответа «да» или
 * «нет» про конкретный заказ, а не самой колонки.
 */
create or replace function app.carries_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.assigned_company_id = app.current_company_id()
  );
$$;

comment on function app.carries_order(uuid) is
  'Заказ закреплён за компанией вызывающего как за перевозчиком.';

revoke all on function app.owns_order(uuid) from public, anon;
revoke all on function app.carries_order(uuid) from public, anon;
grant execute on function app.owns_order(uuid) to authenticated, service_role;
grant execute on function app.carries_order(uuid) to authenticated, service_role;


-- ── Политики через хелперы ─────────────────────────────────────────

/* Вызовы обёрнуты в подзапрос: так планировщик считает их один раз на
   запрос, а не один раз на строку — приём тот же, что у app.is_admin(). */

drop policy if exists order_stops_select_own on public.order_stops;
create policy order_stops_select_own
  on public.order_stops for select to authenticated
  using ((select app.owns_order(order_id)));

drop policy if exists order_stops_select_assigned on public.order_stops;
create policy order_stops_select_assigned
  on public.order_stops for select to authenticated
  using ((select app.carries_order(order_id)));

drop policy if exists order_events_select_own on public.order_events;
create policy order_events_select_own
  on public.order_events for select to authenticated
  using ((select app.owns_order(order_id)));
