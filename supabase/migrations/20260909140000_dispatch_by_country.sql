-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассылка идёт по стране забора
--
-- Рассылка уходила всем допущенным перевозчикам. Заказ из Эсбьерга
-- приходил в финскую компанию, которой он не нужен, и так — каждый раз.
-- Письмо, которое стабильно не про тебя, отучает читать все остальные,
-- включая то единственное, ради которого рассылка и заведена.
--
-- Страна, а не город. Город на сверку не годится: база машины —
-- свободный текст, набранный руками, и в боевой базе лежит «Heslinki».
-- Страна с обеих сторон — код из двух букв под ограничением: у компании
-- companies.country заведена с первого дня именно на этот случай, у точки
-- маршрута order_stops.country приходит от геокодера вместе с
-- координатой.
--
-- СТРАНА НЕИЗВЕСТНА — ШЛЁМ ВСЕМ. Это не мягкость, а выбор меньшего зла:
-- пустая страна у забора превратила бы строгую сверку в тишину, и заказ
-- не ушёл бы никому. Лишнее письмо человек удалит, ненаписанного не
-- заметит никто. Восемь заказов боевой базы созданы 2–3 сентября, а
-- колонка заведена 5-го, — у всех них страна пуста, и правило это
-- касается их напрямую.
--
-- ОДНО ОПРЕДЕЛЕНИЕ КРУГА. Прежде «кто получает» стояло дважды: в
-- триггере и в функции для почтового слоя. Пока условие было одно слово,
-- это сходило с рук; со страной они разошлись бы на первой же правке и
-- дали бы письмо тому, кому колокольчик не звонил. Теперь круг считает
-- app.dispatch_audience, а оба потребителя только читают из неё.
--
-- Стол по-прежнему показывает всё. Рассылка — это толчок, и она
-- прицельная; стол — это витрина, и на неё ходят смотреть сами. Финн,
-- которому нужен датский рейс, найдёт его руками.
-- ═══════════════════════════════════════════════════════════════════


-- ── Кому этот заказ ────────────────────────────────────────────────

create or replace function app.dispatch_audience(p_order_id uuid)
returns setof public.companies
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.companies c
  where c.kind = 'CARRIER'
    and c.status = 'ACTIVE'
    and c.frozen_at is null
    /* Тот же гейт, что у стола: допущенная машина и документы компании. */
    and app.has_dispatchable_vehicle(c.id)
    and exists (
      select 1
      from public.orders o
      join public.order_stops p on p.order_id = o.id and p.role = 'PICKUP'
      where o.id = p_order_id
        and o.status = 'OPEN'
        and (p.country is null or p.country = c.country)
    );
$$;

comment on function app.dispatch_audience(uuid) is
  'Перевозчики, которым рассылается заказ: допуск как у стола плюс совпадение страны забора.';

revoke all on function app.dispatch_audience(uuid) from public, anon, authenticated;


-- ── Уведомление в кабинет ──────────────────────────────────────────

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
      'to', coalesce(delivery.city, pickup.city, '')
    ),
    '/carrier/desk'
  from app.dispatch_audience(new.id) a
  left join public.order_stops pickup
    on pickup.order_id = new.id and pickup.role = 'PICKUP'
  left join public.order_stops delivery
    on delivery.order_id = new.id and delivery.role = 'DELIVERY';

  return new;
end;
$$;

comment on function app.on_order_published() is
  'Рассылка о новом заказе перевозчикам страны забора (ТЗ §6).';


-- ── Кому дублировать письмом ───────────────────────────────────────

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
  select a.id, a.name, a.contact_email, a.language
  from app.dispatch_audience(p_order_id) a
  order by a.name;
$$;

comment on function public.order_dispatch_recipients(uuid) is
  'Перевозчики, которым дублируется письмом новый заказ. Круг тот же, что у уведомлений.';

revoke all on function public.order_dispatch_recipients(uuid) from public, anon, authenticated;
grant execute on function public.order_dispatch_recipients(uuid) to service_role;
