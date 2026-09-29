-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · API заказчиков, полный цикл — этап 1: чтение
--
-- Отклики перевозчиков для API: те же строки, что видит заказчик в
-- кабинете (offers_for_shipper), от имени выпустившего ключ — правила
-- анонимности живут там, второй копии им не нужно.
--
-- Сроки хранения точек местоположения. Приложение водителя записывает
-- место не только при отметке «пройдена», но и при прибытии, при каждом
-- снимке и в начале и конце смены. Очистка через 24 месяца стирала
-- только отметку «пройдена»: прибытие, снимки, оставшиеся дольше фото
-- (CMR и подпись хранятся шесть лет, место съёмки — нет) и смены
-- хранили координаты без срока. Теперь все точки стираются одним
-- правилом — 24 месяца после конца рейса или смены; сами события,
-- времена и документы остаются на свой срок.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.api_order_offers(p_key_id uuid, p_order_ids uuid[])
returns table (
  offer_id uuid,
  order_id uuid,
  variant_no integer,
  plate text,
  make text,
  euro_class text,
  axles integer,
  driver_name text,
  languages text[],
  rating numeric,
  base_city text,
  created_at timestamptz,
  is_chosen boolean,
  is_assigned boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select k.created_by into v_user from public.api_keys k where k.id = p_key_id and k.revoked_at is null;
  if v_user is null then
    return;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  return query
  select o.offer_id, o.order_id, o.variant_no::integer, o.plate::text, o.make::text, o.euro_class::text,
         o.axles::integer, o.driver_name::text, o.languages::text[], o.rating::numeric, o.base_city::text,
         o.created_at, o.is_chosen, o.is_assigned
  from public.offers_for_shipper(p_order_ids) o;
end;
$$;

revoke all on function public.api_order_offers(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.api_order_offers(uuid, uuid[]) to service_role;


-- ── Точки местоположения: 24 месяца для всех ───────────────────────

create or replace function app.purge_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_positions integer;
  v_arrivals integer;
  v_captures integer;
  v_shifts integer;
  v_app_events integer;
  v_messages integer;
  v_support integer;
  v_notifications integer;
  v_driver_notifications integer;
  v_outbox integer;
begin
  update public.order_stops s
  set completed_lat = null, completed_lon = null, completed_accuracy_m = null
  where s.completed_lat is not null
    and app.order_expired(s.order_id, interval '24 months');
  get diagnostics v_positions = row_count;

  update public.order_stops s
  set arrived_lat = null, arrived_lon = null
  where s.arrived_lat is not null
    and app.order_expired(s.order_id, interval '24 months');
  get diagnostics v_arrivals = row_count;

  /* Фото удаляются целиком маршрутом; у CMR и подписи уходит только место съёмки. */
  update public.order_documents d
  set captured_lat = null, captured_lon = null
  where d.captured_lat is not null
    and app.order_expired(d.order_id, interval '24 months');
  get diagnostics v_captures = row_count;

  update public.driver_shifts s
  set start_lat = null, start_lon = null, end_lat = null, end_lon = null
  where (s.start_lat is not null or s.end_lat is not null)
    and coalesce(s.ended_at, s.started_at) < now() - interval '24 months';
  get diagnostics v_shifts = row_count;

  delete from public.driver_app_events where received_at < now() - interval '24 months';
  get diagnostics v_app_events = row_count;

  delete from public.messages where created_at < now() - interval '24 months';
  get diagnostics v_messages = row_count;

  delete from public.support_messages where created_at < now() - interval '24 months';
  get diagnostics v_support = row_count;

  delete from public.notifications where created_at < now() - interval '12 months';
  get diagnostics v_notifications = row_count;

  delete from public.driver_notifications where created_at < now() - interval '12 months';
  get diagnostics v_driver_notifications = row_count;

  delete from public.email_outbox where created_at < now() - interval '12 months';
  get diagnostics v_outbox = row_count;

  return jsonb_build_object(
    'stop_positions', v_positions,
    'arrival_positions', v_arrivals,
    'capture_positions', v_captures,
    'shift_positions', v_shifts,
    'driver_app_events', v_app_events,
    'messages', v_messages,
    'support_messages', v_support,
    'notifications', v_notifications,
    'driver_notifications', v_driver_notifications,
    'email_outbox', v_outbox
  );
end;
$$;

revoke all on function app.purge_operational_data() from public, anon, authenticated;
