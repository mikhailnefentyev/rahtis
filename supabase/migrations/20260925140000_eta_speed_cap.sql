-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · оценка прибытия не быстрее 70 км/ч в среднем
--
-- Грузовой профиль TomTom даёт на трассе 78–80 км/ч в среднем (замер по
-- рейсам 25.09: Ханко → Суоненйоки 482 км за 6 ч 12 мин). Это скорость по
-- пустой дороге без въездов, заправок и обгонов — реальная сцепка её не
-- держит, и заказчик видел машину раньше, чем она приедет.
--
-- Решение пользователя от 25.09: для оценки средняя скорость не выше
-- 70 км/ч. Время плеча — большее из двух: расчёт TomTom или расстояние на
-- 70 км/ч. Короткие городские плечи, где TomTom и так медленнее, не
-- меняются. Та же цифра — ETA_MAX_AVG_KMH в src/lib/config.ts (пересчёт с
-- пробками); поменять — в обоих местах.
--
-- Оценки, уже стоящие у точек, не пересчитываются: они уйдут со
-- следующей отметкой.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.on_stop_completed_eta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next public.order_stops;
  v_seconds double precision;
begin
  select * into v_next
  from public.order_stops s
  where s.order_id = new.order_id and s.sequence > new.sequence
  order by s.sequence
  limit 1;

  if v_next.id is null then
    return new;
  end if;

  if new.completed_at is not null and old.completed_at is null then
    if v_next.completed_at is null and v_next.leg_duration_s is not null then
      /* 70 км/ч = 70 / 3,6 м/с. Без расстояния — как посчитал TomTom. */
      v_seconds := greatest(
        v_next.leg_duration_s,
        coalesce(v_next.leg_distance_m / (70 / 3.6), 0)
      );

      update public.order_stops
      set eta_at = new.completed_at + make_interval(secs => v_seconds),
          eta_source = 'ROUTE',
          eta_updated_at = now()
      where id = v_next.id;
    end if;
  elsif new.completed_at is null and old.completed_at is not null then
    update public.order_stops
    set eta_at = null, eta_source = null, eta_updated_at = null
    where id = v_next.id and completed_at is null;
  end if;

  return new;
end;
$$;

revoke all on function app.on_stop_completed_eta() from public, anon, authenticated;
