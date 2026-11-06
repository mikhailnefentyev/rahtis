-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · правки финальной проверки (7.11.2026)
--
--   1. app.combo_fit — проверки сцепки одним местом: код причины
--      (CLASS, SIZE, BODY) и текст. combo_fit_reason (отклик сцепкой,
--      take_order_combo) отдаёт тот же текст, combo_misfit (стол,
--      desk_matches) — код. Раньше код угадывался по началу русского
--      текста и ломался от любой правки формулировки.
--   2. public.publish_draft_order — черновик на стол одним нажатием.
--      Заказ под запрос свободного места создаётся черновиком (на столе
--      его не видно, взять его раньше перевозчика места нельзя); если
--      запрос отклонён или истёк — «опубликовать на столе». Проверки —
--      те же, что у публикации экспресса в app.create_order_for.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Сцепка: код и текст причины ────────────────────────────────

/*
 * Тело — из combo_fit_reason (20261028230000 с правкой кассеты из
 * 20261028230100), у каждого отказа добавлен код. Ветвление через
 * if/elsif: загрузчик миграций Supabase неверно режет оператор выбора.
 */
create or replace function app.combo_fit(
  p_combo public.vehicle_combos,
  p_order public.orders,
  out code text,
  out reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles;
  v_trailer public.trailers;
  v_kind text;
  v_ldm numeric;
  v_bodies text[];
  v_loading text[];
begin
  select * into v_vehicle from public.vehicles where id = p_combo.vehicle_id;
  if p_combo.trailer_id is not null then
    select * into v_trailer from public.trailers where id = p_combo.trailer_id;
  end if;

  v_kind := case
    when v_vehicle.vehicle_class = 'VAN' then 'VAN'
    when v_vehicle.vehicle_class = 'TRACTOR' then
      case when v_trailer.id is null then 'TRACTOR_SOLO' when v_trailer.body_type = 'TIPPER' then 'PUOLIKAS' else 'SEMI' end
    when v_vehicle.vehicle_class = 'TIPPER' then
      case when v_trailer.id is null then 'NUPPI' when v_trailer.body_type in ('TIPPER', 'CASSETTE') then 'KASETTI' else 'TRUCK_TRAILER' end
    else case when v_trailer.id is null then 'TRUCK' else 'TRUCK_TRAILER' end
  end;
  v_ldm := coalesce(case when v_vehicle.vehicle_class <> 'TRACTOR' then v_vehicle.ldm end, 0) + coalesce(v_trailer.ldm, 0);
  v_bodies := array_remove(array[
    case when v_vehicle.vehicle_class <> 'TRACTOR' then v_vehicle.body_type::text end,
    v_trailer.body_type::text], null);
  v_loading := coalesce(v_vehicle.loading, '{}') || coalesce(v_trailer.loading, '{}');

  if p_order.haul_kind = 'TRAILER' then
    if v_kind <> 'TRACTOR_SOLO' then
      code := 'CLASS';
      reason := 'Перецеп берёт тягач без своего полуприцепа.';
      return;
    end if;
  elsif p_order.haul_kind = 'CONTAINER' then
    if v_kind <> 'TRACTOR_SOLO' or not (p_order.container_feet = any (v_vehicle.container_feet)) then
      code := 'SIZE';
      reason := format('Нужен тягач с шасси под %s-футовый контейнер.', p_order.container_feet);
      return;
    end if;
  elsif p_order.haul_kind = 'SEMI' then
    if v_kind <> 'SEMI' then
      code := 'CLASS';
      reason := 'Нужен тягач с полуприцепом.';
      return;
    end if;
    if v_ldm < coalesce(p_order.ldm, 0) then
      code := 'SIZE';
      reason := format('Нужно от %s погрузочных метров.', p_order.ldm);
      return;
    end if;
    if not (coalesce(v_trailer.semi_features, '{}') @> coalesce(p_order.semi_features, '{}')) then
      code := 'SIZE';
      reason := 'У полуприцепа нет пометок заказа (MEGA, загрузка, крыша).';
      return;
    end if;
  elsif p_order.haul_kind = 'TIPPER' then
    if v_kind <> (case p_order.tipper_config when 'TRUCK' then 'NUPPI' when 'CASSETTE' then 'KASETTI' else 'PUOLIKAS' end) then
      code := 'CLASS';
      reason := 'Сцепка не того вида: нужен нуппи, кассета (нуппи + прицеп) или puolikas (тягач + самосвальный полуприцеп).';
      return;
    end if;
  else
    /* Фургон и грузовик: груз в кузове сцепки. */
    if v_kind not in ('VAN', 'TRUCK', 'TRUCK_TRAILER') then
      code := 'CLASS';
      reason := 'Нужен фургон или грузовик (можно с прицепом).';
      return;
    end if;
    if v_ldm < coalesce(p_order.ldm, 0) then
      code := 'SIZE';
      reason := format('Нужно от %s погрузочных метров.', p_order.ldm);
      return;
    end if;
  end if;

  if p_order.required_body is not null and not (p_order.required_body = any (v_bodies)) then
    code := 'BODY';
    reason := 'Нужен другой кузов.';
    return;
  end if;
  if not (v_loading @> coalesce(p_order.required_loading, '{}')) then
    code := 'BODY';
    reason := 'Нет нужного способа загрузки.';
    return;
  end if;
end;
$$;

revoke all on function app.combo_fit(public.vehicle_combos, public.orders) from public, anon, authenticated;

/* Текст для отклика сцепкой — прежний, из общего места. */
create or replace function app.combo_fit_reason(p_combo public.vehicle_combos, p_order public.orders)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select f.reason from app.combo_fit(p_combo, p_order) f;
$$;

revoke all on function app.combo_fit_reason(public.vehicle_combos, public.orders) from public, anon, authenticated;

/* Код для стола: годность сцепки кодом, груз — по расчёту сцепки. */
create or replace function app.combo_misfit(p_combo public.vehicle_combos, p_order public.orders)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  select f.code into v_code from app.combo_fit(p_combo, p_order) f;
  if v_code is not null then
    return v_code;
  end if;

  if app.order_max_weight_kg(p_order.id)
     > coalesce(p_combo.payload_kg, app.vehicle_capacity_kg(p_combo.vehicle_id)) then
    return 'WEIGHT';
  end if;

  return null;
end;
$$;

revoke all on function app.combo_misfit(public.vehicle_combos, public.orders) from public, anon, authenticated;


-- ── 2. Черновик — на стол ─────────────────────────────────────────

/*
 * Только экспресс (фургон, грузовик, фура) — под него и создаются
 * черновики для свободного места. Пока ждёт ответа запрос на место —
 * нельзя: заказ снова мог бы уйти другому раньше ответа. Уведомления
 * перевозчикам, договор стола и проверка условий — триггеры перехода
 * DRAFT → OPEN, как у обычной публикации.
 */
create or replace function public.publish_draft_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_order public.orders;
begin
  select * into v_company from public.companies where id = (select app.current_company_id());
  if v_company.id is null or v_company.kind <> 'SHIPPER' then
    raise exception 'Публиковать заказы может только заказчик.' using errcode = '42501';
  end if;
  if v_company.status <> 'ACTIVE' then
    raise exception 'Заполните реквизиты компании — без них заказ не опубликовать.' using errcode = '55000';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and shipper_company_id = v_company.id
  for update;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;
  if v_order.status <> 'DRAFT' then
    raise exception 'Заказ уже не черновик.' using errcode = '55000';
  end if;
  if v_order.haul_kind not in ('VAN', 'TRUCK', 'SEMI') then
    raise exception 'Так публикуется только экспресс.' using errcode = '22023';
  end if;
  if exists (select 1 from public.capacity_requests r where r.order_id = v_order.id and r.status = 'PENDING') then
    raise exception 'Запрос на место ещё ждёт ответа — сначала отмените его.' using errcode = '55000';
  end if;

  /* Как при публикации экспресса в app.create_order_for. */
  if not exists (select 1 from public.order_stops s where s.order_id = v_order.id and s.role = 'PICKUP') then
    raise exception 'Укажите адрес, где забрать груз.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.order_stops s where s.order_id = v_order.id and s.role = 'DELIVERY') then
    raise exception 'Укажите адрес доставки.' using errcode = '22023';
  end if;
  if app.order_max_weight_kg(v_order.id) = 0 then
    raise exception 'Укажите вес груза — по нему подбирается машина.' using errcode = '22023';
  end if;
  if v_order.distance_km is null or v_order.rate_cents is null then
    raise exception 'Укажите пробег и ставку.' using errcode = '22023';
  end if;

  update public.orders
  set status = 'OPEN', published_at = now()
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

comment on function public.publish_draft_order(uuid) is
  'Черновик экспресса (например, под запрос свободного места) — на стол, с проверками публикации.';

revoke all on function public.publish_draft_order(uuid) from public, anon;
grant execute on function public.publish_draft_order(uuid) to authenticated;
