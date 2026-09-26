-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · правка маршрута: ничего не встаёт перед забором
--
-- Прогон 26.09.2026: кнопка «+ Purku» под забором прицепа поставила
-- выгрузку раньше забора, и база это приняла. Интерфейс теперь вставляет
-- после выбранной точки; здесь — страховка на стороне базы: add_stop
-- отказывает, если новая точка встала бы перед забором. Остальное тело
-- функции без изменений (из миграции live_amendments).
-- ═══════════════════════════════════════════════════════════════════

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

  /*
   * Перед забором ничего не встаёт: рейс начинается с того, что единицу
   * забрали, и выгрузить или догрузить её раньше нельзя. Прежде база это
   * пропускала, и вставка «перед забором» ложилась в маршрут (прогон
   * 26.09.2026).
   */
  if v_target.role = 'PICKUP' then
    raise exception 'Перед забором точку не добавить: вставьте её после забора.'
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
