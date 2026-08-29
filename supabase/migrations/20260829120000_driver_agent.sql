-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · опора под агента водителя в n8n
--
-- Самого агента здесь нет: он живёт во внешнем воркфлоу. Здесь ровно
-- три функции, которыми он пользуется, и главное свойство у них общее —
-- ни одна не принимает идентификатор рейса.
--
-- Это и есть гарантия изоляции. Не проверка «а свой ли это рейс»,
-- которую можно забыть написать, а отсутствие поля: рейс выводится из
-- телефона внутри функции, и вписать чужой номер заказа агенту просто
-- некуда. Тот же приём, что в инструментах n8n для кабинетов.
--
-- Записывающая операция ровно одна — отметка следующей точки. Она берёт
-- не ту точку, которую назвали снаружи, а ту, которая идёт следующей по
-- порядку. Поэтому «только вперёд» здесь не правило, а устройство.
-- ═══════════════════════════════════════════════════════════════════

-- ── Телефон ────────────────────────────────────────────────────────

/*
 * Номер к сравнимому виду: одни цифры.
 *
 * В базе номер лежит в E.164 с плюсом — это гарантирует ограничение
 * vehicles_whatsapp_format. WhatsApp присылает те же цифры без плюса,
 * иногда с ведущими нулями международного набора. Снятие всего, кроме
 * цифр, и ведущих нулей приводит обе записи к одному виду.
 *
 * Национальная запись (0400 123456) намеренно НЕ достраивается до
 * международной. Догадка о стране — это догадка о человеке: у финского
 * 040 и у чужого 040 одинаковое начало, и «умная» нормализация однажды
 * покажет водителю чужой рейс. Пусть лучше не найдёт ничего.
 */
create or replace function app.phone_digits(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '^0+', ''), '');
$$;

comment on function app.phone_digits(text) is
  'Номер к сравнимому виду: только цифры, без ведущих нулей. Страну не достраивает.';


-- ── Кто это ────────────────────────────────────────────────────────

/*
 * Машины, закреплённые за этим номером. Обычно одна.
 *
 * Сравнение строгим равенством нормализованных цифр. Похожесть,
 * вхождение подстроки и like здесь недопустимы: «...40123456» совпадёт
 * с чужим номером, а ценой ошибки будет чужой рейс на чужом экране.
 */
create or replace function app.driver_vehicles(p_phone text)
returns setof public.vehicles
language sql
stable
security definer
set search_path = ''
as $$
  select v.*
  from public.vehicles v
  where app.phone_digits(v.whatsapp) is not null
    and app.phone_digits(v.whatsapp) = app.phone_digits(p_phone)
    and v.access = 'APPROVED';
$$;

revoke all on function app.driver_vehicles(text) from public, anon, authenticated;


-- ── 1. Что у водителя в работе ─────────────────────────────────────

/*
 * Идущие рейсы этого водителя со всем, что нужно для ответа.
 *
 * Массив, а не один рейс. Один телефон на двух машинах — ошибка данных,
 * но она случается, и выбрать за водителя один из двух настоящих рейсов
 * хуже, чем отдать оба и дать агенту переспросить.
 *
 * Номера брони отдельной графой нет и не будет: у одного порта это
 * бронь, у другого визит, у третьего пропуск, и графа стояла пустой в
 * большинстве заказов. Всё это лежит в инструкциях к точке — там же, где
 * водитель это и читает.
 */
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
       */
      'guides', (
        select coalesce(jsonb_agg(distinct jsonb_build_object(
          'place_key', g.place_key,
          'locale', g.locale,
          'title', g.title,
          'body', g.body,
          'from_shipper', g.company_id is not null
        )), '[]'::jsonb)
        from public.place_guides g
        where (g.company_id is null or g.company_id = o.shipper_company_id)
          and exists (
            select 1 from public.order_stops s
            where s.order_id = o.id
              and (lower(g.place_key) = lower(coalesce(s.place_name, ''))
                or lower(g.place_key) = lower(s.city))
          )
      )
    ) as trip
    from public.orders o
    join public.vehicles v on v.id = o.assigned_vehicle_id
    where o.status = 'IN_PROGRESS'
      and v.id in (select id from app.driver_vehicles(p_phone))
  ) trips;
$$;

revoke all on function public.driver_active_trips(text) from public, anon, authenticated;
grant execute on function public.driver_active_trips(text) to service_role;


-- ── 2. Отметка этапа ───────────────────────────────────────────────

/*
 * Единственная операция записи во всём этом наборе.
 *
 * Отмечается следующая непройденная точка — та, которую вернул бы
 * driver_active_trips в progress.next. Снаружи выбрать точку нельзя, и
 * поэтому «шаг назад» и «шаг через один» невозможны не потому, что
 * запрещены, а потому, что их нечем выразить.
 *
 * p_expect — ожидаемая роль со слов водителя. Если он говорит
 * «выгрузился», а следующая точка — забор прицепа, отметка не проходит.
 * Без этой проверки агент, неверно понявший фразу, продвинул бы рейс.
 */
create or replace function public.driver_complete_next_stop(
  p_phone text,
  p_expect public.stop_role default null,
  p_damage_note text default null
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

  update public.order_stops
  set completed_at = now(),
      damage_note = nullif(btrim(coalesce(p_damage_note, '')), ''),
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
      'damage_note', v_stop.damage_note
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

revoke all on function public.driver_complete_next_stop(text, public.stop_role, text)
  from public, anon, authenticated;
grant execute on function public.driver_complete_next_stop(text, public.stop_role, text)
  to service_role;


-- ── 3. Вопрос оператору ────────────────────────────────────────────

/*
 * Агент не знает ответа — вопрос уходит человеку.
 *
 * Пишется в ту же очередь, которую оператор уже читает в админке.
 * Отдельного канала для водителя не заводим: оператору всё равно, из
 * чьего окна пришёл вопрос, а вторая очередь — это вторая очередь,
 * которую однажды перестанут смотреть.
 */
create or replace function public.driver_escalate(p_phone text, p_question text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles;
  v_company public.companies;
  v_ref text;
  v_id bigint;
begin
  select * into v_vehicle from app.driver_vehicles(p_phone) limit 1;

  if v_vehicle.id is null then
    raise exception 'Номер не принадлежит ни одной допущенной машине.' using errcode = 'P0002';
  end if;

  if length(btrim(coalesce(p_question, ''))) < 3 then
    raise exception 'Вопрос пуст.' using errcode = '22023';
  end if;

  select * into v_company from public.companies where id = v_vehicle.company_id;

  /* Номер рейса в теме, если он есть: оператору не придётся выяснять. */
  select o.ref into v_ref
  from public.orders o
  where o.status = 'IN_PROGRESS' and o.assigned_vehicle_id = v_vehicle.id
  limit 1;

  insert into public.support_messages (company_id, role, from_email, subject, body)
  values (
    v_vehicle.company_id,
    'CARRIER',
    v_company.contact_email,
    left('Kuljettajan kysymys · ' || coalesce(v_ref, v_vehicle.plate), 200),
    left(
      btrim(p_question)
        || E'\n\n— ' || v_vehicle.driver_name || ' · ' || v_vehicle.plate
        || ' · ' || v_vehicle.whatsapp,
      4000
    )
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'ref', v_ref, 'company', v_company.name);
end;
$$;

revoke all on function public.driver_escalate(text, text) from public, anon, authenticated;
grant execute on function public.driver_escalate(text, text) to service_role;


-- ── Заказчик узнаёт о пройденной точке ─────────────────────────────

/*
 * Уведомление вешается на саму отметку, а не на эндпоинт водителя.
 *
 * Событие одно — «точка пройдена», — а источников у него два: водитель
 * через WhatsApp и диспетчер в кабинете. Написать уведомление только в
 * функции водителя значило бы, что отметка из кабинета остаётся немой.
 *
 * До сих пор о прохождении точек не узнавал никто: триггеры были на
 * отклики, статусы, правки и допуск машин, а на движение рейса — нет.
 */
create or replace function app.on_stop_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if new.completed_at is null or old.completed_at is not null then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if v_order.id is null then
    return new;
  end if;

  perform app.notify_event(
    v_order.shipper_company_id,
    'ORDER',
    'trip.stop.done',
    jsonb_build_object(
      'ref', v_order.ref,
      'place', coalesce(new.place_name, new.company_name, new.city),
      'done', (select count(*) from public.order_stops s
               where s.order_id = new.order_id and s.completed_at is not null),
      'total', (select count(*) from public.order_stops s where s.order_id = new.order_id)
    ),
    '/shipper/orders'
  );

  return new;
end;
$$;

create trigger order_stops_notify_completed
  after update of completed_at on public.order_stops
  for each row execute function app.on_stop_completed();


-- ── Роль агента водителя ───────────────────────────────────────────

/*
 * Роль без входа, как agent и monitor. Под ней не подключаются — она
 * существует, чтобы у прав было имя и чтобы список того, что агенту
 * можно, читался запросом к каталогу, а не глазами по коду.
 */
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'driver_agent') then
    create role driver_agent nologin;
  end if;
end;
$$;

revoke all on all tables in schema public from driver_agent;
revoke all on all sequences in schema public from driver_agent;
revoke all on all functions in schema public from driver_agent;
revoke all on schema app from driver_agent;

grant usage on schema public to driver_agent;

grant execute on function public.driver_active_trips(text) to driver_agent;
grant execute on function public.driver_complete_next_stop(text, public.stop_role, text)
  to driver_agent;
grant execute on function public.driver_escalate(text, text) to driver_agent;


/* Проверка прав теперь знает и про третью роль. */
create or replace function public.role_privileges(p_role text)
returns table (object text, privilege text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ((select app.is_admin()) or (select auth.role()) = 'service_role') then
    raise exception 'Привилегии смотрит только оператор.' using errcode = '42501';
  end if;

  if p_role not in ('agent', 'monitor', 'driver_agent') then
    raise exception 'Неизвестная роль: %', p_role using errcode = '22023';
  end if;

  return query
  select (g.table_schema || '.' || g.table_name)::text, g.privilege_type::text
  from information_schema.role_table_grants g
  where g.grantee = p_role

  union all

  select (n.nspname || '.' || p.proname)::text, 'EXECUTE'::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where has_function_privilege(p_role, p.oid, 'EXECUTE')
    and n.nspname in ('public', 'app')
    and (
      p.proname like 'agent\_%'
      or p.proname like 'driver\_%'
      or p.proname in ('platform_pulse', 'record_incident')
    )

  order by 1, 2;
end;
$$;

revoke all on function public.role_privileges(text) from public, anon;
grant execute on function public.role_privileges(text) to authenticated, service_role;
