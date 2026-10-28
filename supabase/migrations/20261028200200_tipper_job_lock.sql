-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · объект под самосвальный заказ — только платформа (28.10.2026)
--
-- Проверка 213ef9f: перевозчик мог из кабинета править объект под заказ
-- (site_jobs_own — for all): поднять запас к концу дня до 180 минут и
-- так раздуть итог по часам, сменить статус или удалить объект вместе с
-- днями. Теперь:
--   · строку объекта под заказ из кабинета нельзя ни править, ни удалять
--     (меняет её только триггер заказа под флагом rahtis.tipper_job);
--   · в итоге заказа запас к концу дня — всегда 30 минут, а не значение
--     строки.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.site_job_order_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.order_id is not null
     and current_user = 'authenticated'
     and coalesce(current_setting('rahtis.tipper_job', true), '') <> 'on' then
    raise exception 'Объект под заказ платформы из кабинета не меняется.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function app.site_job_order_lock() from public, anon, authenticated;

create trigger site_jobs_order_lock
  before update or delete on public.site_jobs
  for each row execute function app.site_job_order_lock();

create or replace function app.tipper_order_totals(p_order_id uuid)
returns table (days integer, open_days integer, minutes integer, loads integer, net_kg integer)
language sql
stable
security definer
set search_path = ''
as $$
  with o as (
    select assigned_company_id as company_id from public.orders where id = p_order_id
  ), j as (
    select sj.id from public.site_jobs sj, o where sj.order_id = p_order_id and sj.company_id = o.company_id
  ), d as (
    select sd.id, sd.arrived_at, sd.ended_at,
           (select max(l.unloaded_at) from public.site_loads l where l.day_id = sd.id) as last_unload
    from public.site_days sd, o
    where sd.job_id in (select id from j) and sd.company_id = o.company_id
  ), e as (
    /* Запас к концу дня у заказа платформы — стандартные 30 минут. */
    select d.*,
           case
             when d.ended_at is not null and d.last_unload is not null
               then greatest(d.ended_at, d.last_unload + interval '30 minutes')
             when d.ended_at is not null then d.ended_at
             when d.last_unload is not null then d.last_unload + interval '30 minutes'
           end as day_end
    from d
  )
  select
    count(*)::integer,
    count(*) filter (where e.day_end is null)::integer,
    coalesce(sum(least(16 * 60, greatest(0, round(extract(epoch from e.day_end - e.arrived_at) / 60)))) filter (where e.day_end is not null), 0)::integer,
    (select count(*)::integer from public.site_loads l, o where l.job_id in (select id from j) and l.company_id = o.company_id),
    (select coalesce(sum(l.net_kg), 0)::integer from public.site_loads l, o where l.job_id in (select id from j) and l.company_id = o.company_id)
  from e;
$$;
