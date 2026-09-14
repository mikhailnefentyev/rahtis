-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · карта транспорта в кабинете заказчика
--
-- Заказчик публикует заказ вслепую: он не знает, есть ли в его городе
-- хоть один допущенный фургон, и узнаёт об этом только тем, что никто не
-- откликнулся. Для платформы, которая обещает быстро закрывать
-- перевозки при изменениях, это худший способ отвечать на вопрос «есть
-- ли кому везти».
--
-- Карта отвечает на него до публикации. Точка на городе и число машин —
-- этого достаточно, чтобы решить, ждать ли отклика сегодня или звонить
-- своим. Свободна машина прямо сейчас или в рейсе — намеренно не
-- показывается: «свободна» живёт часами и требует, чтобы перевозчик её
-- поддерживал, а устаревшая свобода хуже её отсутствия. Парк меняется
-- месяцами и не врёт.
--
-- ЧТО НЕ УХОДИТ НАРУЖУ. Ни имени компании, ни номера машины, ни адреса
-- базы. Заказчик видит «в Тампере три тягача», а не чьи именно: парк
-- перевозчика — его коммерческая тайна, и раскрывать её, чтобы нарисовать
-- точку, незачем.
--
-- ОТКУДА КООРДИНАТА. База машины до сих пор была свободным текстом,
-- который перевозчик набирает руками, — и в боевой базе уже лежит
-- «Heslinki». Про это прямо написано в миграции рассылки: «Регион
-- вернётся, когда у базы машины появится тот же выбор из справочника,
-- что и у точки маршрута. Тогда сверять будет что». Здесь это и
-- происходит: у базы появляется координата от геокодера, а сам текст
-- остаётся — по нему подписывается точка.
--
-- Существующим машинам координата не проставляется миграцией. Угадывать
-- за перевозчика, какой город он имел в виду, набрав «Heslinki», — не
-- дело схемы; это разовая работа скриптом, где виден результат.
-- ═══════════════════════════════════════════════════════════════════

alter table public.vehicles
  add column base_lat double precision,
  add column base_lon double precision,
  add column base_country text,

  add constraint vehicles_base_position_pair
    check ((base_lat is null) = (base_lon is null)),

  add constraint vehicles_base_position_range
    check (
      base_lat is null
      or (
        base_lat between -90 and 90
        and base_lon between -180 and 180
        and not (base_lat = 0 and base_lon = 0)
      )
    ),

  add constraint vehicles_base_country_shape
    check (base_country is null or base_country ~ '^[A-Z]{2}$');

comment on column public.vehicles.base_lat is
  'Координата базы машины от геокодера. Пусто у карточек, заполненных до появления подсказки адреса.';
comment on column public.vehicles.base_country is
  'Страна базы двумя буквами. Не заменяет companies.country: рассылка по-прежнему идёт по стране компании.';

/*
 * Колоночный грант обязателен: без него перевозчик не запишет базу, а
 * сохранение карточки отдаст отказ прав там, где человек видит обычную
 * форму. На этом уже обжигались с trailer_plate, adr и container_feet.
 */
grant update (base_lat, base_lon, base_country) on public.vehicles to authenticated;


-- ── Где вообще есть транспорт ──────────────────────────────────────

/*
 * Точки собираются по городам, а не по машинам.
 *
 * Группировка — это и есть защита: одна строка на город не даёт
 * сопоставить машину с компанией, сколько бы их там ни было.
 *
 * Группируется по названию города, а не по округлённой координате.
 * Округление пришлось бы выбирать между «режет город пополам» и
 * «сливает соседние», а название теперь приходит от геокодера вместе с
 * координатой — то есть пишется одинаково у всех, кто выбрал этот город
 * из подсказки. Страна в ключе потому, что Турку есть не только в
 * Финляндии.
 *
 * Координата точки — среднее по машинам города. Базы внутри одного
 * города стоят в разных промзонах, и рисовать пять точек в одном Вантаа
 * значило бы отвечать на вопрос «где стоят машины» вместо «есть ли
 * здесь машины». Заодно среднее — ещё один слой между картой и адресом
 * конкретной базы.
 *
 * Ветка, а не класс. Заказчику важно ровно одно: на чём тут возят —
 * единицами или грузом в кузове. Это тот же вопрос, по которому
 * разделена витрина, и второй способ его задать разошёлся бы с первым.
 */
create or replace function public.carrier_presence()
returns table (
  city text,
  country text,
  lat double precision,
  lon double precision,
  unit_vehicles integer,
  express_vehicles integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select app.current_party_role()) not in ('SHIPPER', 'ADMIN') then
    raise exception 'Карта транспорта доступна заказчику и оператору.' using errcode = '42501';
  end if;

  return query
  select
    min(btrim(v.base_city))::text,
    max(v.base_country)::text,
    avg(v.base_lat)::double precision,
    avg(v.base_lon)::double precision,
    count(*) filter (where app.vehicle_branch(v.vehicle_class) = 'UNIT')::integer,
    count(*) filter (where app.vehicle_branch(v.vehicle_class) = 'EXPRESS')::integer
  from public.vehicles v
  join public.companies c on c.id = v.company_id
  where v.access = 'APPROVED'
    and v.base_lat is not null
    and c.kind = 'CARRIER'
    and c.status = 'ACTIVE'
    and c.frozen_at is null
    /* Документы просрочены — машина заказы не берёт, и на карте её нет. */
    and app.company_documents_ok(c.id)
  group by v.base_country, lower(btrim(v.base_city))
  order by 5 desc, 6 desc, 1;
end;
$$;

comment on function public.carrier_presence() is
  'Города, где есть допущенные машины, с числом по веткам. Без компаний, номеров и адресов.';

revoke all on function public.carrier_presence() from public, anon;
grant execute on function public.carrier_presence() to authenticated, service_role;
