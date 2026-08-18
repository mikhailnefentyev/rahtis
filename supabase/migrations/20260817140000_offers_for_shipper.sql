-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 5 · что заказчик видит о перевозчике
--
-- Починка бага, из-за которого в откликах вместо машины стояли прочерки.
--
-- Причина была не в данных и не в разметке. Заказчик тянул машину и
-- компанию вложенными связями PostgREST, а RLS применяется к вложенным
-- ресурсам отдельно: политик на vehicles у заказчика нет вовсе
-- (vehicles_select_own — своя компания, vehicles_select_admin — оператор),
-- поэтому вложенный объект приходил пустым. Заглушки в коде превращали
-- отказ доступа в «0 осей · — · —», и выглядело это как незаполненная
-- карточка машины.
--
-- Политику «заказчику видны машины, откликнувшиеся на его заказ» не
-- добавляем по двум причинам. Она отдала бы строку vehicles целиком,
-- вместе с whatsapp водителя — персональными данными, которые заказчику
-- не нужны (ТЗ §14). И она означала бы EXISTS по order_offers на каждую
-- строку vehicles.
--
-- Вместо этого — тот же приём, что у desk_orders и my_assignments: одна
-- функция, в которой явным списком колонок записано, что именно заказчик
-- видит о перевозчике. Телефона водителя в этом списке нет.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.offers_for_shipper(p_order_ids uuid[])
returns table (
  order_id uuid,
  offer_id uuid,
  carrier_company_id uuid,
  carrier_name text,
  vehicle_id uuid,
  plate text,
  driver_name text,
  axles smallint,
  make text,
  euro_class public.euro_class,
  base_city text,
  languages text[],
  /*
   * Средний рейтинг компании-перевозчика. Таблицы оценок в схеме пока
   * нет — она появится на Этапе 7 вместе с формой выставления оценки.
   * Колонка здесь с самого начала, чтобы Этап 7 менял одно выражение
   * внутри функции, а не сигнатуру, типы и разметку заодно.
   */
  rating numeric,
  /* Этот отклик выбран заказчиком (AWAIT_DRIVER). */
  is_chosen boolean,
  /* Эта машина закреплена за заказом — она и везёт груз (IN_PROGRESS). */
  is_assigned boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_is_admin boolean;
begin
  v_company_id := (select app.current_company_id());
  v_is_admin := (select app.is_admin());

  return query
  /*
   * Отклики и назначение сводятся в один список.
   *
   * Назначение берётся из самого заказа, а не только из откликов: связь
   * «кто везёт» обязана переживать любую уборку order_offers. Сегодня
   * отклики стираются лишь при откате и истечении срока, а те заодно
   * снимают и назначение — но опираться на это значило бы поставить
   * видимость исполнителя в зависимость от порядка удаления строк.
   */
  with claims as (
    select
      f.order_id,
      f.vehicle_id,
      f.carrier_company_id,
      f.id as offer_id,
      f.created_at,
      0 as prio
    from public.order_offers f
    where f.order_id = any(p_order_ids)

    union all

    select
      o.id,
      o.assigned_vehicle_id,
      o.assigned_company_id,
      o.chosen_offer_id,
      o.updated_at,
      1
    from public.orders o
    where o.id = any(p_order_ids)
      and o.assigned_vehicle_id is not null
  ),
  /* Машина показывается один раз: строка отклика важнее строки назначения. */
  claim as (
    select distinct on (c.order_id, c.vehicle_id) c.*
    from claims c
    order by c.order_id, c.vehicle_id, c.prio
  )
  select
    claim.order_id,
    claim.offer_id,
    claim.carrier_company_id,
    carrier.name,
    claim.vehicle_id,
    v.plate,
    v.driver_name,
    v.axles,
    v.make,
    v.euro_class,
    v.base_city,
    v.languages,
    null::numeric,
    o.chosen_offer_id is not distinct from claim.offer_id,
    o.assigned_vehicle_id is not distinct from claim.vehicle_id,
    claim.created_at
  from claim
  join public.orders o on o.id = claim.order_id
  join public.vehicles v on v.id = claim.vehicle_id
  join public.companies carrier on carrier.id = claim.carrier_company_id
  /* Свои заказы — заказчику, любые — оператору. Чужие — никому. */
  where v_is_admin or o.shipper_company_id = v_company_id
  order by claim.order_id, claim.created_at;
end;
$$;

comment on function public.offers_for_shipper(uuid[]) is
  'Отклики и назначенная машина глазами заказчика: без телефона водителя (ТЗ §14).';

revoke all on function public.offers_for_shipper(uuid[]) from public, anon;
grant execute on function public.offers_for_shipper(uuid[]) to authenticated, service_role;
