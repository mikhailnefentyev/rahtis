-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · ответ на исходящий запрос перестаёт пропадать
--
-- Предыдущая миграция научила пульс смотреть на net._http_response —
-- и это было бы верно, если бы ответы там лежали. Они там не лежат:
-- pg_net хранит их несколько часов и вычищает фоновым работником.
-- Понедельничный отказ в 04:00 исчезал бы из виду к обеду того же дня,
-- то есть ровно к моменту, когда его заметят.
--
-- Поэтому исход каждого исходящего запроса переписывается из очереди в
-- собственную таблицу, пока он ещё там есть. Раз в пять минут задание
-- забирает подошедшие ответы, а неудачные заводит происшествием — тем
-- же способом, каким о себе сообщают ошибки маршрутов.
--
-- Отдельно оговорено «ответа не нашлось». Это не мелочь: если очередь
-- вычистили раньше, чем мы прочитали, мы не знаем, вышли документы или
-- нет, — и молчаливо считать такое успехом означало бы вернуть ту самую
-- поломку, ради которой всё это пишется. Такой запрос помечается
-- неуспешным явно.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists app.scheduler_calls (
  request_id bigint primary key,
  job text not null,
  queued_at timestamptz not null default now(),
  checked_at timestamptz,
  status_code integer,
  ok boolean,
  detail text
);

create index if not exists scheduler_calls_open_idx
  on app.scheduler_calls (queued_at)
  where checked_at is null;

revoke all on app.scheduler_calls from public, anon, authenticated;
grant select on app.scheduler_calls to service_role;

comment on table app.scheduler_calls is
  'Что задания планировщика отправили наружу и чем это кончилось. Живёт дольше очереди pg_net.';


-- ── Задания записывают, что отправили ──────────────────────────────

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

  insert into app.scheduler_calls (request_id, job)
  values (v_request, 'weekly-reports')
  on conflict (request_id) do nothing;

  return v_request;
end;
$$;

revoke all on function app.run_weekly_reports() from public, anon, authenticated;


create or replace function app.run_period_settlement()
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
  select value into v_url from app.runtime_config where key = 'settlement_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';

  if v_url is null or v_secret is null then
    raise notice 'Документы периода не выпущены: в app.runtime_config нет settlement_url или reports_secret.';
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

  insert into app.scheduler_calls (request_id, job)
  values (v_request, 'period-settlement')
  on conflict (request_id) do nothing;

  return v_request;
end;
$$;

revoke all on function app.run_period_settlement() from public, anon, authenticated;


-- ── Кто-то должен прочитать ответ ──────────────────────────────────

/*
 * Две минуты форы: выпуск десятка PDF занимает секунды, но запрос ещё
 * должен уйти и вернуться. Забирать раньше — значит каждый раз видеть
 * пустоту и перепроверять на следующем круге.
 *
 * Час на терпение: если ответа нет и через час, он уже не появится.
 * Такой случай отмечается неудачей, а не остаётся висеть навсегда —
 * незакрытая строка не сигнал, её никто не читает.
 */
create or replace function app.reconcile_scheduler_calls()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_resp record;
  v_ok boolean;
  v_code integer;
  v_detail text;
  v_done integer := 0;
begin
  for v_row in
    select * from app.scheduler_calls
    where checked_at is null and queued_at < now() - interval '2 minutes'
    order by queued_at
    limit 50
  loop
    select status_code, error_msg, timed_out, content
      into v_resp
      from net._http_response
      where id = v_row.request_id;

    if found then
      v_code := v_resp.status_code;
      v_ok := v_resp.status_code between 200 and 299
              and coalesce(v_resp.timed_out, false) = false
              and v_resp.error_msg is null;
      v_detail := left(coalesce(v_resp.error_msg, v_resp.content, ''), 500);

    elsif v_row.queued_at < now() - interval '1 hour' then
      v_code := null;
      v_ok := false;
      v_detail := 'Ответ не найден: очередь pg_net очищена раньше, чем его прочитали.';

    else
      continue;
    end if;

    update app.scheduler_calls
      set checked_at = now(), status_code = v_code, ok = v_ok, detail = v_detail
    where request_id = v_row.request_id;

    v_done := v_done + 1;

    /* Неудача выходит наружу происшествием, а не строкой в таблице. */
    if not v_ok then
      perform public.record_incident(
        'scheduler-' || v_row.job,
        'ERROR'::public.incident_severity,
        'cron',
        'scheduler_http',
        'Задание ' || v_row.job || ': запрос ушёл, но не удался — '
          || coalesce(v_code::text, 'без кода') || ' ' || left(coalesce(v_detail, ''), 200)
      );
    end if;
  end loop;

  return v_done;
end;
$$;

revoke all on function app.reconcile_scheduler_calls() from public, anon, authenticated;


create or replace function public.reconcile_scheduler_calls()
returns integer
language sql
security definer
set search_path = ''
as $$
  select app.reconcile_scheduler_calls();
$$;

comment on function public.reconcile_scheduler_calls() is
  'Забрать из очереди pg_net исходы запросов планировщика, пока они там есть. Зовётся расписанием.';

revoke all on function public.reconcile_scheduler_calls() from public, anon, authenticated;
grant execute on function public.reconcile_scheduler_calls() to service_role;


do $$
begin
  perform cron.unschedule('rahtis-scheduler-reconcile');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'rahtis-scheduler-reconcile',
  '*/5 * * * *',
  $$ select public.reconcile_scheduler_calls(); $$
);


-- ── Пульс считает по собственной таблице, а не по очереди ──────────

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

  select 'settlement_not_configured',
    (3 - (
      select count(*) from app.runtime_config
      where key in ('reports_url', 'reports_secret', 'settlement_url')
        and value is not null and value <> ''
    ))::bigint,
    0::bigint

  union all

  /* Восемь дней — окно чуть шире недельного шага расписания. */
  select 'scheduler_http_failed', count(*)::bigint, 0::bigint
  from app.scheduler_calls
  where queued_at > now() - interval '8 days' and ok is false

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


-- ── Срез планировщика показывает исходы, а не только очередь ───────

create or replace function public.scheduler_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(

    'now', now(),

    'jobs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'jobid', j.jobid,
        'name', j.jobname,
        'schedule', j.schedule,
        'active', j.active,
        'command', j.command
      ) order by j.jobname), '[]'::jsonb)
      from cron.job j
    ),

    'runs', (
      select coalesce(jsonb_agg(t.r order by t.started desc), '[]'::jsonb)
      from (
        select
          d.start_time as started,
          jsonb_build_object(
            'name', j.jobname,
            'status', d.status,
            'message', d.return_message,
            'started', d.start_time,
            'ended', d.end_time
          ) as r,
          row_number() over (partition by d.jobid order by d.start_time desc) as n
        from cron.job_run_details d
        join cron.job j on j.jobid = d.jobid
      ) t
      where t.n <= 3
    ),

    'config', (
      select coalesce(jsonb_object_agg(c.key, jsonb_build_object(
        'set', c.value is not null and c.value <> '',
        'length', length(coalesce(c.value, '')),
        'updated_at', c.updated_at
      )), '{}'::jsonb)
      from app.runtime_config c
    ),

    /* Исходы: живут дольше очереди и потому показываются первыми. */
    'calls', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'request_id', c.request_id,
        'job', c.job,
        'queued_at', c.queued_at,
        'checked_at', c.checked_at,
        'code', c.status_code,
        'ok', c.ok,
        'detail', left(coalesce(c.detail, ''), 300)
      ) order by c.queued_at desc), '[]'::jsonb)
      from (
        select * from app.scheduler_calls order by queued_at desc limit 10
      ) c
    ),

    'http', (
      select coalesce(jsonb_agg(h), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', x.id,
          'code', x.status_code,
          'timed_out', x.timed_out,
          'error', x.error_msg,
          'body', left(coalesce(x.content, ''), 500),
          'created', x.created
        ) as h
        from net._http_response x
        order by x.created desc
        limit 10
      ) t
    )
  );
$$;

revoke all on function public.scheduler_health() from public, anon, authenticated;
grant execute on function public.scheduler_health() to service_role, monitor;
