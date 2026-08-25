-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · чат с агентом и подготовка под n8n
--
-- Самих агентов здесь нет: они живут во внешних воркфлоу. Здесь только
-- то, без чего они не смогут ни спросить, ни ответить, ни прочитать
-- данные безопасно.
--
-- Изоляция прав держится тремя независимыми слоями.
--
-- Первый: у n8n нет ключа к базе. Наружу уходит адрес эндпоинта и общий
-- секрет, и всё. Утёкший секрет не даёт доступа к Postgres — он даёт
-- право позвать перечисленные ниже функции.
--
-- Второй: роль agent не имеет привилегий на запись ни к одной таблице.
-- Не «политика запрещает», а привилегий нет: insert не пройдёт, даже
-- если однажды напишут кривую политику.
--
-- Третий, и он важнее первых двух: инструменты не принимают
-- идентификатор компании. Компания выводится из треда, а тред создал
-- сайт. У агента нет поля, в которое можно вписать чужую компанию — не
-- потому что мы его проверяем, а потому что его не существует.
-- ═══════════════════════════════════════════════════════════════════

create type public.chat_audience as enum ('DRIVER', 'CARRIER', 'SHIPPER', 'ADMIN');
create type public.chat_channel as enum ('WEB', 'WHATSAPP');
create type public.chat_sender as enum ('USER', 'AGENT', 'OPERATOR');

comment on type public.chat_audience is
  'Кому отвечает тред. Он же решает, какой воркфлоu n8n его берёт и какие инструменты открыты.';


-- ── Треды ──────────────────────────────────────────────────────────

create table public.conversations (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies (id) on delete cascade,

  audience public.chat_audience not null,

  /*
   * Канал заложен сейчас, хотя работает пока один. Водительский тред
   * придёт из WhatsApp через n8n: у него не будет created_by, зато будет
   * номер телефона. Добавлять колонку в таблицу с живыми тредами дороже,
   * чем завести её пустой.
   */
  channel public.chat_channel not null default 'WEB',
  external_ref text,

  subject text,
  status text not null default 'OPEN',

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),

  /*
   * Одноразовый пропуск на один обмен.
   *
   * Выдаётся, когда вопрос уходит в n8n, и гаснет с ответом. Инструменты
   * без него не отвечают: скомпрометированный воркфлоу не сможет дёрнуть
   * тред, который сейчас не в работе, даже зная его идентификатор.
   */
  dispatch_token uuid,

  /*
   * Момент отправки, а не булев флаг: по нему рисуется «агент думает», и
   * по нему же видно зависший запрос — флаг о возрасте молчит.
   */
  pending_since timestamptz,

  constraint conversations_status_known check (status in ('OPEN', 'CLOSED')),
  constraint conversations_subject_length
    check (subject is null or length(btrim(subject)) between 1 and 200),
  constraint conversations_token_with_pending
    check ((dispatch_token is null) = (pending_since is null))
);

create index conversations_company_idx
  on public.conversations (company_id, last_message_at desc);

create index conversations_pending_idx
  on public.conversations (pending_since) where pending_since is not null;


-- ── Сообщения ──────────────────────────────────────────────────────

create table public.messages (
  id uuid primary key default gen_random_uuid(),

  conversation_id uuid not null references public.conversations (id) on delete cascade,

  sender public.chat_sender not null,

  /* Кто именно из компании написал. У агента и у оператора-бота пусто. */
  sender_user_id uuid references auth.users (id) on delete set null,

  body text not null,

  /* Ссылки на Storage, а не байты — как и во вложениях писем. */
  attachments jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),

  constraint messages_body_length check (length(btrim(body)) between 1 and 8000),
  constraint messages_attachments_array check (jsonb_typeof(attachments) = 'array'),
  constraint messages_user_has_author
    check (sender <> 'USER' or sender_user_id is not null)
);

create index messages_thread_idx on public.messages (conversation_id, created_at);


-- ── Доступ сторон ──────────────────────────────────────────────────

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

revoke all on public.conversations from anon, authenticated;
revoke all on public.messages from anon, authenticated;

grant select, insert on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update on public.conversations to service_role;
grant select, insert on public.messages to service_role;

/* Свои треды видит компания, все — оператор. */
create policy conversations_select_own
  on public.conversations for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy conversations_select_admin
  on public.conversations for select to authenticated
  using ((select app.is_admin()));

create policy conversations_insert_own
  on public.conversations for insert to authenticated
  with check (company_id = (select app.current_company_id()));

create policy messages_select_own
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.company_id = (select app.current_company_id())
    )
  );

create policy messages_select_admin
  on public.messages for select to authenticated
  using ((select app.is_admin()));

/*
 * Пользователь пишет только от своего имени и только в свой тред.
 * Значение sender проверяется здесь, а не в коде: иначе клиент мог бы
 * подписать своё сообщение как ответ агента.
 */
create policy messages_insert_own
  on public.messages for insert to authenticated
  with check (
    sender = 'USER'
    and sender_user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.company_id = (select app.current_company_id())
    )
  );


-- ── База знаний по площадкам ───────────────────────────────────────

/*
 * Инструкции по точке: где ворота, кому звонить, что взять с собой.
 * Общие пишет оператор, свои — заказчик для своих же площадок.
 */
create table public.place_guides (
  id uuid primary key default gen_random_uuid(),

  /* Ключ площадки из справочника либо свободный текст города. */
  place_key text not null,
  locale text not null default 'fi',

  /* NULL — инструкция платформы, видна всем. Иначе только своей компании. */
  company_id uuid references public.companies (id) on delete cascade,

  title text not null,
  body text not null,

  updated_at timestamptz not null default now(),

  constraint place_guides_locale_known check (locale in ('fi', 'en')),
  constraint place_guides_body_length check (length(btrim(body)) between 1 and 8000)
);

create index place_guides_key_idx on public.place_guides (place_key, locale);

alter table public.place_guides enable row level security;

revoke all on public.place_guides from anon, authenticated;
grant select on public.place_guides to authenticated;
grant select, insert, update, delete on public.place_guides to service_role;

create policy place_guides_select
  on public.place_guides for select to authenticated
  using (company_id is null or company_id = (select app.current_company_id()));

create policy place_guides_select_admin
  on public.place_guides for select to authenticated
  using ((select app.is_admin()));


-- ── Контекст треда для инструментов ────────────────────────────────

/*
 * Компания и роль по треду. Единственный источник прав для агента: всё
 * остальное выводится отсюда, а не приходит снаружи.
 */
create or replace function app.agent_context(p_conversation_id uuid, p_token uuid)
returns public.conversations
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations;
begin
  select * into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if v_conversation.id is null then
    raise exception 'Тред не найден.' using errcode = 'P0002';
  end if;

  /*
   * Пропуск обязателен и сверяется целиком. Знания идентификатора треда
   * недостаточно: без действующего пропуска инструмент молчит.
   */
  if v_conversation.dispatch_token is null
     or p_token is null
     or v_conversation.dispatch_token <> p_token then
    raise exception 'Пропуск треда недействителен.' using errcode = '42501';
  end if;

  return v_conversation;
end;
$$;

revoke all on function app.agent_context(uuid, uuid) from public, anon, authenticated;
