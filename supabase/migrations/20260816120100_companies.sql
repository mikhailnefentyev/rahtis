-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 1 · компании
--
-- Компания-перевозчик или компания-заказчик. Заявка на регистрацию —
-- это строка в этой же таблице со статусом PENDING.
--
-- Политики RLS живут в отдельной миграции: им нужны хелперы, а хелперам —
-- таблица profiles. Здесь RLS включается сразу, поэтому до появления
-- политик таблица закрыта полностью.
-- ═══════════════════════════════════════════════════════════════════

create table public.companies (
  id uuid primary key default gen_random_uuid(),

  kind public.party_role not null,
  status public.company_status not null default 'PENDING',

  name text not null,

  /*
   * Страна закладывается сразу, хотя запуск только в Финляндии: Y-tunnus —
   * финский идентификатор, а в дорожной карте Скандинавия и Европа. Добавить
   * колонку в таблицу с данными и переделать под неё уникальный индекс
   * заметно дороже, чем завести её пустой сейчас.
   */
  country char(2) not null default 'FI',

  /* Y-tunnus для FI. Оператор дополнительно сверяет его по реестру PRH/YTJ. */
  business_id text not null,

  contact_email text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  activated_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,

  constraint companies_kind_not_admin
    check (kind <> 'ADMIN'),

  constraint companies_name_length
    check (length(btrim(name)) between 2 and 200),

  constraint companies_country_format
    check (country ~ '^[A-Z]{2}$'),

  /* Формат проверяется только там, где он нам известен. */
  constraint companies_business_id_format
    check (country <> 'FI' or business_id ~ '^\d{7}-\d$'),

  /*
   * Почта хранится в нижнем регистре: иначе Petri@x.fi и petri@x.fi станут
   * разными адресами при поиске компании по контакту.
   */
  constraint companies_email_normalised
    check (contact_email = lower(contact_email) and position('@' in contact_email) > 1),

  /* Опора для составного внешнего ключа из profiles. */
  constraint companies_id_kind_key unique (id, kind)
);

comment on table public.companies is
  'Компания-перевозчик или заказчик. Строка со статусом PENDING — это поданная заявка.';

comment on column public.companies.kind is
  'Одна компания — одна роль. Экспедитору с автопарком заводятся два кабинета.';

/*
 * Один Y-tunnus = один кабинет (ТЗ §2). Индекс частичный: после отказа
 * компания должна иметь возможность подать заявку заново, поэтому
 * отклонённые строки идентификатор не занимают.
 */
create unique index companies_business_id_key
  on public.companies (country, business_id)
  where status <> 'REJECTED';

/* Очередь модерации — самый частый запрос админки. */
create index companies_pending_idx
  on public.companies (created_at)
  where status = 'PENDING';

create trigger companies_touch_updated_at
  before update on public.companies
  for each row execute function app.touch_updated_at();


-- ── Права ──────────────────────────────────────────────────────────

/*
 * RLS включается здесь же. Политик пока нет, а таблица с включённым RLS
 * без единой политики не отдаёт ни одной строки — то есть между этой
 * миграцией и миграцией политик данные закрыты, а не открыты.
 */
alter table public.companies enable row level security;

/*
 * Supabase по умолчанию раздаёт новым таблицам в public полный доступ для
 * anon и authenticated. Забираем всё и выдаём точечно.
 *
 * anon не получает ничего: форма заявки пишет не напрямую из браузера, а
 * через серверное действие. Анонимная запись в таблицу компаний была бы
 * открытым спам-вектором, а серверное действие оставляет место для капчи
 * и лимитов, не трогая политики.
 */
revoke all on public.companies from anon, authenticated;

grant select on public.companies to authenticated;

/*
 * Колоночные гранты — единственный способ запретить смену статуса.
 * RLS работает построчно: политика «пользователь правит свою компанию»
 * не умеет отличить правку названия от попытки выписать себе ACTIVE.
 * Поэтому список разрешённых к записи колонок задаётся здесь, и статуса
 * в нём нет — Postgres отклонит такой UPDATE сам.
 *
 * Смена статуса выполняется оператором через серверное действие под
 * секретным ключом: service_role обходит и RLS, и колоночные гранты.
 * Проверка прав администратора в таком действии — на стороне приложения.
 */
grant update (name, contact_email) on public.companies to authenticated;
