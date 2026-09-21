-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · приложение водителя: вход, задания, отметки, смены
--
-- Водитель — пользователь Supabase Auth без профиля. Роль водителя — это
-- строка drivers с его auth_user_id (app.current_driver_id); кабинетов у
-- него нет, и enum party_role не расширяется.
--
-- ВХОД — по приглашению перевозчика, без SMS. Перевозчик получает
-- одноразовую ссылку на сутки и отправляет её водителю как хочет. В базе
-- лежит только хэш токена: утёкшая таблица приглашений не даёт войти.
-- Принимает приглашение сервер под служебным ключом — заводит
-- пользователя и привязывает его к водителю функцией, которую
-- authenticated не вызывает.
--
-- ДАННЫЕ — через функции с явным списком полей, как у заказчика:
-- водителю не отдаются ставка, комиссия, выплата и реквизиты
-- заказчика. Контакты точек — отдаются: без них водитель не найдёт
-- получателя.
-- ═══════════════════════════════════════════════════════════════════


-- ── Приглашения ────────────────────────────────────────────────────

create table public.driver_invites (
  id uuid primary key default gen_random_uuid(),

  driver_id uuid not null references public.drivers (id) on delete cascade,

  /* sha256 от токена в hex. Сам токен не хранится нигде. */
  token_hash text not null unique,

  expires_at timestamptz not null,
  used_at timestamptz,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index driver_invites_driver_idx on public.driver_invites (driver_id, created_at desc);

alter table public.driver_invites enable row level security;
revoke all on public.driver_invites from anon, authenticated;
grant select on public.driver_invites to authenticated;

create policy driver_invites_select_carrier
  on public.driver_invites for select to authenticated
  using ((select app.owns_driver(driver_id)));

create or replace function app.token_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

/*
 * Новое приглашение. Прежние неиспользованные гасятся: действует одна
 * ссылка, последняя отправленная. Токен возвращается один раз — больше
 * его взять неоткуда.
 */
create or replace function public.create_driver_invite(p_driver_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if (select app.current_party_role()) is distinct from 'CARRIER'
     or not app.owns_driver(p_driver_id) then
    raise exception 'Водитель не найден в вашей компании.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.drivers where id = p_driver_id and status = 'ACTIVE') then
    raise exception 'Водитель в архиве.' using errcode = '55000';
  end if;

  update public.driver_invites
  set expires_at = least(expires_at, now())
  where driver_id = p_driver_id and used_at is null and expires_at > now();

  insert into public.driver_invites (driver_id, token_hash, expires_at, created_by)
  values (p_driver_id, app.token_hash(v_token), now() + interval '24 hours', (select auth.uid()));

  return v_token;
end;
$$;

revoke all on function public.create_driver_invite(uuid) from public, anon;
grant execute on function public.create_driver_invite(uuid) to authenticated;

/* Что показать на странице приглашения до входа. Только служебный ключ. */
create or replace function public.driver_invite_preview(p_token text)
returns table (driver_id uuid, full_name text, company_name text, auth_user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.full_name, c.name, d.auth_user_id
  from public.driver_invites i
  join public.drivers d on d.id = i.driver_id and d.status = 'ACTIVE'
  join public.companies c on c.id = d.company_id
  where i.token_hash = app.token_hash(p_token)
    and i.used_at is null
    and i.expires_at > now();
$$;

/*
 * Погасить приглашение и привязать вход к водителю. Одним действием, под
 * блокировкой: одна ссылка — один вход, даже если её открыли дважды.
 */
create or replace function public.claim_driver_invite(p_token text, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.driver_invites;
begin
  select * into v_invite
  from public.driver_invites
  where token_hash = app.token_hash(p_token)
  for update;

  if v_invite.id is null or v_invite.used_at is not null or v_invite.expires_at <= now() then
    raise exception 'Приглашение недействительно.' using errcode = 'P0002';
  end if;

  update public.driver_invites set used_at = now() where id = v_invite.id;

  update public.drivers
  set auth_user_id = p_user_id
  where id = v_invite.driver_id and status = 'ACTIVE';

  if not found then
    raise exception 'Водитель в архиве.' using errcode = '55000';
  end if;

  return v_invite.driver_id;
end;
$$;

revoke all on function public.driver_invite_preview(text), public.claim_driver_invite(text, uuid)
  from public, anon, authenticated;
grant execute on function public.driver_invite_preview(text), public.claim_driver_invite(text, uuid)
  to service_role;

/*
 * Отвязать вход — потерянный телефон, уволенный водитель. Возвращает
 * пользователя, которого сервер затем удаляет: удаление гасит все его
 * сессии, а этого из SQL не сделать.
 */
create or replace function public.detach_driver_login(p_driver_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not app.owns_driver(p_driver_id) then
    raise exception 'Водитель не найден в вашей компании.' using errcode = '42501';
  end if;

  select auth_user_id into v_user from public.drivers where id = p_driver_id for update;
  update public.drivers set auth_user_id = null where id = p_driver_id;

  return v_user;
end;
$$;

revoke all on function public.detach_driver_login(uuid) from public, anon;
grant execute on function public.detach_driver_login(uuid) to authenticated;

/* Архив заодно отвязывает вход — archive_driver это уже делает. */


-- ── Кто я ──────────────────────────────────────────────────────────

create or replace function public.driver_me()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id,
    'full_name', d.full_name,
    'phone', d.phone,
    'languages', d.languages,
    'company_name', c.name,
    'vehicle_id', vd.vehicle_id,
    'plate', v.plate,
    'shift', (
      select jsonb_build_object(
        'id', s.id,
        'started_at', s.started_at,
        'break_started_at', (
          select b.started_at from public.driver_breaks b
          where b.shift_id = s.id and b.ended_at is null
        ),
        'break_minutes', (
          select coalesce(sum(extract(epoch from (b.ended_at - b.started_at)) / 60), 0)::integer
          from public.driver_breaks b
          where b.shift_id = s.id and b.ended_at is not null
        )
      )
      from public.driver_shifts s
      where s.driver_id = d.id and s.ended_at is null
    ),
    'unread', (
      select count(*) from public.driver_notifications n
      where n.driver_id = d.id and n.read_at is null
    )
  )
  from public.drivers d
  join public.companies c on c.id = d.company_id
  left join public.vehicle_drivers vd on vd.driver_id = d.id and upper_inf(vd.during)
  left join public.vehicles v on v.id = vd.vehicle_id
  where d.id = (select app.current_driver_id());
$$;

revoke all on function public.driver_me() from public, anon;
grant execute on function public.driver_me() to authenticated;


-- ── Задания ────────────────────────────────────────────────────────

/*
 * Рейсы водителя: ждущие подтверждения, идущие и закрытые за неделю.
 * Явный список полей: денег здесь нет (README «Водителю деньги не
 * показываются»), реквизитов заказчика — тоже.
 */
create or replace function public.driver_tasks()
returns table (
  id uuid,
  ref text,
  status public.order_status,
  direct boolean,
  deadline_at timestamptz,
  order_type public.order_type,
  haul_kind public.haul_kind,
  container_feet smallint,
  ldm numeric,
  trailer text,
  trailer_plate text,
  distance_km integer,
  comment text,
  shipper_name text,
  plate text,
  closed_at timestamptz,
  stops jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.ref,
    o.status,
    o.status = 'AWAIT_DRIVER' and o.deadline_at is null,
    o.deadline_at,
    o.order_type,
    o.haul_kind,
    o.container_feet,
    o.ldm,
    o.trailer,
    o.trailer_plate,
    o.distance_km,
    o.comment,
    c.name,
    v.plate,
    o.closed_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'sequence', s.sequence,
        'role', s.role,
        'place_kind', s.place_kind,
        'place_name', s.place_name,
        'company_name', s.company_name,
        'address', s.address,
        'city', s.city,
        'country', s.country,
        'lat', s.lat,
        'lon', s.lon,
        'scheduled_date', s.scheduled_date,
        'scheduled_time', s.scheduled_time,
        'contact_name', s.contact_name,
        'contact_phone', s.contact_phone,
        'external_ref', s.external_ref,
        'trailer_loaded', s.trailer_loaded,
        'seal_required', s.seal_required,
        'cargo_weight_kg', s.cargo_weight_kg,
        'consignee', s.consignee,
        'note', s.note,
        'completed_at', s.completed_at,
        'damage_note', s.damage_note
      ) order by s.sequence)
      from public.order_stops s
      where s.order_id = o.id
    ), '[]'::jsonb)
  from public.orders o
  join public.companies c on c.id = o.shipper_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where o.assigned_driver_id = (select app.current_driver_id())
    and (
      o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
      or (o.status = 'DONE' and o.closed_at > now() - interval '7 days')
    )
  order by
    case o.status when 'IN_PROGRESS' then 0 when 'AWAIT_DRIVER' then 1 else 2 end,
    o.closed_at desc nulls last,
    o.created_at;
$$;

revoke all on function public.driver_tasks() from public, anon;
grant execute on function public.driver_tasks() to authenticated;


-- ── Отметка точки водителем ────────────────────────────────────────

/*
 * Прежнее тело (20260914180000_stop_position), кроме права: точку
 * отмечает и назначенный перевозчик в кабинете, и водитель рейса в
 * приложении.
 */
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
    or v_order.assigned_driver_id = (select app.current_driver_id())
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


-- ── Смены из приложения ────────────────────────────────────────────

/*
 * Начать, прервать, продолжить и закончить день. Время — серверное:
 * офлайн-очередь с временем нажатия придёт отдельным этапом, и тогда
 * время клиента будет проверяться на правдоподобие здесь же.
 *
 * Смены из приложения пишутся с source = APP: перевозчик их не правит,
 * а удаляет — и это остаётся в журнале.
 */
create or replace function public.driver_shift_action(
  p_action text,
  p_lat double precision default null,
  p_lon double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select app.current_driver_id());
  v_shift public.driver_shifts;
  v_vehicle uuid;
  v_sane boolean := app.sane_position(p_lat, p_lon);
  /* Часы, а не время транзакции: отметки одного запроса не должны совпасть. */
  v_now timestamptz := clock_timestamp();
begin
  if v_driver is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  select * into v_shift from public.driver_shifts
  where driver_id = v_driver and ended_at is null
  for update;

  if p_action = 'START' then
    if v_shift.id is not null then
      raise exception 'Смена уже идёт.' using errcode = '55000';
    end if;

    select vehicle_id into v_vehicle from public.vehicle_drivers
    where driver_id = v_driver and upper_inf(during);

    insert into public.driver_shifts (driver_id, vehicle_id, started_at, source, start_lat, start_lon, created_by)
    values (
      v_driver, v_vehicle, v_now, 'APP',
      case when v_sane then p_lat end, case when v_sane then p_lon end,
      (select auth.uid())
    );
    return;
  end if;

  if v_shift.id is null then
    raise exception 'Смена не начата.' using errcode = '55000';
  end if;

  if p_action = 'BREAK' then
    insert into public.driver_breaks (shift_id, started_at)
    select v_shift.id, v_now
    where not exists (
      select 1 from public.driver_breaks where shift_id = v_shift.id and ended_at is null
    );
  elsif p_action = 'RESUME' then
    update public.driver_breaks set ended_at = v_now
    where shift_id = v_shift.id and ended_at is null;
  elsif p_action = 'END' then
    update public.driver_breaks set ended_at = v_now
    where shift_id = v_shift.id and ended_at is null;

    update public.driver_shifts
    set ended_at = v_now,
        end_lat = case when v_sane then p_lat end,
        end_lon = case when v_sane then p_lon end
    where id = v_shift.id;
  else
    raise exception 'Неизвестное действие %.', p_action using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.driver_shift_action(text, double precision, double precision) from public, anon;
grant execute on function public.driver_shift_action(text, double precision, double precision) to authenticated;

/*
 * Смены из приложения пишет только эта функция, а правит перевозчик
 * только ручные: политика driver_shifts_carrier пропускает запись с
 * source = MANUAL. Перерыв смены из приложения перевозчик тоже не
 * трогает — иначе через перерыв правилась бы чужая отметка.
 */
drop policy driver_breaks_carrier on public.driver_breaks;

create policy driver_breaks_carrier_read
  on public.driver_breaks for select to authenticated
  using (
    exists (
      select 1 from public.driver_shifts s
      where s.id = shift_id and (select app.owns_driver(s.driver_id))
    )
  );

create policy driver_breaks_carrier_write
  on public.driver_breaks for all to authenticated
  using (
    exists (
      select 1 from public.driver_shifts s
      where s.id = shift_id and s.source = 'MANUAL' and (select app.owns_driver(s.driver_id))
    )
  )
  with check (
    exists (
      select 1 from public.driver_shifts s
      where s.id = shift_id and s.source = 'MANUAL' and (select app.owns_driver(s.driver_id))
    )
  );

create policy driver_breaks_select_self
  on public.driver_breaks for select to authenticated
  using (
    exists (
      select 1 from public.driver_shifts s
      where s.id = shift_id and s.driver_id = (select app.current_driver_id())
    )
  );


-- ── Сообщить о проблеме ────────────────────────────────────────────

/*
 * Водитель пишет своему перевозчику: уведомление в кабинет с текстом и
 * рейсом. Перевозчику, а не оператору: водитель его работник, и первым
 * решает перевозчик. Оператор подключается уже из кабинета.
 */
create or replace function public.driver_report_problem(p_order_id uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers;
  v_ref text;
  v_text text := left(btrim(coalesce(p_text, '')), 300);
begin
  select * into v_driver from public.drivers where id = (select app.current_driver_id());

  if v_driver.id is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  if length(v_text) < 3 then
    raise exception 'Сообщение пустое.' using errcode = '22023';
  end if;

  select ref into v_ref from public.orders
  where id = p_order_id and assigned_driver_id = v_driver.id;

  perform app.notify_event(
    v_driver.company_id,
    'ORDER',
    'driver.problem',
    jsonb_build_object('driver', v_driver.full_name, 'ref', coalesce(v_ref, '—'), 'text', v_text),
    '/carrier/desk'
  );
end;
$$;

revoke all on function public.driver_report_problem(uuid, text) from public, anon;
grant execute on function public.driver_report_problem(uuid, text) to authenticated;


-- ── Политика: место в начале и конце смены ─────────────────────────

/*
 * Приложение пишет одну точку места в начале и в конце смены. Черновик
 * политики (20260921150000) говорил только о рабочем времени — дописан,
 * пока он черновик. Если его уже активировали, правка ждёт следующей
 * редакции: действующий текст задним числом не меняется.
 */
update public.legal_clauses c
set body = case c.locale
  when 'fi' then 'Työaikatiedot: työvuorojen alku ja loppu, tauot, käytetty ajoneuvo, mittarilukemat, huomiot sekä näiden merkintöjen muutosloki tekijöineen ja aikoineen. Niitä kirjaa kuljetusliike tai kuljettaja kuljettajasovelluksessa. Kun kuljettaja aloittaa tai lopettaa päivän sovelluksessa, selain voi antaa laitteen sijainnin: tallennetaan yksi piste kummastakin hetkestä, eikä sijaintia kysytä muulloin. Kuljetusliikkeen kuljettajalle asettama palkkamalli ja hinnat sekä niistä lasketut suuntaa-antavat summat näkyvät vain tälle kuljetusliikkeelle; niitä ei näytetä kuljettajalle, tilaajalle eikä muille kuljetusliikkeille.'
  else 'Working time data: the start and end of shifts, breaks, the vehicle used, odometer readings, notes and the change log of these entries with authors and times. They are recorded by the carrier or by the driver in the driver app. When the driver starts or ends the day in the app, the browser may provide the device''s location: one point is stored for each of those moments, and the location is not requested at any other time. The pay model and rates the carrier sets for a driver, and the indicative sums computed from them, are visible only to that carrier; they are not shown to the driver, the shipper or other carriers.'
end
from public.legal_documents d
where d.id = c.document_id
  and d.kind = 'PRIVACY' and d.version = 7 and d.status = 'DRAFT'
  and c.path = array[2, 7];
