-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · два канала уведомлений
--
-- Внутренний канал и почта разделены намеренно.
--
-- Почта уходит наружу и там не наша: письмо режет спам-фильтр, ящик
-- переполнен, домен в чёрном списке. Если единственным способом сказать
-- перевозчику «вас выбрали, у вас пятнадцать минут» будет письмо, то в
-- день, когда почта не дойдёт, рейс просто не состоится.
--
-- Поэтому событие всегда пишется в notifications — это видно в кабинете
-- и работает без единого внешнего сервиса. Письмо дублирует и может не
-- дойти, ничего не сломав.
--
-- email_outbox — журнал всех писем, а не времянка на период заглушки. В
-- него пишет общий слой до попытки отправки, и Resend, когда его
-- подключат, будет писать туда же. Разница только в итоговом статусе.
-- ═══════════════════════════════════════════════════════════════════

-- ── Письма ─────────────────────────────────────────────────────────

create type public.email_status as enum ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

comment on type public.email_status is
  'PENDING — записано, не отправлено. SENT — принято провайдером. '
  'FAILED — провайдер отказал. SKIPPED — провайдер-заглушка, письмо не слалось.';

create table public.email_outbox (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  /* Какой шаблон породил письмо: 'invite', 'weekly_report', 'billing.invoiced'. */
  template text not null,
  locale text not null default 'fi',

  from_email text not null,
  /*
   * Куда придёт ответ. Для вопроса оператору это почта спросившего:
   * оператор жмёт «ответить» и попадает человеку, а не в noreply.
   */
  reply_to text,
  to_email text not null,
  to_name text,

  subject text not null,
  body_text text not null,
  body_html text,

  /*
   * Вложения ссылками на Storage, а не байтами. PDF на две сотни
   * килобайт в base64 внутри строки таблицы раздувает и её, и каждый
   * запрос к журналу.
   */
  attachments jsonb not null default '[]'::jsonb,

  /* Кому письмо относится. set null: компанию можно заморозить, письмо остаётся. */
  company_id uuid references public.companies (id) on delete set null,

  provider text not null,
  status public.email_status not null default 'PENDING',
  attempts smallint not null default 0,
  provider_message_id text,
  error text,
  sent_at timestamptz,

  constraint email_outbox_to_format check (to_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  constraint email_outbox_subject_length check (length(btrim(subject)) between 1 and 300),
  constraint email_outbox_attachments_array check (jsonb_typeof(attachments) = 'array')
);

create index email_outbox_created_idx on public.email_outbox (created_at desc);
create index email_outbox_pending_idx on public.email_outbox (status) where status = 'PENDING';

comment on table public.email_outbox is
  'Журнал всех писем платформы. Пишется до отправки, поэтому переживает отказ провайдера.';

alter table public.email_outbox enable row level security;

/* Наружу журнал не отдаётся никому, кроме оператора: там чужие адреса. */
revoke all on public.email_outbox from anon, authenticated;
grant select on public.email_outbox to authenticated;

create policy email_outbox_select_admin
  on public.email_outbox for select to authenticated
  using ((select app.is_admin()));

/*
 * Служебный ключ пишет письма сам: они рождаются и там, где сессии нет
 * вовсе — в заданиях по расписанию и в очереди повторной отправки.
 */
grant select, insert, update on public.email_outbox to service_role;
grant usage, select on sequence public.email_outbox_id_seq to service_role;


-- ── Уведомления в кабинете ─────────────────────────────────────────

create type public.notification_kind as enum
  ('ORDER', 'BILLING', 'MODERATION', 'REPORT', 'ADMIN_MESSAGE');

create table public.notifications (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  company_id uuid not null references public.companies (id) on delete cascade,

  /*
   * NULL означает «всей компании». Диспетчер и его сменщик должны видеть
   * одно и то же: уведомление о выбранном рейсе адресовано компании, а не
   * тому, кто в этот момент был за экраном.
   */
  user_id uuid references auth.users (id) on delete cascade,

  kind public.notification_kind not null,
  title text not null,
  body text,

  /* Куда вести в кабинете. Относительный путь без языка: '/carrier/desk'. */
  link text,

  read_at timestamptz,

  constraint notifications_title_length check (length(btrim(title)) between 1 and 200),
  constraint notifications_link_internal check (link is null or link ~ '^/[^/]'),
  constraint notifications_body_length check (body is null or length(body) <= 4000)
);

create index notifications_company_idx
  on public.notifications (company_id, created_at desc);

create index notifications_unread_idx
  on public.notifications (company_id) where read_at is null;

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

/* Прочитанность отмечает сам получатель — единственная колонка на запись. */
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_own
  on public.notifications for select to authenticated
  using (
    company_id = (select app.current_company_id())
    and (user_id is null or user_id = (select auth.uid()))
  );

create policy notifications_select_admin
  on public.notifications for select to authenticated
  using ((select app.is_admin()));

/*
 * Уведомления пишет служебный слой, а не пользователь: событие почти
 * всегда адресовано другой стороне — заказчику о взятом рейсе,
 * перевозчику о выплате.
 */
grant select, insert on public.notifications to service_role;
grant usage, select on sequence public.notifications_id_seq to service_role;

create policy notifications_update_own
  on public.notifications for update to authenticated
  using (
    company_id = (select app.current_company_id())
    and (user_id is null or user_id = (select auth.uid()))
  )
  with check (
    company_id = (select app.current_company_id())
    and (user_id is null or user_id = (select auth.uid()))
  );


-- ── Запись уведомления ─────────────────────────────────────────────

/*
 * Внутренний вход для функций базы.
 *
 * Отдельно от публичной обёртки, потому что вызывается изнутри других
 * security definer функций — там проверка прав уже сделана и повторять
 * её нельзя: take_order пишет уведомление заказчику, а заказчик для неё
 * чужая компания.
 */
create or replace function app.notify(
  p_company_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_user_id uuid default null
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (company_id, user_id, kind, title, body, link)
  values (p_company_id, p_user_id, p_kind, p_title, p_body, p_link)
  returning id;
$$;

comment on function app.notify(uuid, public.notification_kind, text, text, text, uuid) is
  'Кладёт уведомление в кабинет компании. Для вызова изнутри функций базы.';

/*
 * Отзыв прав обязателен, и это не формальность.
 *
 * Функция security definer и никаких прав внутри не проверяет — она и не
 * должна, её зовут из функций, где проверка уже сделана. Но новая
 * функция по умолчанию исполняема для PUBLIC, а схема app открыта
 * вошедшим (grant usage on schema app). Без отзыва любой вошедший
 * пользователь мог бы положить уведомление в кабинет ЛЮБОЙ компании —
 * например «Aivomaa: выплаты теперь на другой счёт» перевозчику.
 *
 * Полагаться на то, что PostgREST не публикует схему app, нельзя: это
 * настройка проекта, а не право в базе, и меняется она одним полем в
 * панели.
 */
revoke all on function app.notify(uuid, public.notification_kind, text, text, text, uuid)
  from public, anon, authenticated;


/* Произвольное уведомление от оператора — единственный путь снаружи. */
create or replace function public.notify_company(
  p_company_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Отправлять уведомления может только оператор.' using errcode = '42501';
  end if;

  if (select count(*) from public.companies where id = p_company_id) = 0 then
    raise exception 'Компания не найдена.' using errcode = 'P0002';
  end if;

  return app.notify(p_company_id, p_kind, p_title, p_body, p_link);
end;
$$;

revoke all on function public.notify_company(uuid, public.notification_kind, text, text, text)
  from public, anon;
grant execute on function public.notify_company(uuid, public.notification_kind, text, text, text)
  to authenticated, service_role;


/* Сколько непрочитанного — для колокола в шапке, без выгрузки списка. */
/*
 * Сколько непрочитанного у спрашивающего.
 *
 * Компания задаётся явно, а не через RLS: у оператора политика открывает
 * все уведомления платформы, и счётчик в его шапке показал бы чужое
 * непрочитанное со всех компаний сразу.
 */
create or replace function public.unread_notifications()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.notifications
  where read_at is null
    and company_id = (select app.current_company_id());
$$;

grant execute on function public.unread_notifications() to authenticated, service_role;
