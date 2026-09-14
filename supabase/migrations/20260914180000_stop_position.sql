-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · где именно отметили точку
--
-- У экспресса вся сделка — это два события: забрал и отдал. Прицеп
-- можно найти на площадке по номеру, контейнер — по ISO 6346, а коробку
-- никто не идентифицирует: она либо доехала до нужной двери, либо нет.
-- Спор о том, была ли доставка, решается тем, где стоял курьер, когда
-- нажал «отмечено».
--
-- Поэтому у пройденной точки появляется координата нажатия — рядом с
-- координатой адреса, а не вместо неё. Это два разных числа и два разных
-- смысла: адрес — куда должны были приехать, отметка — откуда сказали,
-- что приехали. Расхождение между ними и есть то, что читают в споре.
--
-- ПОЧЕМУ ОТМЕТКА НЕ ОБЯЗАТЕЛЬНА.
--
-- Соблазн запретить закрывать точку без координаты понятен: без запрета
-- доказательство необязательное, а значит слабое. Но браузер отдаёт
-- геолокацию не всегда: в подземном доке её нет, в отказанном разрешении
-- её нет, и на дешёвом телефоне её нет. Обязательная отметка означала бы
-- курьера, который в шесть вечера в пятницу не может закрыть доставку и
-- звонит оператору — а оператор всё равно закроет её руками, то есть
-- запрет не добавит доказательства, а переложит его на телефонный
-- звонок.
--
-- Вместо запрета — видимость. Пройденная точка без координаты остаётся
-- пройденной, но выглядит иначе у всех трёх сторон, и это честнее, чем
-- строгость, которую обходят.
--
-- ОТМЕТКА СНИМАЕТСЯ ВМЕСТЕ С ОТМЕТКОЙ. uncomplete_stop существует
-- потому, что ошибочные нажатия неизбежны; координата от ошибочного
-- нажатия — такая же ошибка, и оставлять её значило бы записать курьера
-- туда, где он не был.
-- ═══════════════════════════════════════════════════════════════════

alter table public.order_stops
  add column completed_lat double precision,
  add column completed_lon double precision,

  /* Радиус погрешности от браузера: 20 метров и 3 километра — разное. */
  add column completed_accuracy_m integer,

  add constraint order_stops_completed_position_pair
    check ((completed_lat is null) = (completed_lon is null)),

  /*
   * Нуль-остров в Гвинейском заливе — самый частый исход разбора мусора,
   * и расстояние до него считается совершенно исправно. Тот же запрет
   * стоит в hasCoordinates на стороне формы.
   */
  add constraint order_stops_completed_position_range
    check (
      completed_lat is null
      or (
        completed_lat between -90 and 90
        and completed_lon between -180 and 180
        and not (completed_lat = 0 and completed_lon = 0)
      )
    ),

  add constraint order_stops_completed_accuracy_range
    check (completed_accuracy_m is null or completed_accuracy_m between 1 and 100000),

  /* Координата нажатия без самого нажатия — состояние без смысла. */
  add constraint order_stops_completed_position_needs_completion
    check (completed_lat is null or completed_at is not null);

comment on column public.order_stops.completed_lat is
  'Где стоял отмечающий в момент нажатия. Не адрес точки: адрес — куда ехали, это — откуда сказали, что приехали.';
comment on column public.order_stops.completed_lon is
  'Долгота отметки. Пусто — устройство координат не дало; точка всё равно пройдена.';
comment on column public.order_stops.completed_accuracy_m is
  'Радиус погрешности отметки в метрах, как его назвал браузер.';


-- ── Годная ли координата ───────────────────────────────────────────

/*
 * Одно правило на все входы: браузер перевозчика, агент водителя и
 * оператор. Проверка не строгая по смыслу — она отсекает только то, что
 * координатой не является: пустоту, выход за полюса и нуль-остров.
 */
create or replace function app.sane_position(
  p_lat double precision,
  p_lon double precision
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_lat is not null
     and p_lon is not null
     and p_lat between -90 and 90
     and p_lon between -180 and 180
     and not (p_lat = 0 and p_lon = 0);
$$;

comment on function app.sane_position(double precision, double precision) is
  'Похоже ли это на координату: обе части на месте, в пределах земли и не нуль-остров.';

revoke all on function app.sane_position(double precision, double precision) from public, anon;
grant execute on function app.sane_position(double precision, double precision)
  to authenticated, service_role;


-- ── Отметка точки ──────────────────────────────────────────────────

/*
 * Координаты приходят отдельными параметрами, а не одним объектом:
 * их присылают из браузера перевозчика и из агента водителя, и оба
 * вызова идут через PostgREST по именам параметров.
 *
 * Прежняя сигнатура снимается, а не дополняется: две функции с одним
 * именем и разным числом аргументов разошлись бы в поведении, а PostgREST
 * выбирал бы между ними по составу тела запроса.
 */
drop function if exists public.complete_stop(uuid, text);

create or replace function public.complete_stop(
  p_stop_id uuid,
  p_damage_note text default null,
  p_lat double precision default null,
  p_lon double precision default null,
  p_accuracy_m integer default null
)
returns public.order_stops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.order_stops;
  v_order public.orders;
  v_pending_seq smallint;
  v_lat double precision;
  v_lon double precision;
begin
  select * into v_stop from public.order_stops where id = p_stop_id;
  if v_stop.id is null then
    raise exception 'Точка не найдена.' using errcode = 'P0002';
  end if;

  select * into v_order from public.orders where id = v_stop.order_id;

  if not (
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin())
  ) then
    raise exception 'Отмечать прохождение может только назначенный перевозчик.'
      using errcode = '42501';
  end if;

  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Отмечать точки можно только в идущем рейсе, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  if v_stop.completed_at is not null then
    raise exception 'Точка уже пройдена.' using errcode = '55000';
  end if;

  select min(s.sequence) into v_pending_seq
  from public.order_stops s
  where s.order_id = v_stop.order_id and s.completed_at is null;

  if v_stop.sequence <> v_pending_seq then
    raise exception 'Точки проходятся по порядку: сначала отметьте предыдущие.'
      using errcode = '55000';
  end if;

  /*
   * Негодная координата отбрасывается молча, а не роняет отметку.
   *
   * Пришла она от браузера, то есть от чего угодно, и единственное, что
   * она делает, — добавляет доказательство. Отказать из-за неё в
   * прохождении точки значило бы остановить рейс из-за украшения.
   */
  if app.sane_position(p_lat, p_lon) then
    v_lat := p_lat;
    v_lon := p_lon;
  end if;

  update public.order_stops
  set completed_at = now(),
      damage_note = nullif(btrim(coalesce(p_damage_note, '')), ''),
      completed_lat = v_lat,
      completed_lon = v_lon,
      completed_accuracy_m = case
        when v_lat is null then null
        when p_accuracy_m between 1 and 100000 then p_accuracy_m
        else null
      end
  where id = p_stop_id
  returning * into v_stop;

  return v_stop;
end;
$$;

comment on function public.complete_stop(uuid, text, double precision, double precision, integer) is
  'Отмечает точку пройденной. Порядок обязателен; повреждение и координата нажатия пишутся на точку.';

revoke all on function public.complete_stop(uuid, text, double precision, double precision, integer)
  from public, anon;
grant execute on function public.complete_stop(uuid, text, double precision, double precision, integer)
  to authenticated, service_role;


-- ── Снятие отметки ─────────────────────────────────────────────────

/*
 * Координата уходит вместе с отметкой.
 *
 * Тело функции остальное оставлено как было — меняются только три
 * обнуляемых поля. Оставить координату от снятого нажатия значило бы
 * записать курьера туда, где он не был, а потом предъявить это в споре.
 */
create or replace function public.uncomplete_stop(p_stop_id uuid)
returns public.order_stops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.order_stops;
  v_order public.orders;
  v_last_seq smallint;
begin
  select * into v_stop from public.order_stops where id = p_stop_id;
  if v_stop.id is null then
    raise exception 'Точка не найдена.' using errcode = 'P0002';
  end if;

  select * into v_order from public.orders where id = v_stop.order_id;

  if not (
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin())
  ) then
    raise exception 'Снять отметку может только назначенный перевозчик.'
      using errcode = '42501';
  end if;

  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Рейс уже не идёт, отметки не меняются.' using errcode = '55000';
  end if;

  select max(s.sequence) into v_last_seq
  from public.order_stops s
  where s.order_id = v_stop.order_id and s.completed_at is not null;

  if v_stop.sequence is distinct from v_last_seq then
    raise exception 'Снять отметку можно только с последней пройденной точки.'
      using errcode = '55000';
  end if;

  update public.order_stops
  set completed_at = null,
      damage_note = null,
      completed_lat = null,
      completed_lon = null,
      completed_accuracy_m = null
  where id = p_stop_id
  returning * into v_stop;

  return v_stop;
end;
$$;

comment on function public.uncomplete_stop(uuid) is
  'Снимает отметку с последней пройденной точки вместе с повреждением и координатой.';

revoke all on function public.uncomplete_stop(uuid) from public, anon;
grant execute on function public.uncomplete_stop(uuid) to authenticated, service_role;


-- ── Отметка от водителя ────────────────────────────────────────────

/*
 * У водителя веб-кабинета нет: он говорит с платформой через агента в
 * WhatsApp, а координату WhatsApp умеет присылать сам — вложением
 * «Location». Раз это единственный способ получить от него точку, он
 * должен вести туда же, куда ведёт кнопка в кабинете перевозчика: в те
 * же три колонки, теми же правилами.
 *
 * Сигнатура снимается и пересоздаётся: старая осталась бы второй
 * функцией того же имени, и PostgREST выбирал бы между ними по составу
 * тела запроса — то есть отметка с координатой иногда уходила бы в
 * версию без неё.
 */
drop function if exists public.driver_complete_next_stop(text, public.stop_role, text);

create or replace function public.driver_complete_next_stop(
  p_phone text,
  p_expect public.stop_role default null,
  p_damage_note text default null,
  p_lat double precision default null,
  p_lon double precision default null,
  p_accuracy_m integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_stop public.order_stops;
  v_next public.order_stops;
  v_count integer;
  v_lat double precision;
  v_lon double precision;
begin
  select count(*) into v_count
  from public.orders o
  where o.status = 'IN_PROGRESS'
    and o.assigned_vehicle_id in (select id from app.driver_vehicles(p_phone));

  if v_count = 0 then
    raise exception 'Идущего рейса у этого номера нет.' using errcode = 'P0002';
  end if;

  /*
   * Два рейса разом — отказ, а не выбор наугад. Отметить не тот рейс
   * хуже, чем не отметить никакой: заказчик получит уведомление о
   * выгрузке, которой не было.
   */
  if v_count > 1 then
    raise exception 'У номера несколько идущих рейсов, отметка невозможна.'
      using errcode = '55000';
  end if;

  select o.* into v_order
  from public.orders o
  where o.status = 'IN_PROGRESS'
    and o.assigned_vehicle_id in (select id from app.driver_vehicles(p_phone));

  select s.* into v_stop
  from public.order_stops s
  where s.order_id = v_order.id and s.completed_at is null
  order by s.sequence
  limit 1;

  if v_stop.id is null then
    raise exception 'Все точки рейса % уже пройдены.', v_order.ref using errcode = '55000';
  end if;

  if p_expect is not null and v_stop.role <> p_expect then
    raise exception 'Следующая точка — %, а не %.', v_stop.role, p_expect
      using errcode = '55001';
  end if;

  /* Негодная координата отбрасывается молча: рейс из-за неё не встаёт. */
  if app.sane_position(p_lat, p_lon) then
    v_lat := p_lat;
    v_lon := p_lon;
  end if;

  update public.order_stops
  set completed_at = now(),
      damage_note = nullif(btrim(coalesce(p_damage_note, '')), ''),
      completed_lat = v_lat,
      completed_lon = v_lon,
      completed_accuracy_m = case
        when v_lat is null then null
        when p_accuracy_m between 1 and 100000 then p_accuracy_m
        else null
      end,
      updated_at = now()
  where id = v_stop.id
  returning * into v_stop;

  select s.* into v_next
  from public.order_stops s
  where s.order_id = v_order.id and s.completed_at is null
  order by s.sequence
  limit 1;

  return jsonb_build_object(
    'ref', v_order.ref,
    'completed', jsonb_build_object(
      'sequence', v_stop.sequence,
      'role', v_stop.role,
      'place', coalesce(v_stop.place_name, v_stop.company_name, v_stop.city),
      'damage_note', v_stop.damage_note,
      /*
       * Агенту отдаётся не координата, а ответ на вопрос «записалась ли
       * отметка». Координата ему без надобности, а в переписку она
       * попадать не должна: разбирать спор по ней будет оператор в
       * кабинете, а не диалог в мессенджере.
       */
      'position_recorded', v_stop.completed_lat is not null
    ),
    'next', case when v_next.id is null then null else jsonb_build_object(
      'sequence', v_next.sequence,
      'role', v_next.role,
      'place', coalesce(v_next.place_name, v_next.company_name, v_next.city),
      'address', v_next.address,
      'city', v_next.city,
      'scheduled_date', v_next.scheduled_date,
      'scheduled_time', v_next.scheduled_time,
      'note', v_next.note
    ) end,
    'finished', v_next.id is null
  );
end;
$$;

comment on function public.driver_complete_next_stop(text, public.stop_role, text, double precision, double precision, integer) is
  'Отмечает следующую непройденную точку рейса водителя. Координату принимает, но наружу отдаёт только факт её записи.';

revoke all on function public.driver_complete_next_stop(
  text, public.stop_role, text, double precision, double precision, integer
) from public, anon, authenticated;

grant execute on function public.driver_complete_next_stop(
  text, public.stop_role, text, double precision, double precision, integer
) to service_role, driver_agent;
