-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · планировщик наконец соединён с сайтом
--
-- НАЙДЕНО. В app.runtime_config лежал один ключ — settlement_url.
-- Ни reports_url, ни reports_secret там не было никогда. Значит:
--
--   • app.run_weekly_reports() каждый понедельник в 04:00 просыпалась,
--     не находила адреса, писала notice в лог и возвращала null. Cron
--     считал задание выполненным успешно — своё дело оно и правда
--     сделало;
--   • app.run_period_settlement() 1-го и 16-го вела себя так же: адрес
--     у неё был, а секрет она берёт из того же reports_secret;
--   • очередь net._http_response была пуста — наружу не ушло ни одного
--     запроса.
--
-- Оба отчёта, что лежат в базе, выпущены руками через маршрут. Со
-- стороны это выглядело как работающее расписание.
--
-- ПОЧЕМУ ЭТОГО НЕ ЗАМЕТИЛ ПУЛЬС. Он проверял ровно один ключ —
-- settlement_url — и тот единственный, что был заполнен. Проверка
-- смотрела не туда, где ломается: функция читает settlement_url и
-- reports_secret, а спрашивали только про первый.
--
-- ЧТО ЗДЕСЬ ДЕЛАЕТСЯ.
--
-- 1. Настройки становится чем заполнить. Секрет запуска отчётов — это
--    право выпустить платёжные документы, и в миграцию, которая лежит в
--    git, он не пойдёт. Поэтому не «insert значения», а функция-сеттер:
--    значение приносит тот, кто его знает, служебным ключом.
--
-- 2. Появляется способ позвать задание руками — той же дорогой, что и
--    планировщик, через pg_net. Нужен он не для удобства: цепочка
--    cron → функция → очередь → сайт иначе проверяема только раз в
--    неделю, и следующий её обрыв опять будет найден постфактум.
--
-- 3. Пульс начинает спрашивать про все три ключа и смотреть на ответы
--    очереди. Ушедший запрос с кодом 401 — это тот же немой отказ, что
--    и неушедший: задание отработало, документов нет.
-- ═══════════════════════════════════════════════════════════════════


-- ── Чем заполнить настройки ────────────────────────────────────────

/*
 * Значение приходит снаружи служебным ключом и в git не попадает.
 *
 * Возвращается не значение, а длина: вызывающий и так знает, что
 * положил, а в логи и ответы PostgREST секрет попасть не должен.
 */
create or replace function public.set_runtime_config(
  p_key text,
  p_value text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := btrim(coalesce(p_key, ''));
  v_value text := coalesce(p_value, '');
begin
  if v_key = '' then
    raise exception 'Ключ настройки пустой.' using errcode = '22023';
  end if;

  if v_value = '' then
    raise exception 'Пустое значение настройки бессмысленно: удаляйте ключ, а не обнуляйте.'
      using errcode = '22023';
  end if;

  insert into app.runtime_config as c (key, value, note, updated_at)
  values (v_key, v_value, p_note, now())
  on conflict (key) do update
    set value = excluded.value,
        note = coalesce(excluded.note, c.note),
        updated_at = now();

  return jsonb_build_object('key', v_key, 'length', length(v_value));
end;
$$;

comment on function public.set_runtime_config(text, text, text) is
  'Заполнить настройку планировщика. Только служебным ключом: сюда кладут секреты, поэтому значение не возвращается.';

revoke all on function public.set_runtime_config(text, text, text)
  from public, anon, authenticated;
grant execute on function public.set_runtime_config(text, text, text) to service_role;


-- ── Позвать задание сейчас ─────────────────────────────────────────

/*
 * Тем же путём, что и cron: через app.run_*, а значит через pg_net.
 *
 * Прямой вызов маршрута курлом проверяет только сайт. Здесь проверяется
 * то, что на самом деле ломалось: доходит ли из базы наружу запрос и с
 * тем ли секретом.
 *
 * Возвращается номер запроса в очереди — по нему ответ находится в
 * scheduler_health.
 */
create or replace function public.run_scheduled_job(p_job text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request bigint;
begin
  case btrim(lower(coalesce(p_job, '')))
    when 'weekly-reports' then v_request := app.run_weekly_reports();
    when 'period-settlement' then v_request := app.run_period_settlement();
    else
      raise exception 'Неизвестное задание: %. Есть weekly-reports и period-settlement.', p_job
        using errcode = '22023';
  end case;

  /*
   * null означает, что функция не нашла настроек и промолчала, — ровно
   * та поломка, ради которой всё это пишется. Наружу она должна выйти
   * словами, а не пустотой.
   */
  if v_request is null then
    return jsonb_build_object(
      'queued', false,
      'reason', 'В app.runtime_config нет адреса или секрета: запрос не отправлен.'
    );
  end if;

  return jsonb_build_object('queued', true, 'request_id', v_request);
end;
$$;

comment on function public.run_scheduled_job(text) is
  'Выполнить задание планировщика немедленно, тем же путём через pg_net. Только служебным ключом.';

revoke all on function public.run_scheduled_job(text) from public, anon, authenticated;
grant execute on function public.run_scheduled_job(text) to service_role;


-- ── Пульс смотрит на всю цепочку ───────────────────────────────────

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
   * Ключей, без которых задание молчит, три, и спрашивать надо про все.
   *
   * Прежняя проверка смотрела на один settlement_url — единственный,
   * который был заполнен, — и полгода показывала «настроено» при
   * полностью немом планировщике. Считаются недостающие: имя метрики
   * осталось прежним, потому что смысл тот же, а вот цена ошибки
   * выросла — теперь она ловит и отчёты тоже.
   */
  select 'settlement_not_configured',
    (3 - (
      select count(*) from app.runtime_config
      where key in ('reports_url', 'reports_secret', 'settlement_url')
        and value is not null and value <> ''
    ))::bigint,
    0::bigint

  union all

  /*
   * Запрос ушёл и получил отказ — это та же тишина.
   *
   * Задание при этом считается выполненным: pg_net положил запрос в
   * очередь, cron доволен, документов нет. Восемь дней — окно чуть шире
   * недельного шага, чтобы неудачный понедельник был виден до
   * следующего.
   */
  select 'scheduler_http_failed', count(*)::bigint, 0::bigint
  from net._http_response
  where created > now() - interval '8 days'
    and (status_code is null or status_code >= 400 or error_msg is not null)

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


-- ── Срез планировщика: по три запуска на задание ───────────────────

/*
 * В прошлой версии бралось двадцать последних запусков подряд, и все
 * двадцать оказывались ежеминутным заданием о просроченных окнах —
 * недельное в этот список не попадало вовсе. Теперь по три на каждое.
 */
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
