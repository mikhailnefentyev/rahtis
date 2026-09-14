-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · планировщик виден снаружи
--
-- Утром в понедельник отчёты не пришли, и выяснить почему оказалось
-- нечем. Цепочка длинная: cron будит app.run_weekly_reports(), та берёт
-- адрес и секрет из app.runtime_config и кладёт запрос в очередь pg_net,
-- pg_net стучится в /api/reports/weekly, и уже там рождается отчёт.
-- Порваться она может в любом из четырёх мест, а видно снаружи было
-- только последнее звено — появился отчёт или нет.
--
-- Хуже того, обрыв здесь молчаливый по устройству. Ненастроенный адрес
-- функция проглатывает намеренно (raise notice, и всё). Ответ pg_net
-- приходит в net._http_response и никем не читается: 401 от маршрута
-- выглядит ровно так же, как 200, — задание в обоих случаях считается
-- выполненным успешно, потому что своё дело оно сделало, положило
-- запрос в очередь.
--
-- Схемы cron и net закрыты и для PostgREST, и для свободного запроса
-- оператора (agent_sql запрещает их по имени). Поэтому здесь заводится
-- одна функция-окно: она читает эти три источника и отдаёт срез, по
-- которому видно, на каком шаге встало.
--
-- Секреты наружу не идут: у настроек показывается только сам факт, что
-- значение заполнено, и длина. Тело ответа режется до 500 знаков —
-- этого хватает, чтобы отличить «forbidden» от отчёта, и мало, чтобы
-- случайно вытащить содержимое.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.scheduler_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(

    'now', now(),

    /* Что заведено в планировщике и включено ли оно. */
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

    /* Последние запуски: когда, чем кончилось, что сказал Postgres. */
    'runs', (
      select coalesce(jsonb_agg(r), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'name', j.jobname,
          'status', d.status,
          'message', d.return_message,
          'started', d.start_time,
          'ended', d.end_time
        ) as r
        from cron.job_run_details d
        join cron.job j on j.jobid = d.jobid
        order by d.start_time desc
        limit 20
      ) t
    ),

    /* Настройки, без которых run_weekly_reports молча ничего не делает. */
    'config', (
      select coalesce(jsonb_object_agg(c.key, jsonb_build_object(
        'set', c.value is not null and c.value <> '',
        'length', length(coalesce(c.value, '')),
        'updated_at', c.updated_at
      )), '{}'::jsonb)
      from app.runtime_config c
    ),

    /* Чем ответил сайт на исходящие запросы очереди. */
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

comment on function public.scheduler_health() is
  'Срез по планировщику: задания, их запуски, заполненность настроек и ответы на исходящие запросы. Секреты не отдаются.';

revoke all on function public.scheduler_health() from public, anon, authenticated;
grant execute on function public.scheduler_health() to service_role, monitor;
