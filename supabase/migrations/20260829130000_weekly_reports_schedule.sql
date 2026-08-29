-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · выпуск недельных отчётов по расписанию
--
-- Отчёты умеют выпускаться с августа, но их до сих пор никто не звал:
-- маршрут /api/reports/weekly существовал, а расписания к нему не было.
-- Два отчёта, что лежат в базе, выпущены руками.
--
-- Планировщик берётся из базы, а не с хостинга. Причина простая: база
-- переживёт смену площадки, а расписание, заведённое в панели Vercel,
-- при переезде на что-то другое молча исчезнет вместе с ней. Отчёты —
-- это деньги перевозчиков, они не должны зависеть от того, где сегодня
-- крутится Next.
--
-- День недели — ПОНЕДЕЛЬНИК, а не воскресенье, и это не мелочь.
-- lastWeek() в generate.ts берёт понедельник текущей недели и отнимает
-- семь дней. Запущенный в воскресенье, он выпустил бы отчёт за неделю,
-- закончившуюся семь дней назад, а неделю, которая закрывается прямо
-- сейчас, пропустил бы до следующего раза. В понедельник утром он берёт
-- ровно ту неделю, что вчера закончилась.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pg_net;


-- ── Куда стучаться ─────────────────────────────────────────────────

/*
 * Адрес и секрет живут в базе, потому что зовёт база.
 *
 * Переменных окружения у планировщика нет: он выполняется внутри
 * Postgres, где process.env не существует. Таблица закрыта от всех, кроме
 * владельца и служебной роли: секрет запуска отчётов — это право
 * выпустить платёжные документы, и читать его некому.
 */
create table if not exists app.runtime_config (
  key text primary key,
  value text not null,
  note text,
  updated_at timestamptz not null default now()
);

revoke all on app.runtime_config from public, anon, authenticated;
grant select, insert, update on app.runtime_config to service_role;

comment on table app.runtime_config is
  'Настройки, нужные заданиям внутри базы: адрес сайта и секреты запуска. Наружу не отдаётся.';


-- ── Запуск ─────────────────────────────────────────────────────────

/*
 * Дёргает маршрут выпуска отчётов.
 *
 * net.http_post кладёт запрос в очередь и возвращает управление сразу —
 * ответ придёт в net._http_response. Ждать здесь нельзя: генерация
 * десятка PDF занимает секунды, а задание cron, висящее на HTTP-запросе,
 * держит соединение и однажды упрётся в таймаут.
 *
 * Ненастроенный адрес — не ошибка, а «ещё не выложились». Задание молча
 * ничего не делает вместо того, чтобы каждый понедельник писать в лог
 * исключение, на которое перестанут смотреть через месяц.
 */
create or replace function app.run_weekly_reports()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  select value into v_url from app.runtime_config where key = 'reports_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';

  if v_url is null or v_secret is null then
    raise notice 'Отчёты не выпущены: в app.runtime_config нет reports_url или reports_secret.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) into v_request;

  return v_request;
end;
$$;

revoke all on function app.run_weekly_reports() from public, anon, authenticated;


-- ── Расписание ─────────────────────────────────────────────────────

do $$
begin
  perform cron.unschedule('rahtis-weekly-reports');
exception
  when others then
    /* Задания ещё не было — нормально при первом применении. */
    null;
end;
$$;

/*
 * Понедельник, 04:00 UTC — это 06:00 зимой и 07:00 летом по Хельсинки.
 *
 * Время в cron задаётся в UTC, и переводить его дважды в год некому.
 * Поэтому взят час, который при обоих сдвигах остаётся ранним утром
 * понедельника: отчёт лежит в кабинете до начала рабочего дня, и при
 * этом ночь субботы-воскресенья уже полностью закрыта.
 */
select cron.schedule(
  'rahtis-weekly-reports',
  '0 4 * * 1',
  $$ select app.run_weekly_reports(); $$
);


-- ── Молчащее расписание видно в пульсе ─────────────────────────────

/*
 * Остановившийся планировщик — самая тихая из поломок: ничего не падает,
 * просто перестают приходить отчёты, и замечают это через месяц по
 * вопросу перевозчика «а где деньги за август».
 *
 * Поэтому пульс теперь считает недели без отчёта. Порог — одна:
 * позапрошлая неделя обязана быть закрыта, текущая ещё нет.
 */
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

  select 'incidents_open', count(*)::bigint, null::bigint
  from public.incidents
  where status <> 'RESOLVED'

  union all

  select 'orders_running', count(*)::bigint, null::bigint
  from public.orders
  where status in ('AWAIT_DRIVER', 'IN_PROGRESS');
$$;

revoke all on function public.platform_pulse() from public, anon, authenticated;
grant execute on function public.platform_pulse() to service_role, monitor;
