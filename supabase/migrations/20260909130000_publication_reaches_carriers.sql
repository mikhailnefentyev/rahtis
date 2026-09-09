-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · публикация доходит до перевозчиков
--
-- ТЗ §6: заказчик публикует заказ → он появляется на столе И рассылается
-- перевозчикам. Стол был сделан, рассылки не было ни одной. Перевозчик
-- узнавал о заказе, только если сам в этот момент смотрел на стол, —
-- а пятнадцатиминутные сроки матчинга рассчитаны на то, что он узнаёт
-- сразу.
--
-- Уведомления пишет триггер, а не код публикации. Причина та же, по
-- которой так сделаны остальные события заказа: функцию можно переписать
-- и забыть про рассылку, а триггер видит саму строку. Заказ, выведенный
-- на стол любым путём, будет разослан.
--
-- КОМУ. Всем, у кого есть допущенная машина и в порядке документы
-- компании, — то есть ровно тем, кто и так видит этот заказ на столе.
-- Не по региону забора, хотя ТЗ говорит про регион, и это надо объяснить.
--
-- Во-первых, сам стол региона не знает: desk_orders берёт регион
-- параметром как фильтр, который перевозчик выбирает сам, а гейт у стола
-- один — допуск. Рассылка уже по региону обещала бы уже, чем показывает
-- продукт: перевозчик не получил бы письма о заказе, который ему открыт.
--
-- Во-вторых, региону не на чем держаться. База машины — свободный текст,
-- который перевозчик набирает руками, и в боевой базе уже лежит
-- «Heslinki». Сверка base_city с городом забора вычеркнула бы эту
-- компанию из всех рассылок навсегда и молча — худший вид поломки:
-- работает, а человек не получает ничего.
--
-- Регион вернётся, когда у базы машины появится тот же выбор из
-- справочника площадок, что и у точки маршрута. Тогда сверять будет что.
--
-- ПОВТОРНАЯ ПУБЛИКАЦИЯ НЕ РАССЫЛАЕТСЯ. Условие ловит только DRAFT → OPEN.
-- Заказ, вернувшийся на стол по истечении срока или отказу, уже поднимает
-- order.released, и рассылать его заново каждому — это выучить
-- перевозчика не читать наши уведомления.
-- ═══════════════════════════════════════════════════════════════════


-- ── Рассылка при публикации ────────────────────────────────────────

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

  /*
   * Точки к этому моменту на месте: create_order вставляет заказ
   * черновиком, пишет маршрут и только потом переводит в OPEN. Поэтому
   * города берутся здесь же, а не отдельным проходом.
   */
  insert into public.notifications (company_id, kind, code, params, link)
  select
    c.id,
    'ORDER',
    'order.published',
    jsonb_build_object(
      'ref', new.ref,
      'from', coalesce(pickup.city, ''),
      'to', coalesce(delivery.city, pickup.city, '')
    ),
    '/carrier/desk'
  from public.companies c
  left join public.order_stops pickup
    on pickup.order_id = new.id and pickup.role = 'PICKUP'
  left join public.order_stops delivery
    on delivery.order_id = new.id and delivery.role = 'DELIVERY'
  where c.kind = 'CARRIER'
    and c.status = 'ACTIVE'
    and c.frozen_at is null
    and app.has_dispatchable_vehicle(c.id);

  return new;
end;
$$;

comment on function app.on_order_published() is
  'Рассылка о новом заказе всем перевозчикам, которые видят его на столе (ТЗ §6).';

create trigger orders_notify_published
  after update of status on public.orders
  for each row execute function app.on_order_published();


-- ── Кому дублировать письмом ───────────────────────────────────────

/*
 * Тот же круг получателей, но с почтой и языком, — для почтового слоя
 * приложения. Триггер письмо отправить не может, а собирать этот список
 * в коде значит завести второе определение «кто видит заказ»: разойдясь,
 * они дадут письмо тому, кому заказ не открыт.
 *
 * Отдаётся только service_role. Заказчик, опубликовавший заказ, вызывает
 * это через серверное действие, и адреса перевозчиков в браузер не
 * уходят — они попадают прямо в письмо.
 *
 * Заказ не на столе — пусто. Письмо о заказе, который уже взяли или
 * отменили, зовёт на несуществующую работу.
 */
create or replace function public.order_dispatch_recipients(p_order_id uuid)
returns table (
  company_id uuid,
  company_name text,
  contact_email text,
  language text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.contact_email, c.language
  from public.companies c
  where c.kind = 'CARRIER'
    and c.status = 'ACTIVE'
    and c.frozen_at is null
    and app.has_dispatchable_vehicle(c.id)
    and exists (
      select 1 from public.orders o
      where o.id = p_order_id and o.status = 'OPEN'
    )
  order by c.name;
$$;

comment on function public.order_dispatch_recipients(uuid) is
  'Перевозчики, которым дублируется письмом новый заказ. Тот же круг, что видит его на столе.';

revoke all on function public.order_dispatch_recipients(uuid) from public, anon, authenticated;
grant execute on function public.order_dispatch_recipients(uuid) to service_role;


-- ── Что в письме ───────────────────────────────────────────────────

/*
 * Карточка заказа для письма: ровно те поля, что перевозчик видит на
 * столе до отклика. Контактов получателя здесь нет — до того как заказ
 * закреплён, это данные третьего лица, и в desk_orders их тоже нет.
 */
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
    'delivery_city', delivery.city
  )
  from public.orders o
  left join public.order_stops pickup
    on pickup.order_id = o.id and pickup.role = 'PICKUP'
  left join public.order_stops delivery
    on delivery.order_id = o.id and delivery.role = 'DELIVERY'
  where o.id = p_order_id and o.status = 'OPEN';
$$;

comment on function public.order_dispatch_card(uuid) is
  'Заказ для письма-рассылки: те же поля, что на столе, без контактов получателя.';

revoke all on function public.order_dispatch_card(uuid) from public, anon, authenticated;
grant execute on function public.order_dispatch_card(uuid) to service_role;
