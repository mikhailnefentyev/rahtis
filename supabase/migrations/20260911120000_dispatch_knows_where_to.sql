-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассылка узнала, куда едет заказ
--
-- Вчерашняя рассылка берёт город назначения из точки с ролью DELIVERY.
-- Такой роли у большинства заказов нет: форма публикации добавляет
-- выгрузки и загрузки кнопками, то есть ролями EXTRA_UNLOAD и
-- EXTRA_LOAD. В боевой базе шесть заказов из девяти устроены, например,
-- как PICKUP → EXTRA_UNLOAD → EXTRA_LOAD → TRAILER_RETURN.
--
-- Из-за coalesce(delivery.city, pickup.city) письмо и уведомление
-- показывали таким заказам «Hanko → Hanko»: второй конец молча
-- подменялся первым. Ошибка тихая — ничего не падает, просто половина
-- маршрута неверна, и заметить это можно только прочитав письмо.
--
-- Куда — это последняя точка работы: не забор и не отцепка. Отцепка на
-- эту роль не годится: у перецепа прицеп нередко возвращают туда же,
-- откуда взяли, и «Hanko → Hanko» снова ничего не скажет. Если работы
-- нет вовсе — а такой заказ опубликовать нельзя, но прочитать можно, —
-- берётся отцепка: она хотя бы существует.
--
-- Стол это уже умеет: там поле называется finish_city и берёт последнюю
-- точку по порядку. Разница намеренная и видна из имён: у стола «где
-- рейс кончится», здесь «куда идёт груз».
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.route_end(p_order_id uuid)
returns public.order_stops
language sql
stable
set search_path = ''
as $$
  select s.*
  from public.order_stops s
  where s.order_id = p_order_id
    and s.role not in ('PICKUP', 'TRAILER_RETURN')
  order by s.sequence desc
  limit 1;
$$;

comment on function app.route_end(uuid) is
  'Последняя точка работы заказа: куда идёт груз. Не забор и не отцепка.';

revoke all on function app.route_end(uuid) from public, anon, authenticated;


-- ── Уведомление о публикации ───────────────────────────────────────

create or replace function app.on_order_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  /* Только первый выход на стол. Возврат на стол — не публикация. */
  if not (old.status = 'DRAFT' and new.status = 'OPEN') then
    return new;
  end if;

  insert into public.notifications (company_id, kind, code, params, link)
  select
    a.id,
    'ORDER',
    'order.published',
    jsonb_build_object(
      'ref', new.ref,
      'from', coalesce(pickup.city, ''),
      /*
       * Отцепка запасным вариантом, а не город забора: подменять второй
       * конец первым — это и была прежняя ошибка.
       */
      'to', coalesce(finish.city, ret.city, '')
    ),
    '/carrier/desk'
  from app.dispatch_audience(new.id) a
  left join public.order_stops pickup
    on pickup.order_id = new.id and pickup.role = 'PICKUP'
  left join public.order_stops ret
    on ret.order_id = new.id and ret.role = 'TRAILER_RETURN'
  left join lateral app.route_end(new.id) finish on true;

  return new;
end;
$$;

comment on function app.on_order_published() is
  'Рассылка о новом заказе перевозчикам страны забора (ТЗ §6).';


-- ── Карточка заказа для письма ─────────────────────────────────────

create or replace function public.order_dispatch_card(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ref', o.ref,
    'haul_kind', o.haul_kind,
    'container_feet', o.container_feet,
    'trailer', o.trailer,
    'distance_km', o.distance_km,
    'rate_cents', o.rate_cents,
    'pickup_city', pickup.city,
    'pickup_place', coalesce(pickup.place_name, pickup.city),
    'pickup_date', pickup.scheduled_date,
    'pickup_time', pickup.scheduled_time,
    'delivery_city', coalesce(finish.city, ret.city)
  )
  from public.orders o
  left join public.order_stops pickup
    on pickup.order_id = o.id and pickup.role = 'PICKUP'
  left join public.order_stops ret
    on ret.order_id = o.id and ret.role = 'TRAILER_RETURN'
  left join lateral app.route_end(o.id) finish on true
  where o.id = p_order_id and o.status = 'OPEN';
$$;

comment on function public.order_dispatch_card(uuid) is
  'Заказ для письма-рассылки: те же поля, что на столе, без контактов получателя.';

revoke all on function public.order_dispatch_card(uuid) from public, anon, authenticated;
grant execute on function public.order_dispatch_card(uuid) to service_role;
