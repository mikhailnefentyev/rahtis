-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 6 · прохождение рейса
--
-- ТЗ §7 задаёт цепочку из шести этапов: принял, забрал прицеп,
-- загрузился, в пути, выгрузился, сдал. Она написана под модель
-- «забор → выгрузка», которой больше нет: в рейсе бывает две выгрузки и
-- две загрузки вперемешку, и «Загрузился» перестал быть одиночным
-- событием — какое из двух показывать в статусе, ответа нет.
--
-- Поэтому прогресс — это пройденные точки, а не отдельный список этапов.
-- Все шесть состояний из ТЗ сохраняются, но выводятся, а не хранятся:
--
--   принял          заказ в работе
--   забрал прицеп   пройден забор
--   загрузился      пройдена точка загрузки — с названием места
--   выгрузился      пройдена точка выгрузки — с названием места
--   в пути          между пройденной и следующей
--   сдал            пройдена отцепка
--
-- Это же поле питает отметки на карте: пройденная точка красится иначе.
--
-- Повреждения (ТЗ §9) записываются на точку, а не на рейс. Прицеп могут
-- поцарапать при заборе, а груз повредить на конкретной выгрузке — при
-- разборе претензии важно, на чьём плече это случилось. Отметка ставится
-- в момент прохождения точки: тогда её видит тот, кто там стоял.
-- ═══════════════════════════════════════════════════════════════════

alter table public.order_stops
  /*
   * Момент прохождения точки. NULL означает «ещё не были».
   * Хранится момент, а не настенное время: в отличие от плановых
   * scheduled_date и scheduled_time это факт, привязанный к мгновению,
   * и он попадёт в доказательную базу.
   */
  add column completed_at timestamptz,

  /*
   * Повреждение, замеченное на этой точке. NULL — повреждений нет.
   * Отдельного флага «проверено» не нужно: сам факт прохождения точки и
   * есть отметка о проверке, а пустое описание при пройденной точке
   * означает «без повреждений».
   */
  add column damage_note text,

  add constraint order_stops_damage_needs_visit
    check (damage_note is null or completed_at is not null),

  add constraint order_stops_damage_length
    check (damage_note is null or length(btrim(damage_note)) between 3 and 2000);

comment on column public.order_stops.completed_at is
  'Момент прохождения точки. Из него выводится этап рейса (ТЗ §7).';
comment on column public.order_stops.damage_note is
  'Повреждение, замеченное на этой точке. NULL при пройденной точке — без повреждений.';

/* Поиск следующей непройденной точки — самый частый запрос по рейсу. */
create index order_stops_pending_idx on public.order_stops (order_id, sequence)
  where completed_at is null;


-- ── Отметка прохождения ────────────────────────────────────────────

/*
 * Точки проходятся по порядку.
 *
 * Рейс последователен: нельзя выгрузиться в Котке, не забрав прицеп в
 * Ханко. Проверка здесь не формальность — пропущенная точка означает
 * либо ошибку нажатия, либо что водитель не там, где думает диспетчер,
 * и молча принять такую отметку значит потерять единственный признак.
 *
 * Вызывать может назначенный перевозчик или оператор. На Этапе 8 сюда же
 * будет ходить n8n от имени водителя через WhatsApp — сигнатура для этого
 * и рассчитана: одна точка, одно необязательное описание повреждения.
 */
create or replace function public.complete_stop(
  p_stop_id uuid,
  p_damage_note text default null
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

  update public.order_stops
  set completed_at = now(),
      damage_note = nullif(btrim(coalesce(p_damage_note, '')), '')
  where id = p_stop_id
  returning * into v_stop;

  return v_stop;
end;
$$;

comment on function public.complete_stop(uuid, text) is
  'Отмечает точку пройденной. Порядок обязателен; повреждение пишется на точку.';


/*
 * Снятие отметки — только с последней пройденной.
 *
 * Ошибочные нажатия неизбежны, а рейс без возможности исправить отметку
 * заставляет звонить оператору. Снимать можно лишь последнюю: иначе в
 * середине маршрута появлялась бы дыра, и «по порядку» перестало бы
 * что-либо значить.
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
  set completed_at = null, damage_note = null
  where id = p_stop_id
  returning * into v_stop;

  return v_stop;
end;
$$;

comment on function public.uncomplete_stop(uuid) is
  'Снимает отметку с последней пройденной точки: ошибочные нажатия неизбежны.';

revoke all on function public.complete_stop(uuid, text) from public, anon;
revoke all on function public.uncomplete_stop(uuid) from public, anon;
grant execute on function public.complete_stop(uuid, text) to authenticated, service_role;
grant execute on function public.uncomplete_stop(uuid) to authenticated, service_role;


-- ── Прогресс наружу ────────────────────────────────────────────────

/*
 * Стол отдаёт прогресс вместе с точками: перевозчик видит свои рейсы
 * через my_assignments, а тот возвращает строку точки целиком, поэтому
 * completed_at и damage_note приходят туда сами. Стол же собирает точки
 * поимённым списком колонок, и его нужно дополнить.
 *
 * damage_note на стол не выходит: до взятия заказа это чужая история, а
 * после — заказ виден через my_assignments.
 */
create or replace function public.desk_orders(
  p_region text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  ref text,
  order_type public.order_type,
  trailer text,
  distance_km integer,
  rate_cents integer,
  comment text,
  shipper_name text,
  published_at timestamptz,
  pickup_city text,
  pickup_date date,
  pickup_time time,
  finish_city text,
  offers_count integer,
  taken_by_me boolean,
  route_geometry text,
  route_bounds jsonb,
  stops jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Стол заказов доступен только перевозчику.' using errcode = '42501';
  end if;

  v_company_id := (select app.current_company_id());

  if not app.has_dispatchable_vehicle(v_company_id) then
    return;
  end if;

  return query
  select
    o.id,
    o.ref,
    o.order_type,
    o.trailer,
    o.distance_km,
    o.rate_cents,
    o.comment,
    c.name,
    o.published_at,
    pickup.city,
    pickup.scheduled_date,
    pickup.scheduled_time,
    (
      select s.city
      from public.order_stops s
      where s.order_id = o.id
      order by s.sequence desc
      limit 1
    ),
    case
      when app.order_deadline_passed(o.status, o.deadline_at) then 0
      else (select count(*)::integer from public.order_offers f where f.order_id = o.id)
    end,
    case
      when app.order_deadline_passed(o.status, o.deadline_at) then false
      else exists (
        select 1 from public.order_offers f
        where f.order_id = o.id and f.carrier_company_id = v_company_id
      )
    end,
    o.route_geometry,
    o.route_bounds,
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'sequence', s.sequence,
          'role', s.role,
          'place_kind', s.place_kind,
          'place_name', s.place_name,
          'company_name', s.company_name,
          'address', s.address,
          'city', s.city,
          'scheduled_date', s.scheduled_date,
          'scheduled_time', s.scheduled_time,
          'external_ref', s.external_ref,
          'trailer_loaded', s.trailer_loaded,
          'note', s.note,
          'booking_ref', s.booking_ref,
          'cargo_weight_kg', s.cargo_weight_kg,
          'seal_required', s.seal_required,
          'lat', s.lat,
          'lon', s.lon,
          'leg_distance_m', s.leg_distance_m,
          'completed_at', s.completed_at
        )
        order by s.sequence
      )
      from public.order_stops s
      where s.order_id = o.id
    )
  from public.orders o
  join public.companies c on c.id = o.shipper_company_id
  join public.order_stops pickup
    on pickup.order_id = o.id and pickup.role = 'PICKUP'
  where (
      o.status = 'OPEN'
      or app.order_deadline_passed(o.status, o.deadline_at)
      or (
        o.status = 'REQUESTED'
        and exists (
          select 1 from public.order_offers f
          where f.order_id = o.id and f.carrier_company_id = v_company_id
        )
      )
    )
    and (p_region is null or pickup.city = p_region)
  order by o.published_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

comment on function public.desk_orders(text, integer) is
  'Стол заказов. Просроченная бронь считается снятой, контакты и получатель не отдаются.';
