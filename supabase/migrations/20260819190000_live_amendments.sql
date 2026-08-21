-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 6 · живая корректировка маршрута (ТЗ §8)
--
-- Пока рейс идёт, заказчик вправе изменить точку, вставить новую или
-- убрать ненужную: порт перенёс окно, склад закрылся, добавилась вторая
-- выгрузка по дороге. Это не редкий случай, а обычная жизнь рейса — и до
-- сих пор она решалась звонком диспетчеру.
--
-- Три решения, которые определяют всё остальное.
--
-- ПЕРВОЕ: правка — это запись, а не просто новое значение. Точку можно
-- было бы менять обычным UPDATE по политике, и заказчик получил бы ровно
-- то, что просит ТЗ. Но тогда никто не смог бы ответить, чем идущий рейс
-- отличается от заказа, который взял перевозчик. А отличается он ровно
-- этим: водитель поехал по одному маршруту, а везёт по другому. Поэтому
-- правка идёт через функцию, которая пишет строку в журнал изменений, и
-- прямого UPDATE на точки у заказчика нет вовсе.
--
-- ВТОРОЕ: пройденную точку не трогает никто. Она уже история: там стояла
-- машина, там ставилась отметка, там могло записаться повреждение.
-- Изменить её задним числом — значит переписать доказательную базу
-- рейса. Вставить новую точку перед пройденной — то же самое: маршрут
-- начал бы утверждать, что водитель проехал мимо места, которого в
-- маршруте не было.
--
-- ТРЕТЬЕ: журнал хранит не готовую фразу, а что именно поменялось —
-- {поле: {было, стало}}. Соблазн записать «Заказчик перенёс выгрузку в
-- Турку на 14:00» велик, но такая строка написана по-русски раз и
-- навсегда, а интерфейс переводится (см. правила i18n в README). Фразу
-- собирает словарь, база отдаёт факты.
--
-- Уведомление водителю (ТЗ §8) отсюда и берётся: неподтверждённая правка
-- и есть очередь неотправленного. На Этапе 8 её будет разбирать n8n и
-- писать водителю в WhatsApp; пока перевозчик видит пометку «Изменения от
-- заказчика» в кабинете и снимает её сам.
-- ═══════════════════════════════════════════════════════════════════

create type public.amendment_kind as enum ('STOP_ADDED', 'STOP_CHANGED', 'STOP_REMOVED');

create table public.order_amendments (
  id bigint generated always as identity primary key,

  order_id uuid not null references public.orders (id) on delete cascade,

  /*
   * Точка, которой правка касается. NULL у удалённой: строка журнала
   * переживает точку, о которой рассказывает, и ссылаться ей больше не на
   * что. Поэтому роль и название места лежат рядом снимком — без них
   * запись об удалении читалась бы как «убрали что-то».
   */
  stop_id uuid references public.order_stops (id) on delete set null,
  stop_role public.stop_role not null,
  stop_label text not null,

  kind public.amendment_kind not null,

  /*
   * Что изменилось: {поле: {"from": было, "to": стало}}.
   *
   * JSON здесь уместен ровно потому, почему он неуместен для точек
   * маршрута: набор полей у каждой правки свой, ссылаться на них некому,
   * искать по ним незачем. Это запись в журнал, а не сущность.
   *
   * Добавление и удаление описываются тем же способом: у появившейся
   * точки всё «стало», у убранной всё «было». Один формат — один
   * разборщик в интерфейсе вместо трёх похожих.
   */
  changes jsonb not null,

  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  /*
   * Перевозчик увидел правку. До этого момента она числится
   * неотправленной — по этому полю Этап 8 будет решать, кому ещё не
   * написал WhatsApp-агент.
   */
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users (id) on delete set null,

  constraint order_amendments_changes_shape
    check (jsonb_typeof(changes) = 'object' and changes <> '{}'::jsonb),

  constraint order_amendments_ack_together
    check ((acknowledged_at is null) = (acknowledged_by is null)),

  constraint order_amendments_removed_has_no_stop
    check (kind <> 'STOP_REMOVED' or stop_id is null)
);

comment on table public.order_amendments is
  'Журнал живой корректировки маршрута (ТЗ §8). Неподтверждённая строка — неотправленное уведомление водителю.';
comment on column public.order_amendments.changes is
  'Что изменилось: {поле: {from, to}}. Фразу собирает словарь интерфейса, не база.';
comment on column public.order_amendments.stop_label is
  'Название места на момент правки. Снимок: точка может исчезнуть, запись остаётся.';

create index order_amendments_order_idx on public.order_amendments (order_id, created_at);

/* Очередь неотправленного — самый частый запрос к этой таблице. */
create index order_amendments_pending_idx on public.order_amendments (order_id)
  where acknowledged_at is null;


-- ── Права и RLS ────────────────────────────────────────────────────

alter table public.order_amendments enable row level security;
revoke all on public.order_amendments from anon, authenticated;
grant select on public.order_amendments to authenticated;

/*
 * Читают обе стороны рейса: заказчик — что он поменял, перевозчик — что
 * поменялось у него под колёсами. Тот же предикат, что у документов рейса.
 *
 * Записи через политику нет ни у кого: журнал ведут функции ниже, и строка
 * в нём обязана появляться вместе с правкой, а не по желанию того, кто
 * правит.
 */
create policy order_amendments_select_party
  on public.order_amendments for select to authenticated
  using ((select app.party_to_order(order_id)));


-- ── Сдвиг нумерации точек ──────────────────────────────────────────

/*
 * Вставка и удаление точки сдвигают номера соседних, а номер уникален в
 * пределах заказа. Обычный `update … set sequence = sequence + 1` на этом
 * и падает: Postgres проверяет уникальность после каждой строки, и вторая
 * точка на мгновение совпадает с третьей.
 *
 * Лечится отложенной проверкой — той, ради которой DEFERRABLE и
 * существует: уникальность проверяется в конце транзакции, когда сдвиг
 * уже закончен. Менять этот признак у готового ограничения Postgres умеет
 * только для внешних ключей, поэтому ограничение пересоздаётся.
 *
 * INITIALLY IMMEDIATE: по умолчанию проверка остаётся немедленной, и
 * обычная вставка точки ловит ошибку там же, где ловила раньше.
 * Откладывает её только тот, кто действительно сдвигает нумерацию.
 */
alter table public.order_stops
  drop constraint order_stops_sequence_key,
  add constraint order_stops_sequence_key unique (order_id, sequence)
    deferrable initially immediate;

create or replace function app.shift_stops(
  p_order_id uuid,
  p_from smallint,
  p_delta smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  set constraints public.order_stops_sequence_key deferred;

  update public.order_stops
  set sequence = sequence + p_delta
  where order_id = p_order_id
    and sequence >= p_from;
end;
$$;

comment on function app.shift_stops(uuid, smallint, smallint) is
  'Сдвигает нумерацию точек от указанной. Проверка уникальности откладывается до конца транзакции.';


-- ── Снимки точки для журнала ───────────────────────────────────────

/*
 * Название места одной строкой — то же правило, что в
 * lib/orders/progress.ts: площадка, иначе компания, иначе город.
 *
 * Правило намеренно записано дважды. Там оно называет живую точку и
 * меняется вместе с ней; здесь замораживает имя в момент правки, чтобы
 * запись «убрали выгрузку в Турку» осталась читаемой после того, как
 * точки не стало.
 */
create or replace function app.stop_label(p_stop public.order_stops)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(coalesce(p_stop.place_name, '')), ''),
    nullif(btrim(coalesce(p_stop.company_name, '')), ''),
    p_stop.city
  );
$$;

/*
 * Точка целиком в формате журнала.
 *
 * p_added задаёт направление: у появившейся точки всё «стало», у убранной
 * всё «было». Пустые поля не попадают: строка «получатель: не указан → не
 * указан» ничего не сообщает.
 *
 * Координаты, оценка геокодера, плечи и номер по порядку остаются за
 * бортом: это не решения заказчика, а следствия адреса и позиции.
 */
create or replace function app.stop_snapshot(
  p_stop public.order_stops,
  p_added boolean
)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(
      e.key,
      case
        when p_added then jsonb_build_object('from', null, 'to', e.value)
        else jsonb_build_object('from', e.value, 'to', null)
      end
    ),
    '{}'::jsonb
  )
  from jsonb_each(to_jsonb(p_stop)) as e(key, value)
  where e.key in (
      'place_name', 'company_name', 'address', 'scheduled_date', 'scheduled_time',
      'contact_name', 'contact_phone', 'external_ref', 'note',
      'cargo_weight_kg', 'consignee', 'seal_required', 'trailer_loaded'
    )
    and e.value <> 'null'::jsonb;
$$;


-- ── Маршрут после правки ───────────────────────────────────────────

/*
 * Кэш линии и плечи стираются, а distance_km и ставка — нет, и это
 * главное решение здесь. Пробег с ценой согласованы: перевозчик взял рейс
 * за эти деньги, и молча переписать число, из которого они посчитаны,
 * платформа не вправе. Расхождение видно в журнале, а договариваются о
 * нём люди.
 *
 * Линия при этом обязана исчезнуть. Карта, ведущая мимо новой точки, врёт
 * убедительнее, чем её отсутствие: пустая карта заставляет посмотреть в
 * список точек, нарисованная — не заставляет.
 */
create or replace function app.invalidate_route(p_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with cleared as (
    update public.orders
    set route_geometry = null,
        route_bounds = null,
        route_fingerprint = null,
        route_computed_at = null
    where id = p_order_id
    returning id
  )
  update public.order_stops
  set leg_distance_m = null, leg_duration_s = null
  where order_id = (select id from cleared);
$$;

comment on function app.invalidate_route(uuid) is
  'Стирает кэш маршрута после правки точек. Пробег и ставку не трогает: они согласованы.';


-- ── Общая проверка права на правку ─────────────────────────────────

/*
 * Кто и когда правит маршрут. Одна проверка на все три действия:
 * разойдись они, «пройденную точку не трогают» перестало бы быть
 * правилом и стало бы поведением одной из функций.
 */
create or replace function app.assert_amendable(p_stop public.order_stops)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_stop.order_id;

  if not (
    v_order.shipper_company_id = (select app.current_company_id())
    or (select app.is_admin())
  ) then
    raise exception 'Править маршрут может только заказчик этого рейса.'
      using errcode = '42501';
  end if;

  /*
   * До старта маршрут этими функциями не правится. Опубликованный заказ
   * лежит на столе, по нему поданы отклики, и тихая подмена адреса
   * означала бы, что перевозчик согласился на один рейс, а везёт другой.
   * Такая правка — это снятие с публикации, и она будет отдельной.
   */
  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Живая корректировка возможна только в идущем рейсе, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  if p_stop.completed_at is not null then
    raise exception 'Точка уже пройдена — её маршрут не меняет.'
      using errcode = '55000';
  end if;

  return v_order;
end;
$$;

revoke all on function app.shift_stops(uuid, smallint, smallint) from public, anon, authenticated;
revoke all on function app.stop_label(public.order_stops) from public, anon, authenticated;
revoke all on function app.stop_snapshot(public.order_stops, boolean) from public, anon, authenticated;
revoke all on function app.invalidate_route(uuid) from public, anon, authenticated;
revoke all on function app.assert_amendable(public.order_stops) from public, anon, authenticated;
grant execute on function app.shift_stops(uuid, smallint, smallint) to service_role;
grant execute on function app.stop_label(public.order_stops) to service_role;
grant execute on function app.stop_snapshot(public.order_stops, boolean) to service_role;
grant execute on function app.invalidate_route(uuid) to service_role;
grant execute on function app.assert_amendable(public.order_stops) to service_role;


-- ── Правка точки ───────────────────────────────────────────────────

/*
 * Меняет поля точки и записывает, что именно изменилось.
 *
 * Патч приходит объектом: в нём только те поля, которые заказчик тронул.
 * Отсутствие ключа и пустое значение — разные вещи: первое означает «не
 * менял», второе «стёр». Поэтому проверяется наличие ключа, а не пустота
 * значения.
 *
 * Роль и позиция точки не меняются никогда. Выгрузка, ставшая загрузкой,
 * — это другая точка, и честнее убрать одну и добавить другую, чем делать
 * вид, что это правка.
 */
create or replace function public.amend_stop(p_stop_id uuid, p_patch jsonb)
returns public.order_amendments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.order_stops;
  v_new public.order_stops;
  v_order public.orders;
  v_before jsonb;
  v_after jsonb;
  v_changes jsonb;
  v_amendment public.order_amendments;
begin
  select * into v_stop from public.order_stops where id = p_stop_id;
  if v_stop.id is null then
    raise exception 'Точка не найдена.' using errcode = 'P0002';
  end if;

  v_order := app.assert_amendable(v_stop);

  update public.order_stops set
    place_name = case when p_patch ? 'place_name'
      then nullif(btrim(coalesce(p_patch->>'place_name', '')), '') else place_name end,
    company_name = case when p_patch ? 'company_name'
      then nullif(btrim(coalesce(p_patch->>'company_name', '')), '') else company_name end,
    address = case when p_patch ? 'address'
      then btrim(coalesce(p_patch->>'address', '')) else address end,
    city = case when p_patch ? 'city'
      then btrim(coalesce(p_patch->>'city', '')) else city end,
    lat = case when p_patch ? 'lat'
      then nullif(p_patch->>'lat', '')::double precision else lat end,
    lon = case when p_patch ? 'lon'
      then nullif(p_patch->>'lon', '')::double precision else lon end,
    geocode_score = case when p_patch ? 'geocode_score'
      then nullif(p_patch->>'geocode_score', '')::numeric else geocode_score end,
    contact_name = case when p_patch ? 'contact_name'
      then nullif(btrim(coalesce(p_patch->>'contact_name', '')), '') else contact_name end,
    contact_phone = case when p_patch ? 'contact_phone'
      then nullif(regexp_replace(coalesce(p_patch->>'contact_phone', ''), '[\s-]', '', 'g'), '')
      else contact_phone end,
    scheduled_date = case when p_patch ? 'scheduled_date'
      then nullif(p_patch->>'scheduled_date', '')::date else scheduled_date end,
    scheduled_time = case when p_patch ? 'scheduled_time'
      then nullif(p_patch->>'scheduled_time', '')::time else scheduled_time end,
    external_ref = case when p_patch ? 'external_ref'
      then nullif(btrim(coalesce(p_patch->>'external_ref', '')), '') else external_ref end,
    note = case when p_patch ? 'note'
      then nullif(btrim(coalesce(p_patch->>'note', '')), '') else note end,
    cargo_weight_kg = case when p_patch ? 'cargo_weight_kg'
      then nullif(p_patch->>'cargo_weight_kg', '')::integer else cargo_weight_kg end,
    consignee = case when p_patch ? 'consignee'
      then nullif(btrim(coalesce(p_patch->>'consignee', '')), '') else consignee end,
    seal_required = case when p_patch ? 'seal_required'
      then nullif(p_patch->>'seal_required', '')::boolean else seal_required end,
    trailer_loaded = case when p_patch ? 'trailer_loaded'
      then nullif(p_patch->>'trailer_loaded', '')::boolean else trailer_loaded end
  where id = p_stop_id
  returning * into v_new;

  v_before := to_jsonb(v_stop);
  v_after := to_jsonb(v_new);

  /*
   * Разница считается по ключам, которые пришли в патче, и только по
   * действительно изменившимся: открытая и закрытая без правок форма
   * журнал не пополняет.
   *
   * Город и координаты из разницы исключены. Они приезжают вместе с
   * адресом из подсказки и меняются вместе с ним — три строки об одном
   * событии означали бы, что заказчик сделал три правки.
   */
  select jsonb_object_agg(k, jsonb_build_object('from', v_before->k, 'to', v_after->k))
  into v_changes
  from jsonb_object_keys(p_patch) as k
  where k not in ('city', 'lat', 'lon', 'geocode_score')
    and v_before->k is distinct from v_after->k;

  if v_changes is null then
    return null;
  end if;

  /* Точка переехала — линия маршрута к ней больше не ведёт. */
  if v_before->'lat' is distinct from v_after->'lat'
     or v_before->'lon' is distinct from v_after->'lon'
     or v_before->'address' is distinct from v_after->'address' then
    perform app.invalidate_route(v_order.id);
  end if;

  insert into public.order_amendments (
    order_id, stop_id, stop_role, stop_label, kind, changes, actor_id
  )
  values (
    v_order.id, v_new.id, v_new.role, app.stop_label(v_new),
    'STOP_CHANGED', v_changes, (select auth.uid())
  )
  returning * into v_amendment;

  return v_amendment;
end;
$$;

comment on function public.amend_stop(uuid, jsonb) is
  'Правит непройденную точку идущего рейса и пишет строку журнала (ТЗ §8).';


-- ── Новая точка в идущем рейсе ─────────────────────────────────────

/*
 * Вставляет точку перед указанной.
 *
 * Позиция задаётся соседом, а не номером. Номер — внутренняя мелочь, он
 * меняется при каждой вставке, и «вставить пятой» ничего не значит ни для
 * заказчика, ни для водителя. «Перед отцепкой» — значит.
 *
 * Заодно этим исключается вставка после конца рейса: назвать можно только
 * существующую точку, а после отцепки прицепа их не бывает.
 *
 * Добавляются только загрузка и выгрузка. Забор и отцепка — концы рейса,
 * они есть по одной штуке, и «добавить ещё один забор прицепа» означало
 * бы другой рейс, а не правку этого.
 */
create or replace function public.add_stop(p_before_stop_id uuid, p_stop jsonb)
returns public.order_amendments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.order_stops;
  v_order public.orders;
  v_role public.stop_role;
  v_new public.order_stops;
  v_amendment public.order_amendments;
begin
  select * into v_target from public.order_stops where id = p_before_stop_id;
  if v_target.id is null then
    raise exception 'Точка не найдена.' using errcode = 'P0002';
  end if;

  /*
   * Проверяется сосед: вставка перед пройденной точкой — правка истории,
   * а не маршрута.
   */
  v_order := app.assert_amendable(v_target);

  v_role := (p_stop->>'role')::public.stop_role;
  if v_role not in ('EXTRA_LOAD', 'EXTRA_UNLOAD') then
    raise exception 'В идущий рейс добавляется только загрузка или выгрузка.'
      using errcode = '22023';
  end if;

  perform app.shift_stops(v_order.id, v_target.sequence, 1::smallint);

  insert into public.order_stops (
    order_id, sequence, role, place_name, company_name, address, city,
    lat, lon, geocode_score, contact_name, contact_phone,
    scheduled_date, scheduled_time, external_ref, note,
    cargo_weight_kg, consignee, seal_required
  )
  values (
    v_order.id,
    v_target.sequence,
    v_role,
    nullif(btrim(coalesce(p_stop->>'place_name', '')), ''),
    nullif(btrim(coalesce(p_stop->>'company_name', '')), ''),
    btrim(coalesce(p_stop->>'address', '')),
    btrim(coalesce(p_stop->>'city', '')),
    nullif(p_stop->>'lat', '')::double precision,
    nullif(p_stop->>'lon', '')::double precision,
    nullif(p_stop->>'geocode_score', '')::numeric,
    nullif(btrim(coalesce(p_stop->>'contact_name', '')), ''),
    nullif(regexp_replace(coalesce(p_stop->>'contact_phone', ''), '[\s-]', '', 'g'), ''),
    nullif(p_stop->>'scheduled_date', '')::date,
    nullif(p_stop->>'scheduled_time', '')::time,
    nullif(btrim(coalesce(p_stop->>'external_ref', '')), ''),
    nullif(btrim(coalesce(p_stop->>'note', '')), ''),
    nullif(p_stop->>'cargo_weight_kg', '')::integer,
    nullif(btrim(coalesce(p_stop->>'consignee', '')), ''),
    nullif(p_stop->>'seal_required', '')::boolean
  )
  returning * into v_new;

  /* Новая точка меняет маршрут всегда — линия считалась без неё. */
  perform app.invalidate_route(v_order.id);

  insert into public.order_amendments (
    order_id, stop_id, stop_role, stop_label, kind, changes, actor_id
  )
  values (
    v_order.id, v_new.id, v_new.role, app.stop_label(v_new),
    'STOP_ADDED', app.stop_snapshot(v_new, true), (select auth.uid())
  )
  returning * into v_amendment;

  return v_amendment;
end;
$$;

comment on function public.add_stop(uuid, jsonb) is
  'Вставляет загрузку или выгрузку перед указанной непройденной точкой (ТЗ §8).';


-- ── Убрать точку ───────────────────────────────────────────────────

/*
 * Убирает непройденную загрузку или выгрузку.
 *
 * ТЗ §8 говорит «изменить или добавить», но отменённая выгрузка — тот же
 * случай той же жизни: склад не принял, груз забрали раньше. Без удаления
 * заказчик снова звонит диспетчеру, водитель едет туда, куда ехать не
 * надо, и рейс не закроется, пока он эту точку не отметит.
 *
 * Концы рейса не убираются: без забора и отцепки перецепа не бывает.
 */
create or replace function public.remove_stop(p_stop_id uuid)
returns public.order_amendments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.order_stops;
  v_order public.orders;
  v_amendment public.order_amendments;
begin
  select * into v_stop from public.order_stops where id = p_stop_id;
  if v_stop.id is null then
    raise exception 'Точка не найдена.' using errcode = 'P0002';
  end if;

  v_order := app.assert_amendable(v_stop);

  if v_stop.role not in ('EXTRA_LOAD', 'EXTRA_UNLOAD') then
    raise exception 'Забор и отцепку прицепа из маршрута не убирают.'
      using errcode = '22023';
  end if;

  /*
   * Запись появляется без ссылки на точку сразу: через мгновение
   * ссылаться будет не на что, а внешний ключ, обнулённый удалением,
   * выглядел бы потерянной связью, а не осознанным снимком.
   */
  insert into public.order_amendments (
    order_id, stop_id, stop_role, stop_label, kind, changes, actor_id
  )
  values (
    v_order.id, null, v_stop.role, app.stop_label(v_stop),
    'STOP_REMOVED', app.stop_snapshot(v_stop, false), (select auth.uid())
  )
  returning * into v_amendment;

  delete from public.order_stops where id = p_stop_id;

  /* Дыра в нумерации закрывается: точки считают глазами, «1, 2, 4» врёт. */
  perform app.shift_stops(v_order.id, (v_stop.sequence + 1)::smallint, (-1)::smallint);

  perform app.invalidate_route(v_order.id);

  return v_amendment;
end;
$$;

comment on function public.remove_stop(uuid) is
  'Убирает непройденную загрузку или выгрузку из идущего рейса (ТЗ §8).';


-- ── Пересчитанный маршрут после правки ─────────────────────────────

/*
 * Кладёт заново посчитанную линию на место стёртой.
 *
 * Считает кабинет заказчика — тем же вызовом роутера, что и при
 * публикации: ключ TomTom серверный, а точки уже лежат в базе с
 * координатами. Отдельная функция, а не поле в amend_stop, потому что это
 * разные события: правка обязана записаться немедленно, а маршрут
 * приезжает секундой позже и может не приехать вовсе — у адреса,
 * набранного руками, координат нет и считать нечего.
 *
 * distance_km здесь не трогается по той же причине, что и в
 * invalidate_route: пробег согласован с ценой. Новый результат ложится в
 * distance_auto_km, и расхождение видно обеим сторонам.
 */
create or replace function public.store_route(p_order_id uuid, p_route jsonb)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_leg jsonb;
  v_index integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if not (
    v_order.shipper_company_id = (select app.current_company_id())
    or (select app.is_admin())
  ) then
    raise exception 'Маршрут пересчитывает заказчик этого рейса.' using errcode = '42501';
  end if;

  update public.orders
  set route_geometry = nullif(p_route->>'geometry', ''),
      route_bounds = p_route->'bounds',
      route_fingerprint = nullif(p_route->>'fingerprint', ''),
      route_computed_at = now(),
      distance_auto_km = nullif(p_route->>'km', '')::integer
  where id = p_order_id
  returning * into v_order;

  /*
   * Плечи раскладываются по точкам в порядке маршрута: плечо N — путь ДО
   * точки N от предыдущей, поэтому у первой его нет. Роутер отдаёт их
   * ровно столько, сколько промежутков между точками.
   */
  if jsonb_typeof(p_route->'legs') = 'array' then
    for v_leg in select * from jsonb_array_elements(p_route->'legs') loop
      v_index := v_index + 1;

      update public.order_stops s
      set leg_distance_m = nullif(v_leg->>'distanceM', '')::integer,
          leg_duration_s = nullif(v_leg->>'durationS', '')::integer
      where s.id = (
        select t.id from public.order_stops t
        where t.order_id = p_order_id
        order by t.sequence
        offset v_index limit 1
      );
    end loop;
  end if;

  return v_order;
end;
$$;

comment on function public.store_route(uuid, jsonb) is
  'Сохраняет пересчитанный после правки маршрут. Пробег и ставку не меняет.';


-- ── Перевозчик увидел правку ───────────────────────────────────────

/*
 * Снимает пометку «Изменения от заказчика» со всех правок рейса разом.
 *
 * Разом, а не по одной: пометка отвечает на вопрос «я в курсе того, что
 * поменялось», а не «я прочитал строку номер три». Подтверждение каждой
 * приучило бы нажимать не глядя.
 *
 * На Этапе 8 сюда же будет ходить n8n после того, как WhatsApp-агент
 * доставил правку водителю: подтверждение — это и есть факт доставки.
 */
create or replace function public.acknowledge_amendments(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_count integer;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if not (
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin())
  ) then
    raise exception 'Отметить изменения может только назначенный перевозчик.'
      using errcode = '42501';
  end if;

  with seen as (
    update public.order_amendments
    set acknowledged_at = now(), acknowledged_by = (select auth.uid())
    where order_id = p_order_id and acknowledged_at is null
    returning 1
  )
  select count(*)::integer into v_count from seen;

  return v_count;
end;
$$;

comment on function public.acknowledge_amendments(uuid) is
  'Перевозчик подтверждает, что видел правки маршрута. Этап 8: то же делает n8n после доставки водителю.';

revoke all on function public.amend_stop(uuid, jsonb) from public, anon;
revoke all on function public.add_stop(uuid, jsonb) from public, anon;
revoke all on function public.remove_stop(uuid) from public, anon;
revoke all on function public.store_route(uuid, jsonb) from public, anon;
revoke all on function public.acknowledge_amendments(uuid) from public, anon;
grant execute on function public.amend_stop(uuid, jsonb) to authenticated, service_role;
grant execute on function public.add_stop(uuid, jsonb) to authenticated, service_role;
grant execute on function public.remove_stop(uuid) to authenticated, service_role;
grant execute on function public.store_route(uuid, jsonb) to authenticated, service_role;
grant execute on function public.acknowledge_amendments(uuid) to authenticated, service_role;
