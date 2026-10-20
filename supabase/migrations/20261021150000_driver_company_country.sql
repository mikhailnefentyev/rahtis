-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · страна компании водителя в driver_me
--
-- Время событий, не привязанных к точке маршрута (смена, уведомления,
-- сообщения), показывается по стране компании того, кто смотрит
-- (21.10.2026). Водителю нужна страна его перевозчика: польский водитель
-- польского перевозчика видит смену по Варшаве. Тело функции — из
-- 20260922390000, плюс поле company_country.
-- ═══════════════════════════════════════════════════════════════════

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
    'app_language', d.app_language,
    'company_name', c.name,
    'company_country', c.country::text,
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
