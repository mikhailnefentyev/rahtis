-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · пульс замечает ненастроенное расписание документов периода
--
-- Задание документов расчётного периода стоит в cron, но без
-- settlement_url в runtime_config оно молча ничего не делает. Заметить
-- это некому: документов нет, уведомлений о них тоже нет, а первое число
-- приходит раз в полмесяца — к тому времени пропущено два периода.
--
-- Пульс уже считает недели без отчёта ровно по этой причине. Здесь тот
-- же приём: ненастроенный адрес — поломка, а не «ещё не дошли руки».
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.platform_pulse()
returns table (
  metric text,
  value bigint,
  threshold bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select 'deadlines_overdue', count(*)::bigint, 0::bigint
  from public.orders
  where deadline_at is not null and deadline_at < now() - interval '5 minutes'
    and status = 'AWAIT_DRIVER'

  union all

  select 'email_stuck', count(*)::bigint, 0::bigint
  from public.email_outbox
  where status = 'PENDING' and created_at < now() - interval '30 minutes'

  union all

  select 'agent_hanging', count(*)::bigint, 0::bigint
  from public.conversations
  where pending_since is not null and pending_since < now() - interval '10 minutes'

  union all

  select 'incidents_fatal', count(*)::bigint, 0::bigint
  from public.incidents
  where status <> 'RESOLVED' and severity = 'FATAL'

  union all

  /*
   * Отчёт за позапрошлую неделю обязан существовать, если на той неделе
   * вообще что-то закрывали. Пустая неделя отчёта не порождает, и
   * считать её пропуском неверно.
   */
  select 'weekly_report_missing',
    case
      when not exists (
        select 1 from public.orders o
        where o.status = 'DONE'
          and o.closed_at >= (date_trunc('week', now()) - interval '14 days')
          and o.closed_at < (date_trunc('week', now()) - interval '7 days')
      ) then 0
      when exists (
        select 1 from public.weekly_reports r
        where r.week = (date_trunc('week', now()) - interval '14 days')::date
      ) then 0
      else 1
    end::bigint,
    0::bigint

  union all

  /*
   * Расписание документов расчётного периода настроено?
   *
   * Задание стоит в cron, но без settlement_url оно молча ничего не
   * делает — и заметить это некому: документов нет, уведомлений о них
   * тоже нет, а первое число проходит раз в полмесяца. Поэтому
   * ненастроенный адрес считается поломкой, а не «ещё не дошли руки».
   */
  select 'settlement_not_configured',
    case when exists (
      select 1 from app.runtime_config where key = 'settlement_url'
    ) then 0 else 1 end::bigint,
    0::bigint

  union all

  select 'incidents_open', count(*)::bigint, null::bigint
  from public.incidents
  where status <> 'RESOLVED'

  union all

  select 'orders_running', count(*)::bigint, null::bigint
  from public.orders
  where status in ('AWAIT_DRIVER', 'IN_PROGRESS');
$$;
