-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · приложение водителя: прибытие, осмотр с фото, подпись, CMR
--
-- Точка раскладывается на шаги, как у DFDS: прибытие → осмотр с фото →
-- подтверждение сдачи → готово. Раньше точка отмечалась одной кнопкой, и
-- время прибытия терялось: известно было только, когда водитель уехал.
-- А простой на погрузке считается именно от прибытия (соглашение
-- заказчика, раздел 5).
--
-- Фото осмотра — по сторонам полуприцепа, с отметкой повреждения. На
-- сдаче водитель видит снимок той же стороны при взятии: новая вмятина
-- отличима от старой прямо у ворот, а не через месяц в споре.
--
-- Подтверждение сдачи — подпись получателя на экране или снимок
-- подписанной накладной. Снимок накладной ложится видом CMR: с ним
-- перевозчик закрывает рейс, не загружая скан второй раз.
--
-- Файлы кладёт сервер служебным ключом: у водителя нет компании, и
-- политики хранилища его не знают. Строку пишет эта функция под сессией
-- водителя — и сверяет рейс с app.current_driver_id.
-- ═══════════════════════════════════════════════════════════════════

alter type public.photo_subject add value if not exists 'SIGNATURE';


-- ── Прибытие ───────────────────────────────────────────────────────

alter table public.order_stops
  add column arrived_at timestamptz,
  add column arrived_lat double precision,
  add column arrived_lon double precision,
  add constraint order_stops_arrived_position
    check ((arrived_lat is null) = (arrived_lon is null));

comment on column public.order_stops.arrived_at is
  'Когда водитель отметил прибытие. От него считается простой; completed_at — когда закончил.';

grant select (arrived_at, arrived_lat, arrived_lon) on public.order_stops to authenticated;

create or replace function public.driver_arrive_stop(
  p_stop_id uuid,
  p_lat double precision default null,
  p_lon double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.order_stops;
  v_order public.orders;
  v_sane boolean := app.sane_position(p_lat, p_lon);
begin
  select * into v_stop from public.order_stops where id = p_stop_id for update;
  select * into v_order from public.orders where id = v_stop.order_id;

  if v_order.id is null or v_order.assigned_driver_id is distinct from (select app.current_driver_id()) then
    raise exception 'Точка не из вашего рейса.' using errcode = '42501';
  end if;

  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Рейс не идёт, текущий статус: %.', v_order.status using errcode = '55000';
  end if;

  if v_stop.completed_at is not null then
    raise exception 'Точка уже пройдена.' using errcode = '55000';
  end if;

  /* Повторное нажатие не переписывает первое время прибытия. */
  update public.order_stops
  set arrived_at = coalesce(arrived_at, now()),
      arrived_lat = case when arrived_at is null and v_sane then p_lat else arrived_lat end,
      arrived_lon = case when arrived_at is null and v_sane then p_lon else arrived_lon end
  where id = p_stop_id;
end;
$$;

revoke all on function public.driver_arrive_stop(uuid, double precision, double precision) from public, anon;
grant execute on function public.driver_arrive_stop(uuid, double precision, double precision) to authenticated;


-- ── Сторона снимка и подписант ─────────────────────────────────────

alter table public.order_documents
  add column angle text,
  add column signer_name text,
  add constraint order_documents_angle_known
    check (angle is null or angle in ('FRONT', 'BACK', 'LEFT', 'RIGHT')),
  add constraint order_documents_signer_length
    check (signer_name is null or length(btrim(signer_name)) between 2 and 120);

comment on column public.order_documents.angle is
  'Сторона полуприцепа или кузова на снимке осмотра. По ней снимок сдачи сверяется со снимком взятия.';



-- ── Снимок из приложения ───────────────────────────────────────────

/*
 * Регистрирует файл, который сервер уже положил в trip-docs. Повтор той
 * же отправки (external_id) возвращает прежнюю строку: мобильная сеть
 * повторяет запросы, и второй экземпляр кадра не должен ложиться второй
 * строкой.
 */
create or replace function public.driver_register_photo(
  p_order_id uuid,
  p_stop_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes integer,
  p_subject public.photo_subject,
  p_angle text default null,
  p_damage boolean default false,
  p_cmr boolean default false,
  p_signer_name text default null,
  p_captured_at timestamptz default null,
  p_lat double precision default null,
  p_lon double precision default null,
  p_external_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_stop public.order_stops;
  v_phase public.trip_phase;
  v_kind public.trip_document_kind;
  v_id uuid;
  v_sane boolean := app.sane_position(p_lat, p_lon);
begin
  select * into v_order from public.orders where id = p_order_id;

  if v_order.id is null or v_order.assigned_driver_id is distinct from (select app.current_driver_id()) then
    raise exception 'Рейс не ваш.' using errcode = '42501';
  end if;

  /* Идущий рейс; закрытый — для досылки снятого без связи. */
  if v_order.status not in ('IN_PROGRESS', 'DONE') then
    raise exception 'Рейс в статусе % фото не принимает.', v_order.status using errcode = '55000';
  end if;

  if split_part(p_storage_path, '/', 1) <> p_order_id::text then
    raise exception 'Файл лежит не в папке рейса.' using errcode = '22023';
  end if;

  select * into v_stop from public.order_stops where id = p_stop_id and order_id = p_order_id;
  if v_stop.id is null then
    raise exception 'Точка не из этого рейса.' using errcode = '22023';
  end if;

  if p_external_id is not null then
    select id into v_id from public.order_documents where external_id = p_external_id;
    if v_id is not null then return v_id; end if;
  end if;

  /* Фаза — по роли точки: взятие единицы или груза — «до», остальное — «после». */
  v_phase := case when v_stop.role in ('PICKUP', 'EXTRA_LOAD') then 'PICKUP' else 'DELIVERY' end;

  v_kind := case
    when p_cmr then 'CMR'
    when p_damage then 'DAMAGE_PHOTO'
    when v_phase = 'PICKUP' then 'LOADING_PHOTO'
    else 'UNLOADING_PHOTO'
  end;

  insert into public.order_documents (
    order_id, stop_id, kind, storage_path, file_name, mime_type, size_bytes, uploaded_by,
    source, phase, subject, angle, signer_name, captured_at, captured_lat, captured_lon, external_id
  )
  values (
    p_order_id,
    p_stop_id,
    v_kind,
    p_storage_path,
    split_part(p_storage_path, '/', 4),
    p_mime_type,
    p_size_bytes,
    (select auth.uid()),
    'DRIVER_APP',
    v_phase,
    p_subject,
    p_angle,
    nullif(btrim(coalesce(p_signer_name, '')), ''),
    /* Время съёмки не из будущего и не старше суток: иначе — время приёма. */
    case
      when p_captured_at between now() - interval '1 day' and now() + interval '5 minutes' then p_captured_at
      else now()
    end,
    case when v_sane then p_lat end,
    case when v_sane then p_lon end,
    p_external_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.driver_register_photo(
  uuid, uuid, text, text, integer, public.photo_subject, text, boolean, boolean, text,
  timestamptz, double precision, double precision, text
) from public, anon;
grant execute on function public.driver_register_photo(
  uuid, uuid, text, text, integer, public.photo_subject, text, boolean, boolean, text,
  timestamptz, double precision, double precision, text
) to authenticated;

/*
 * Снимки рейса для водителя: чтобы видеть, что уже снято, и сверить
 * сторону при сдаче со снимком при взятии. Только его рейс.
 */
create or replace function public.driver_trip_photos(p_order_id uuid)
returns table (
  id uuid,
  stop_id uuid,
  kind public.trip_document_kind,
  phase public.trip_phase,
  subject public.photo_subject,
  angle text,
  signer_name text,
  storage_path text,
  captured_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.stop_id, d.kind, d.phase, d.subject, d.angle, d.signer_name, d.storage_path,
         coalesce(d.captured_at, d.created_at)
  from public.order_documents d
  join public.orders o on o.id = d.order_id
  where d.order_id = p_order_id
    and o.assigned_driver_id = (select app.current_driver_id())
  order by coalesce(d.captured_at, d.created_at);
$$;

revoke all on function public.driver_trip_photos(uuid) from public, anon;
grant execute on function public.driver_trip_photos(uuid) to authenticated;


-- ── Задания знают прибытие ─────────────────────────────────────────

/* Тело прежнее (20260922120000_driver_app), в точке добавлено arrived_at. */
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
        'arrived_at', s.arrived_at,
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
