-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · заказчик не видит, какая компания везёт
--
-- Aivomaa — принципал-посредник (ТЗ §1): заказчик платит оператору полную
-- ставку, оператор платит перевозчику за вычетом комиссии. Юридически
-- контрагент заказчика — Aivomaa, и в его кабинете исполнителем обязана
-- значиться Aivomaa. Подрядчики оператора — дело оператора.
--
-- До этой миграции утекало в трёх местах сразу, и закрывать нужно все
-- три: название компании в offers_for_shipper, идентификатор компании там
-- же и в самой таблице order_offers, и assigned_company_id в orders.
-- Даже голый идентификатор без названия позволяет сопоставлять заказы
-- между собой — «этот перевозчик у нас уже был».
--
-- Чего эта миграция НЕ даёт: полной анонимности. Госномер пробивается по
-- реестру Traficom, в CMR на закрытии рейса стоит настоящий перевозчик,
-- водитель физически приезжает. Здесь закрыт лёгкий обход — собрать
-- список подрядчиков одним взглядом из интерфейса. От целенаправленного
-- обхода защищает оговорка о непереманивании в договоре, а это вне кода.
-- ═══════════════════════════════════════════════════════════════════

-- ── Отклики глазами заказчика ──────────────────────────────────────

drop function if exists public.offers_for_shipper(uuid[]);

create function public.offers_for_shipper(p_order_ids uuid[])
returns table (
  order_id uuid,
  offer_id uuid,

  /*
   * Порядковый номер отклика внутри заказа — «Вариант 1», «Вариант 2».
   * Заказчику нужно на что-то указать при выборе, а названия компании у
   * него больше нет. Номер живёт только на время выбора и ничего не
   * значит за пределами этого заказа.
   *
   * Не position: это зарезервированное слово Postgres.
   */
  variant_no smallint,

  /* Рейтинг остаётся: по нему заказчик и выбирает (ТЗ §6). */
  rating numeric,

  /*
   * Характеристики машины без опознавательных признаков. Заказчику они
   * нужны по делу: пройдёт ли сцепка по его площадке, успеет ли машина
   * из своей базы к окну погрузки.
   */
  make text,
  axles smallint,
  euro_class public.euro_class,
  base_city text,
  languages text[],

  /*
   * Госномер и водитель — только у назначенной машины.
   *
   * До выбора они не нужны и работают опознавательным признаком. После
   * выбора без них не выписать пропуск в порт и не предупредить терминал,
   * кого ждать. Поэтому колонки есть всегда, а значения появляются
   * в момент назначения.
   */
  plate text,
  driver_name text,

  is_chosen boolean,
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
  with claims as (
    select
      f.order_id,
      f.vehicle_id,
      f.id as offer_id,
      f.created_at,
      0 as prio
    from public.order_offers f
    where f.order_id = any(p_order_ids)

    union all

    /*
     * Назначение берётся и из самого заказа: связь «кто везёт» обязана
     * переживать любую уборку order_offers.
     */
    select
      o.id,
      o.assigned_vehicle_id,
      o.chosen_offer_id,
      o.updated_at,
      1
    from public.orders o
    where o.id = any(p_order_ids)
      and o.assigned_vehicle_id is not null
  ),
  claim as (
    select distinct on (c.order_id, c.vehicle_id) c.*
    from claims c
    order by c.order_id, c.vehicle_id, c.prio
  ),
  numbered as (
    select
      claim.*,
      row_number() over (partition by claim.order_id order by claim.created_at)::smallint as pos
    from claim
  )
  select
    n.order_id,
    n.offer_id,
    n.pos,
    /* Оценок пока нет — таблица появится на Этапе 7. */
    null::numeric,
    v.make,
    v.axles,
    v.euro_class,
    v.base_city,
    v.languages,
    case when o.assigned_vehicle_id is not distinct from n.vehicle_id then v.plate end,
    case when o.assigned_vehicle_id is not distinct from n.vehicle_id then v.driver_name end,
    o.chosen_offer_id is not distinct from n.offer_id,
    o.assigned_vehicle_id is not distinct from n.vehicle_id,
    n.created_at
  from numbered n
  join public.orders o on o.id = n.order_id
  join public.vehicles v on v.id = n.vehicle_id
  where v_is_admin or o.shipper_company_id = v_company_id
  order by n.order_id, n.created_at;
end;
$$;

comment on function public.offers_for_shipper(uuid[]) is
  'Отклики глазами заказчика: без компании-перевозчика, без телефона водителя.';

revoke all on function public.offers_for_shipper(uuid[]) from public, anon;
grant execute on function public.offers_for_shipper(uuid[]) to authenticated, service_role;


-- ── Прямое чтение откликов заказчику больше не даётся ──────────────

/*
 * Политика отдавала строку order_offers целиком, вместе с
 * carrier_company_id. Заказчик читает отклики только через функцию выше,
 * где состав колонок записан явно.
 */
drop policy if exists order_offers_select_shipper on public.order_offers;


-- ── Колонки назначения скрыты у самой таблицы заказов ──────────────

/*
 * Табличный грант select заменяется поимённым.
 *
 * Причина та же, по которой статус компании нельзя сменить из браузера:
 * RLS работает построчно и не умеет прятать отдельные колонки. Заказчик
 * имеет полное право читать свой заказ — но не ту его часть, где записан
 * исполнитель.
 *
 * Перевозчик от этого ничего не теряет: свои рейсы он читает через
 * my_assignments, а функции с security definer колоночные гранты не
 * ограничивают.
 *
 * Список поимённый и это осознанно: новая колонка не станет видимой сама
 * собой, её придётся дописать сюда руками — то есть подумав.
 */
revoke select on public.orders from authenticated;

grant select (
  id, ref, shipper_ref,
  shipper_company_id, shipper_company_kind,
  order_type, trailer, distance_km, rate_cents, comment,
  status, published_at, deadline_at,
  created_by, created_at, updated_at,
  distance_source, distance_auto_km,
  route_geometry, route_bounds, route_computed_at, route_fingerprint
) on public.orders to authenticated;

comment on column public.orders.assigned_company_id is
  'Перевозчик рейса. Заказчику не отдаётся: его контрагент — Aivomaa (ТЗ §1).';
