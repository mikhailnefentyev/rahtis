-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · push-уведомления водителю
--
-- Входящие водителя (driver_notifications) пишут триггеры рейса: прямой
-- заказ, выбор отклика, возврат на стол, отмена. Раньше они ждали, пока
-- водитель сам откроет приложение. Теперь каждая новая строка сразу
-- уходит на телефон push-уведомлением.
--
-- Отправляет сайт, а не база: подписи VAPID и шифрование сообщения
-- делает библиотека web-push. База только стучится в маршрут
-- /api/push/driver через pg_net — тем же приёмом и тем же секретом, что
-- выпуск отчётов, поэтому новой настройки планировщику не нужно.
-- net.http_post кладёт запрос в очередь и не держит транзакцию, которая
-- назначила рейс.
-- ═══════════════════════════════════════════════════════════════════

create table public.driver_push_subscriptions (
  id uuid primary key default gen_random_uuid(),

  driver_id uuid not null references public.drivers (id) on delete cascade,

  /* Адрес службы push браузера: по нему одно устройство отличается от другого. */
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,

  /* Язык приложения в момент подписки — на нём и текст уведомления. */
  locale text not null default 'fi',

  created_at timestamptz not null default now(),
  last_sent_at timestamptz,

  constraint driver_push_subscriptions_locale check (locale in ('fi', 'en')),
  constraint driver_push_subscriptions_endpoint check (endpoint ~ '^https://')
);

comment on table public.driver_push_subscriptions is
  'Подписки устройств водителя на push. Пишутся только driver_push_subscribe; читает сайт служебным ключом.';

create index driver_push_subscriptions_driver_idx on public.driver_push_subscriptions (driver_id);

alter table public.driver_push_subscriptions enable row level security;
revoke all on public.driver_push_subscriptions from anon, authenticated;

/*
 * Подписать это устройство. Адрес уже был у другого водителя — телефон
 * сменил хозяина — и переходит к текущему: уведомления прежнего сюда
 * приходить не должны.
 */
create or replace function public.driver_push_subscribe(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_locale text default 'fi'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select app.current_driver_id());
begin
  if v_driver is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  insert into public.driver_push_subscriptions (driver_id, endpoint, p256dh, auth, locale)
  values (v_driver, p_endpoint, p_p256dh, p_auth, case when p_locale = 'en' then 'en' else 'fi' end)
  on conflict (endpoint) do update
    set driver_id = excluded.driver_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        locale = excluded.locale;
end;
$$;

create or replace function public.driver_push_unsubscribe(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.driver_push_subscriptions
  where endpoint = p_endpoint and driver_id = (select app.current_driver_id());
$$;

revoke all on function public.driver_push_subscribe(text, text, text, text), public.driver_push_unsubscribe(text)
  from public, anon;
grant execute on function public.driver_push_subscribe(text, text, text, text), public.driver_push_unsubscribe(text)
  to authenticated;


-- ── Отправка ───────────────────────────────────────────────────────

/*
 * Новая строка входящих — запрос сайту на отправку. Без подписок у
 * водителя стучаться незачем. Ненастроенный адрес — не ошибка, а «ещё
 * не выложились»: уведомление остаётся во входящих, как и раньше.
 */
create or replace function app.push_driver_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.driver_push_subscriptions where driver_id = new.driver_id) then
    return new;
  end if;

  select value into v_url from app.runtime_config where key = 'push_url';
  select value into v_secret from app.runtime_config where key = 'push_secret';

  if v_url is null or v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('id', new.id),
    timeout_milliseconds := 15000
  );

  return new;
end;
$$;

revoke all on function app.push_driver_notification() from public, anon, authenticated;

create trigger driver_notifications_push
  after insert on public.driver_notifications
  for each row execute function app.push_driver_notification();

/*
 * Адрес — тот же сайт, что у отчётов, секрет — тот же: маршрут проверяет
 * его той же переменной REPORTS_CRON_SECRET. Если отчёты ещё не
 * настроены, не настраивается и это.
 */
insert into app.runtime_config (key, value, note)
select 'push_url',
       regexp_replace(value, '/api/reports/weekly$', '/api/push/driver'),
       'Маршрут отправки push водителю. Вызывает триггер driver_notifications_push.'
from app.runtime_config
where key = 'reports_url' and value ~ '/api/reports/weekly$'
on conflict (key) do nothing;

insert into app.runtime_config (key, value, note)
select 'push_secret', value, 'Секрет маршрута push — тот же, что у отчётов (REPORTS_CRON_SECRET).'
from app.runtime_config
where key = 'reports_secret'
on conflict (key) do nothing;
