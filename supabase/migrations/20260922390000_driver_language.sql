-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · приложение водителя говорит на языке водителя
--
-- 22.09.2026 решение пользователя: платформа остаётся на финском и
-- английском, а приложение водителя подхватывает язык телефона —
-- эстонский, русский, шведский, латышский, литовский, польский,
-- норвежский, датский — и позволяет выбрать язык вручную в профиле.
--
-- Язык хранится у водителя, а не в куке: он переживает переустановку
-- приложения и смену телефона, а входит водитель по коду с нового
-- устройства нередко. NULL — «как на телефоне»: язык берётся из
-- Accept-Language, и если ни один не подошёл, остаётся финский.
--
-- Менять язык водитель может только себе: колонка закрыта, правка идёт
-- через функцию set_driver_language под его сессией.
-- ═══════════════════════════════════════════════════════════════════

alter table public.drivers
  add column app_language text
    constraint drivers_app_language check (
      app_language is null
      or app_language in ('fi', 'en', 'et', 'ru', 'sv', 'lv', 'lt', 'pl', 'nb', 'da')
    );

comment on column public.drivers.app_language is
  'Язык приложения водителя. NULL — по языку устройства.';

create or replace function public.set_driver_language(p_language text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select app.current_driver_id());
begin
  if v_driver is null then
    raise exception 'Язык приложения меняет только водитель.' using errcode = '42501';
  end if;

  update public.drivers
  set app_language = nullif(btrim(coalesce(p_language, '')), '')
  where id = v_driver;
end;
$$;

comment on function public.set_driver_language(text) is
  'Язык приложения водителя; пустая строка — снова по языку устройства.';

revoke all on function public.set_driver_language(text) from public, anon;
grant execute on function public.set_driver_language(text) to authenticated;

/* driver_me отдаёт язык: приложение решает, на чём говорить, до первого экрана. */
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
