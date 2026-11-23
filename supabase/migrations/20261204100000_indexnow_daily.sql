-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · ежедневная отправка изменившихся страниц в IndexNow (24.11.2026)
--
-- Bing не знал ни одной страницы сайта; от его индекса зависят ChatGPT,
-- Copilot и DuckDuckGo. Раз в день база будит /api/indexnow, маршрут берёт
-- из карты сайта адреса с lastmod за последние три дня и отправляет их в
-- IndexNow. Устроено как остальные задания: адрес маршрута — от адреса
-- отчётов, секрет — общий секрет планировщика.
-- ═══════════════════════════════════════════════════════════════════

insert into app.runtime_config (key, value, note)
select 'indexnow_url',
       regexp_replace(value, '/api/reports/weekly$', '/api/indexnow'),
       'Маршрут отправки изменившихся страниц в IndexNow. Будит app.run_indexnow.'
from app.runtime_config
where key = 'reports_url' and value ~ '/api/reports/weekly$'
on conflict (key) do nothing;

create or replace function app.run_indexnow()
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
  select value into v_url from app.runtime_config where key = 'indexnow_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';

  if v_url is null or v_secret is null then
    raise notice 'IndexNow не вызван: в app.runtime_config нет indexnow_url или reports_secret.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request;

  insert into app.scheduler_calls (request_id, job)
  values (v_request, 'indexnow')
  on conflict (request_id) do nothing;

  return v_request;
end;
$$;

revoke all on function app.run_indexnow() from public, anon, authenticated;

select cron.schedule(
  'rahtis-indexnow',
  '20 4 * * *',
  $$ select app.run_indexnow(); $$
);
