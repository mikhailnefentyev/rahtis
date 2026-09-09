-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · водитель тоже узнаёт про порт
--
-- Вчера справочник площадок переехал в базу, и агент кабинетов перестал
-- молчать про порты. Второй канал остался прежним: driver_active_trips
-- сводит инструкции с точками по равенству place_key названию точки или
-- городу — а тридцать восемь платформенных строк лежат под ключами вида
-- helsinki-vuosaari. Заказчик пишет в названии «Vuosaari», в городе
-- стоит «Helsinki»; ни то ни другое со слагом не совпадает и совпасть не
-- может. Условие выполнимо только для строк, которые заказчик завёл сам
-- под своим же названием площадки, — таких нет ни одной.
--
-- То есть дефект, ради которого справочник переносили, на канале
-- водителя остался целиком. Причём именно там, где он и описан: у ворот
-- стоит водитель, а не диспетчер в кабинете.
--
-- ЧЕМ СВОДИТЬ. Названием нельзя: заказчик пишет его как хочет. Ключ
-- площадки до точки не доходит — подсказка адреса отдаёт форме адрес и
-- координату, а свой идентификатор теряет. Зато координата и есть
-- опознание: выбирая площадку из справочника, человек кладёт в точку ту
-- самую пару чисел, которая записана у площадки, — не похожую, а ту же.
--
-- Порог 150 метров. Он не «примерно рядом»: две ближайшие площадки
-- справочника — терминалы Viking и Silja в Турку — стоят в 361 метре
-- друг от друга, и таким порогом соседа не достать. Точка, набранная
-- адресом вручную где-то на портовой территории, инструкции не получит:
-- назвать наугад один из двух терминалов в трёхстах метрах хуже, чем не
-- назвать никакого.
--
-- ЯЗЫК. Площадка лежит двумя строками, и до сих пор водителю уходили
-- обе: тот же порт дважды, финской строкой и английской. Вчера это
-- починили в инструменте кабинетов; здесь язык берётся из языков
-- водителя в карточке машины. Если нужного языка у площадки нет —
-- отдаётся тот, что есть: инструкция не на том языке полезнее молчания,
-- адрес и координату человек у ворот разберёт.
-- ═══════════════════════════════════════════════════════════════════


-- ── Расстояние между двумя точками ─────────────────────────────────

/*
 * Гаверсинус. PostGIS ради одного сравнения не подключается, а вычитать
 * координаты напрямую нельзя: градус долготы в Эсбьерге и в Кеми — это
 * разные расстояния, и один порог на оба не ложится.
 */
create or replace function app.metres_between(
  p_lat1 double precision, p_lon1 double precision,
  p_lat2 double precision, p_lon2 double precision
)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2))
      * power(sin(radians(p_lon2 - p_lon1) / 2), 2)
  ));
$$;

comment on function app.metres_between(double precision, double precision, double precision, double precision) is
  'Расстояние между двумя координатами в метрах, по гаверсинусу.';


-- ── Координата площадки ────────────────────────────────────────────

/*
 * Пусто у инструкций, написанных заказчиком: он заводит их на свой склад
 * и координат не знает. Такие по-прежнему сводятся по названию — ключ
 * своей площадке заказчик даёт сам и пишет его тем же словом.
 */
alter table public.place_guides
  add column lat double precision,
  add column lon double precision;

alter table public.place_guides
  add constraint place_guides_position_complete
    check ((lat is null) = (lon is null)),
  add constraint place_guides_position_sane
    check (lat is null or (lat between -90 and 90 and lon between -180 and 180));

comment on column public.place_guides.lat is
  'Широта ворот. Заполнена у площадок платформы: по ней инструкция находит точку рейса.';
comment on column public.place_guides.lon is
  'Долгота ворот. Пустая у инструкций заказчика — те сводятся по названию.';

/*
 * Координаты те же, что в теле строк и в src/lib/routing/places.ts:
 * ответ геокодера на адреса, названные оператором. Обе строки площадки,
 * финская и английская, получают одну точку — ворота у них общие.
 */
update public.place_guides g
set lat = p.lat, lon = p.lon
from (values
  ('hanko-port', 59.824178, 22.96404),
  ('helsinki-vuosaari', 60.213578, 25.172049),
  ('helsinki-lansisatama', 60.149625, 24.916633),
  ('helsinki-etelasatama', 60.160774, 24.957726),
  ('helsinki-katajanokka', 60.163838, 24.96835),
  ('rauma-port', 61.129872, 21.466139),
  ('kotka-hietanen', 60.479838, 26.942221),
  ('naantali-port', 60.457947, 22.043417),
  ('turku-viking', 60.433165, 22.222195),
  ('turku-silja', 60.435567, 22.217776),
  ('hamina-port', 60.539762, 27.161054),
  ('pori-mantyluoto', 61.592165, 21.493232),
  ('vaasa-wasaline', 63.087635, 21.557295),
  ('kokkola-port', 63.843609, 23.058471),
  ('oulu-oritkari', 64.991073, 25.426792),
  ('kemi-ajos', 65.668129, 24.529924),
  ('umea-holmsund', 63.681067, 20.339712),
  ('stockholm-varta', 59.351467, 18.112716),
  ('stockholm-tegelvik', 59.316, 18.0958),
  ('kapellskar', 59.722722, 19.061172),
  ('stockholm-norvik', 58.937555, 17.9745),
  ('goteborg-portentry', 57.701867, 11.858883),
  ('goteborg-stena-dk', 57.701187, 11.946307),
  ('helsingborg-gate', 56.028709, 12.700896),
  ('malmo-finnlines', 55.629423, 13.008892),
  ('trelleborg-port', 55.373539, 13.142069),
  ('stromstad-colorline', 58.935797, 11.170935),
  ('oslo-yilport', 59.888232, 10.755263),
  ('oslo-colorline', 59.909079, 10.713785),
  ('oslo-vippetangen', 59.90293, 10.74314),
  ('larvik-colorline', 59.040573, 10.047404),
  ('kristiansand-colorline', 58.144565, 7.991197),
  ('sandefjord-colorline', 59.126944, 10.228017),
  ('frederikshavn-dfds', 57.43459, 10.537014),
  ('frederikshavn-stena', 57.434581, 10.54364),
  ('hirtshals-colorline', 57.576132, 9.986374),
  ('kobenhavn-dfds', 55.70116, 12.595405),
  ('esbjerg-dfds', 55.453823, 8.488956)
) as p (place_key, lat, lon)
where g.place_key = p.place_key
  and g.company_id is null;


-- ── Что у водителя в работе ────────────────────────────────────────

create or replace function public.driver_active_trips(p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(trip order by trip->>'ref'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'ref', o.ref,
      'status', o.status,
      'order_type', o.order_type,
      'trailer', o.trailer,
      'trailer_plate', o.trailer_plate,
      'haul_kind', o.haul_kind,
      'container_feet', o.container_feet,
      'distance_km', o.distance_km,
      'comment', o.comment,

      'vehicle', jsonb_build_object(
        'plate', v.plate,
        'driver_name', v.driver_name,
        'languages', v.languages
      ),

      /* Этап выводится из точек, как и везде в продукте (ТЗ §7). */
      'progress', jsonb_build_object(
        'done', (select count(*) from public.order_stops s
                 where s.order_id = o.id and s.completed_at is not null),
        'total', (select count(*) from public.order_stops s where s.order_id = o.id),
        'next', (select jsonb_build_object('sequence', s.sequence, 'role', s.role,
                                           'place', coalesce(s.place_name, s.company_name, s.city))
                 from public.order_stops s
                 where s.order_id = o.id and s.completed_at is null
                 order by s.sequence limit 1)
      ),

      'stops', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'sequence', s.sequence,
          'role', s.role,
          'place_name', s.place_name,
          'place_kind', s.place_kind,
          'company_name', s.company_name,
          'address', s.address,
          'city', s.city,
          'scheduled_date', s.scheduled_date,
          'scheduled_time', s.scheduled_time,
          'consignee', s.consignee,
          'contact_name', s.contact_name,
          'contact_phone', s.contact_phone,
          'cargo_weight_kg', s.cargo_weight_kg,
          'seal_required', s.seal_required,
          'trailer_loaded', s.trailer_loaded,
          /* Инструкции к точке. Здесь же живёт номер брони или пропуска. */
          'note', s.note,
          'completed_at', s.completed_at
        ) order by s.sequence), '[]'::jsonb)
        from public.order_stops s where s.order_id = o.id
      ),

      /*
       * Инструкции площадок: общие платформенные плюс написанные
       * заказчиком этого рейса. Чужих заказчиков здесь быть не может —
       * компания берётся из самого заказа, а не из запроса.
       *
       * Площадка платформы опознаётся координатой точки, своя площадка
       * заказчика — названием: ключ ей даёт он сам. Каждая отдаётся один
       * раз и на языке водителя.
       */
      'guides', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'place_key', g.place_key,
          'locale', g.locale,
          'title', g.title,
          'body', g.body,
          'from_shipper', g.company_id is not null
        ) order by (g.company_id is not null) desc, g.place_key), '[]'::jsonb)
        from (
          select distinct on (pg.place_key, pg.company_id)
                 pg.place_key, pg.locale, pg.title, pg.body, pg.company_id
          from public.place_guides pg
          where (pg.company_id is null or pg.company_id = o.shipper_company_id)
            and exists (
              select 1 from public.order_stops s
              where s.order_id = o.id
                and (
                  (pg.lat is not null and s.lat is not null
                   and app.metres_between(pg.lat, pg.lon, s.lat, s.lon) <= 150)
                  or lower(pg.place_key) = lower(coalesce(s.place_name, ''))
                  or lower(pg.place_key) = lower(s.city)
                )
            )
          order by pg.place_key, pg.company_id,
                   /* Язык водителя первым; нет его у площадки — остаётся другой. */
                   (pg.locale = case when 'FI' = any(v.languages) then 'fi' else 'en' end) desc,
                   pg.locale
        ) g
      )
    ) as trip
    from public.orders o
    join public.vehicles v on v.id = o.assigned_vehicle_id
    where o.status = 'IN_PROGRESS'
      and v.id in (select id from app.driver_vehicles(p_phone))
  ) trips;
$$;

comment on function public.driver_active_trips(text) is
  'Рейсы водителя по номеру телефона: точки, этап, единица и её размер, инструкции площадок. Для агента в WhatsApp.';
