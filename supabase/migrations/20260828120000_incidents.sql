-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · журнал сбоев и пульс платформы
--
-- Сейчас у платформы нет места, куда падает техническая ошибка. Отказы
-- базы, которые должен увидеть оператор, разбирает admin/errors.ts, а
-- всё остальное уходит в console.error на сервере — то есть в никуда,
-- как только процесс перезапустится. Наблюдать за боевым сайтом не по
-- чему.
--
-- Здесь появляется это место, и появляется так, чтобы за ним мог
-- смотреть агент. Правило то же, что для агентов n8n: наружу отдаётся
-- SELECT и ничего больше, причём на уровне привилегий, а не обещаний.
--
-- В журнал не кладутся персональные данные. Не «стараемся не класть» —
-- записывающая функция принимает только путь, класс ошибки, SQLSTATE и
-- обрезанный текст; поля для тела запроса, почты и идентификатора
-- пользователя в ней просто нет. Разбирать инцидент без них дольше, но
-- журнал читает внешний наблюдатель, и цена ошибки здесь выше цены
-- удобства.
-- ═══════════════════════════════════════════════════════════════════

create type public.incident_severity as enum ('WARN', 'ERROR', 'FATAL');
create type public.incident_status as enum ('OPEN', 'ACKED', 'RESOLVED');


-- ── Журнал ─────────────────────────────────────────────────────────

create table public.incidents (
  id bigint generated always as identity primary key,

  /*
   * Отпечаток, а не строка на каждый сбой.
   *
   * Отвалившаяся база даёт тысячу одинаковых ошибок в минуту. Тысяча
   * строк — это не тысяча проблем, это одна; складывая их по отпечатку,
   * мы получаем список из десяти настоящих поломок вместо ленты, в
   * которой ничего не видно.
   */
  fingerprint text not null unique,
  seen_count integer not null default 1,

  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),

  severity public.incident_severity not null default 'ERROR',

  /* Откуда прилетело: 'render', 'action', 'route', 'cron', 'email'. */
  source text not null,

  /* Класс ошибки: 'TypeError', 'PostgrestError', 'FetchError'. */
  kind text not null,

  /* Первая строка сообщения, обрезанная. Стек сюда не кладём. */
  message text not null,

  /* Маршрут без параметров запроса: /fi/carrier/desk, а не ?next=… */
  path text,

  /* SQLSTATE, если сбой пришёл из Postgres. */
  sqlstate text,

  status public.incident_status not null default 'OPEN',
  resolved_at timestamptz,

  /* Заметка оператора или ссылка на разбор. */
  note text,

  constraint incidents_fingerprint_length check (length(btrim(fingerprint)) between 8 and 64),
  constraint incidents_source_known
    check (source in ('render', 'action', 'route', 'cron', 'email', 'agent')),
  constraint incidents_message_length check (length(btrim(message)) between 1 and 500),
  constraint incidents_kind_length check (length(btrim(kind)) between 1 and 80),
  constraint incidents_path_length check (path is null or length(path) <= 200),
  constraint incidents_sqlstate_shape check (sqlstate is null or sqlstate ~ '^[0-9A-Z]{5}$'),
  constraint incidents_resolved_has_moment
    check ((status = 'RESOLVED') = (resolved_at is not null))
);

create index incidents_open_idx
  on public.incidents (last_seen desc) where status <> 'RESOLVED';

create index incidents_severity_idx on public.incidents (severity, last_seen desc);

comment on table public.incidents is
  'Технические сбои платформы, свёрнутые по отпечатку. Без персональных данных: читается внешним наблюдателем.';

alter table public.incidents enable row level security;

/*
 * Пишет только служебный ключ, и только через функцию ниже. Прямой
 * insert закрыт даже ему: у записи есть форма, и обходить её незачем.
 */
revoke all on public.incidents from anon, authenticated;
grant select, update on public.incidents to service_role;

/* Читает журнал оператор. Остальным он не нужен и ничего не говорит. */
create policy incidents_select_admin
  on public.incidents for select to authenticated
  using ((select app.is_admin()));

grant select on public.incidents to authenticated;


-- ── Запись ─────────────────────────────────────────────────────────

/*
 * Одна точка входа. Повтор не создаёт строку, а поднимает счётчик и
 * время — и заодно возвращает уже закрытый инцидент в работу: если
 * поломка вернулась, она снова открыта.
 */
create or replace function public.record_incident(
  p_fingerprint text,
  p_severity public.incident_severity,
  p_source text,
  p_kind text,
  p_message text,
  p_path text default null,
  p_sqlstate text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.incidents (
    fingerprint, severity, source, kind, message, path, sqlstate
  )
  values (
    left(btrim(p_fingerprint), 64),
    coalesce(p_severity, 'ERROR'),
    p_source,
    left(btrim(p_kind), 80),
    left(btrim(p_message), 500),
    left(p_path, 200),
    p_sqlstate
  )
  on conflict (fingerprint) do update
    set seen_count = public.incidents.seen_count + 1,
        last_seen = now(),
        /* Вернулось после закрытия — снова открыто. */
        status = case when public.incidents.status = 'RESOLVED'
                   then 'OPEN' else public.incidents.status end,
        resolved_at = case when public.incidents.status = 'RESOLVED'
                        then null else public.incidents.resolved_at end
  returning id into v_id;

  return v_id;
end;
$$;

/*
 * Функция лежит в public, а не в app: PostgREST публикует только public,
 * а зовёт её сайт служебным ключом — тем же путём, каким ходит
 * notify_company. Доступ при этом снят со всех, кроме служебной роли,
 * поэтому «лежит в public» не означает «открыта наружу».
 */
revoke all on function public.record_incident(
  text, public.incident_severity, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.record_incident(
  text, public.incident_severity, text, text, text, text, text
) to service_role;


-- ── Пульс: то, что должно быть правдой ─────────────────────────────

/*
 * Проверки не «жив ли процесс», а «делает ли платформа свою работу».
 *
 * Живой процесс с остановившимся планировщиком выглядит здоровым и при
 * этом не закрывает окна решений — заказы висят, перевозчики ждут, и
 * никто об этом не узнает до звонка. Поэтому каждая строка ниже
 * проверяет следствие, а не признак жизни.
 */
create or replace function public.platform_pulse()
returns table (
  metric text,
  value bigint,
  /* Порог, выше которого это уже неисправность. NULL — просто счётчик. */
  threshold bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  /* Планировщик закрывает просроченные окна каждую минуту. Если он стоит,
     здесь копятся заказы, у которых срок вышел, а статус прежний. */
  select 'deadlines_overdue', count(*)::bigint, 0::bigint
  from public.orders
  where deadline_at is not null and deadline_at < now() - interval '5 minutes'
    and status = 'AWAIT_DRIVER'

  union all

  /* Письмо в очереди дольше получаса означает, что отправка не идёт. */
  select 'email_stuck', count(*)::bigint, 0::bigint
  from public.email_outbox
  where status = 'PENDING' and created_at < now() - interval '30 minutes'

  union all

  /* Вопрос ушёл в n8n и не вернулся: воркфлоу упал или не отвечает. */
  select 'agent_hanging', count(*)::bigint, 0::bigint
  from public.conversations
  where pending_since is not null and pending_since < now() - interval '10 minutes'

  union all

  select 'incidents_fatal', count(*)::bigint, 0::bigint
  from public.incidents
  where status <> 'RESOLVED' and severity = 'FATAL'

  union all

  select 'incidents_open', count(*)::bigint, null::bigint
  from public.incidents
  where status <> 'RESOLVED'

  union all

  /* Рейсы в работе. Не неисправность — опора: по этому числу видно,
     что проверка смотрит на живую базу, а не на пустую копию. */
  select 'orders_running', count(*)::bigint, null::bigint
  from public.orders
  where status in ('AWAIT_DRIVER', 'IN_PROGRESS');
$$;

revoke all on function public.platform_pulse() from public, anon, authenticated;
grant execute on function public.platform_pulse() to service_role;


-- ── Роль наблюдателя ───────────────────────────────────────────────

/*
 * Роль без входа, как agent из миграции инструментов. Смысл тот же:
 * список того, что наблюдателю можно, проверяется одним запросом к
 * information_schema, а не чтением кода и не доверием к настройке.
 *
 * Ни одной таблицы. Две функции, обе stable. Из данных платформы
 * наружу выходят числа и классы ошибок — ни имён, ни адресов, ни сумм.
 */
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'monitor') then
    create role monitor nologin;
  end if;
end;
$$;

revoke all on all tables in schema public from monitor;
revoke all on all sequences in schema public from monitor;
revoke all on all functions in schema public from monitor;
revoke all on schema app from monitor;

grant usage on schema public to monitor;

/*
 * Лента сбоев для наблюдателя. Вид, а не таблица: так набор колонок
 * зафиксирован, и добавленное завтра поле не уедет наружу само собой.
 */
create or replace view public.incident_feed as
select
  i.id,
  i.fingerprint,
  i.first_seen,
  i.last_seen,
  i.seen_count,
  i.severity,
  i.source,
  i.kind,
  i.message,
  i.path,
  i.sqlstate,
  i.status
from public.incidents i
where i.status <> 'RESOLVED';

comment on view public.incident_feed is
  'Открытые сбои для внешнего наблюдателя. Набор колонок зафиксирован видом: новое поле таблицы наружу само не уедет.';

revoke all on public.incident_feed from anon, authenticated;
grant select on public.incident_feed to monitor, service_role;

/* Пульс — вторая и последняя вещь, доступная наблюдателю. */
grant execute on function public.platform_pulse() to monitor;
