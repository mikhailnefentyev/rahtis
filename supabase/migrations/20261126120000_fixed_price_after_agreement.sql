-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · сумма, согласованная вручную, больше не пересчитывается
--
-- Заказ с ценой «за км» (pricing_mode = 'PER_KM') держит сумму равной
-- rate_per_km_cents × distance_km, и apply_route_distance пересчитывает
-- её при каждой правке маршрута. Но стороны могут договориться о другой
-- сумме руками: заказчик или оператор — через reprice_order, любая
-- сторона — через предложение цены (propose_price →
-- respond_price_proposal). Заказ при этом оставался «за км», и следующая
-- правка точки, изменившая пробег, молча заменяла согласованную сумму
-- на ставку × новый пробег.
--
-- Решение пользователя 22.11.2026: сумма, согласованная вручную, делает
-- заказ заказом с фиксированной ценой. Если итог reprice_order или
-- принятого предложения не равен ставке за км × пробег, заказ переходит
-- в FIXED, ставка за км стирается (ограничение orders_rate_per_km
-- требует: ставка есть тогда и только тогда, когда режим PER_KM).
-- apply_route_distance такие заказы не трогает — для FIXED она отвечает
-- NONE, менять её не нужно.
--
-- Сумма, равная ставке × пробег, режим не меняет: так принимается
-- предложение перевозчика после правки маршрута (его готовит
-- apply_route_distance) и так заказчик вручную поправляет пробег, не
-- отходя от ставки.
--
-- Обе функции взяты из последних определений:
--   · reprice_order — 20260903120100_order_lifecycle с правками
--     20261012100000_own_orders_edit (свой заказ перевозчика) и
--     20261013120000_reprice_no_lowering (после назначения — только
--     повышение, код 55011);
--   · respond_price_proposal — 20261106170000_trust_quick_wins.
-- Права — как там же.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.reprice_order(
  p_order_id uuid,
  p_distance_km integer,
  p_rate_cents integer
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_party text;
  v_before public.orders;
  v_to_fixed boolean;
begin
  select * into v_order from public.orders where id = p_order_id;

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  v_party := app.order_party(v_order);

  if coalesce(v_party, '') not in ('SHIPPER', 'ADMIN')
     and not app.is_own_order_of_caller(v_order.shipper_company_id) then
    raise exception 'Пробег и ставку меняет заказчик или оператор.' using errcode = '42501';
  end if;

  if v_order.status in ('DONE', 'CANCELLED') then
    raise exception 'Пересчёт недоступен, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  if p_distance_km is null or p_rate_cents is null then
    raise exception 'Нужны и пробег, и ставка.' using errcode = '55000';
  end if;

  if v_order.assigned_company_id is not null
     and v_order.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
     and p_rate_cents < v_order.rate_cents
     and coalesce(v_party, '') <> 'ADMIN'
     and not app.is_own_order_of_caller(v_order.shipper_company_id) then
    raise exception 'Цену после назначения перевозчика можно только повышать.' using errcode = '55011';
  end if;

  /* Нечего записывать — и нечего слать перевозчику как правку. */
  if v_order.distance_km = p_distance_km and v_order.rate_cents = p_rate_cents then
    return v_order;
  end if;

  v_before := v_order;

  /*
   * Решение 22.11.2026: сумма, не равная ставке за км × пробег, названа
   * человеком — заказ становится заказом с фиксированной ценой, и правка
   * маршрута её больше не пересчитывает. Округление то же, что в
   * apply_route_distance.
   */
  v_to_fixed := v_order.pricing_mode = 'PER_KM'
    and p_rate_cents is distinct from
        greatest(1, round(v_order.rate_per_km_cents::numeric * p_distance_km))::integer;

  update public.orders
  set distance_km = p_distance_km,
      rate_cents = p_rate_cents,
      distance_source = 'MANUAL',
      pricing_mode = case when v_to_fixed then 'FIXED' else pricing_mode end,
      rate_per_km_cents = case when v_to_fixed then null else rate_per_km_cents end
  where id = p_order_id
  returning * into v_order;

  insert into public.order_amendments (order_id, kind, changes, actor_id)
  values (
    p_order_id,
    'ORDER_REPRICED',
    jsonb_build_object(
      'distance_km', jsonb_build_object('from', v_before.distance_km, 'to', p_distance_km),
      'rate_cents', jsonb_build_object('from', v_before.rate_cents, 'to', p_rate_cents)
    ),
    (select auth.uid())
  );

  return v_order;
end;
$$;

comment on function public.reprice_order(uuid, integer, integer) is
  'Меняет пробег и ставку заказа одним действием и пишет обе цифры в журнал. Сумма, не равная ставке за км × пробег, переводит заказ «за км» в фиксированную цену.';

revoke all on function public.reprice_order(uuid, integer, integer) from public, anon;
grant execute on function public.reprice_order(uuid, integer, integer) to authenticated, service_role;


/*
 * Ответ другой стороны. Принято — цена и пробег из предложения
 * становятся ценой рейса, отдельной строкой ORDER_REPRICED.
 *
 * Решение 22.11.2026: принятая сумма, не равная ставке за км × пробег
 * из предложения, — договорённость сторон; заказ «за км» становится
 * заказом с фиксированной ценой. Предложение, которое apply_route_distance
 * готовит после правки маршрута перевозчиком, равно ставке × новый
 * пробег и режим не меняет.
 */
create or replace function public.respond_price_proposal(p_amendment_id bigint, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.order_amendments;
  v_order public.orders;
  v_side text;
  v_rate integer;
  v_km integer;
  v_to_fixed boolean;
begin
  select * into v_row from public.order_amendments where id = p_amendment_id;
  if v_row.id is null or v_row.kind::text <> 'PRICE_PROPOSED' or v_row.proposal_status is distinct from 'PROPOSED' then
    raise exception 'Предложение не найдено или уже решено.' using errcode = '55000';
  end if;

  select * into v_order from public.orders where id = v_row.order_id;
  v_side := app.order_side_of_caller(v_order);
  if v_side is null or (v_side <> 'OPERATOR' and v_side = v_row.actor_side) then
    raise exception 'Отвечает другая сторона рейса.' using errcode = '42501';
  end if;
  if v_order.status not in ('AWAIT_DRIVER', 'IN_PROGRESS') then
    raise exception 'Рейс уже закрыт.' using errcode = '55000';
  end if;

  update public.order_amendments
  set proposal_status = case when p_accept then 'ACCEPTED' else 'DECLINED' end
  where id = p_amendment_id;

  if not p_accept then
    return;
  end if;

  v_rate := (v_row.changes -> 'rate_cents' ->> 'to')::integer;
  v_km := coalesce((v_row.changes -> 'distance_km' ->> 'to')::integer, v_order.distance_km);

  v_to_fixed := v_order.pricing_mode = 'PER_KM'
    and v_rate is distinct from
        greatest(1, round(v_order.rate_per_km_cents::numeric * v_km))::integer;

  update public.orders
  set rate_cents = v_rate,
      distance_km = v_km,
      pricing_mode = case when v_to_fixed then 'FIXED' else pricing_mode end,
      rate_per_km_cents = case when v_to_fixed then null else rate_per_km_cents end
  where id = v_order.id;

  insert into public.order_amendments (order_id, kind, changes, actor_id, reason)
  values (
    v_order.id,
    'ORDER_REPRICED',
    jsonb_build_object(
      'distance_km', jsonb_build_object('from', v_order.distance_km, 'to', v_km),
      'rate_cents', jsonb_build_object('from', v_order.rate_cents, 'to', v_rate)
    ),
    (select auth.uid()),
    v_row.reason
  );
end;
$$;

revoke all on function public.respond_price_proposal(bigint, boolean) from public, anon;
grant execute on function public.respond_price_proposal(bigint, boolean) to authenticated;
