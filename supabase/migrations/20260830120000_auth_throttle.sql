-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · ограничение частоты запросов восстановления
--
-- Страница «забыли пароль» — это кнопка, отправляющая письмо кому
-- угодно. Без ограничения она становится рассылочной машиной: чужой
-- скрипт дёргает её тысячу раз, человек получает тысячу писем, а домен
-- rahtis.eu отправляется в спам-листы вместе с приглашениями и счетами.
--
-- Счётчик живёт в базе, а не в памяти процесса. На Vercel функции
-- поднимаются и умирают поштучно, и переменная в модуле обнуляется на
-- каждом холодном старте — такой «ограничитель» не ограничивает ничего.
--
-- В таблице лежат ОТПЕЧАТКИ, а не адреса. Иначе она превращается в
-- список тех, кто забывал пароль: сами по себе персональные данные,
-- которые пришлось бы описывать в документации GDPR и удалять по
-- запросу. Отпечаток считается на сервере с секретным ключом, поэтому
-- утёкшая таблица не даёт перебрать по ней известные адреса.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists app.auth_throttle (
  key_hash text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists auth_throttle_stale_idx on app.auth_throttle (last_seen);

revoke all on app.auth_throttle from public, anon, authenticated;

comment on table app.auth_throttle is
  'Счётчики попыток по отпечатку. Адресов и адресов IP не содержит.';


/*
 * Отметить попытку и сказать, пускать ли.
 *
 * Окно скользит не по каждому запросу, а целиком: превысивший лимит
 * ждёт до конца окна, а не «пока не станет свободно». Так проще
 * объяснить человеку и труднее выцарапать письма по одному.
 *
 * Возвращает true, если запрос в пределах лимита.
 */
create or replace function app.throttle_hit(
  p_key_hash text,
  p_limit integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  insert into app.auth_throttle (key_hash, attempts, window_started_at, last_seen)
  values (p_key_hash, 1, now(), now())
  on conflict (key_hash) do update
    set
      /* Окно вышло — счёт начинается заново. */
      attempts = case
        when app.auth_throttle.window_started_at < now() - p_window then 1
        else app.auth_throttle.attempts + 1
      end,
      window_started_at = case
        when app.auth_throttle.window_started_at < now() - p_window then now()
        else app.auth_throttle.window_started_at
      end,
      last_seen = now()
  returning attempts into v_attempts;

  return v_attempts <= p_limit;
end;
$$;

revoke all on function app.throttle_hit(text, integer, interval) from public, anon, authenticated;


/*
 * Уборка. Строка, к которой не обращались сутки, не значит ничего:
 * окна давно закрылись, а таблица растёт от каждого случайного адреса.
 */
create or replace function public.prune_auth_throttle()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed integer;
begin
  delete from app.auth_throttle where last_seen < now() - interval '1 day';
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

revoke all on function public.prune_auth_throttle() from public, anon, authenticated;
grant execute on function public.prune_auth_throttle() to service_role;

do $$
begin
  perform cron.unschedule('rahtis-prune-auth-throttle');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'rahtis-prune-auth-throttle',
  '17 3 * * *',
  $$ select public.prune_auth_throttle(); $$
);


/*
 * Обёртка для сайта: PostgREST публикует только public, а зовёт её
 * служебный ключ. Наружу закрыта — иначе счётчик можно было бы
 * накрутить запросом из браузера и заблокировать чужой адрес.
 */
create or replace function public.auth_throttle_hit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select app.throttle_hit(p_key_hash, p_limit, make_interval(secs => p_window_seconds));
$$;

revoke all on function public.auth_throttle_hit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.auth_throttle_hit(text, integer, integer) to service_role;
