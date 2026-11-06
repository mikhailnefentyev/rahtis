-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · двухэтапный вход и устройства входа (6.11.2026)
--
-- Захват учётной записи — главный способ увести груз: мошенник входит
-- под настоящей компанией, меняет счёт и перенаправляет перевозки.
--
--   1. Supabase MFA (TOTP). Фактор и проверку кода держит Supabase Auth.
--      Здесь — защита данных: у кого есть подтверждённый фактор, тот без
--      кода (aal1) не видит и не меняет ничего. Ограничительная политика
--      mfa_required на каждой таблице public с RLS и та же проверка в
--      app.current_company_id() / current_party_role() — их зовут
--      политики и функции. Иначе пароля хватило бы для запросов к API
--      Supabase напрямую, в обход сайта.
--   2. Оператор (ADMIN): app.is_admin() только при aal2 — двухэтапный
--      вход для операторов обязателен, сайт ведёт подключать его.
--   3. sign_in_devices: отпечаток браузера (sha256), префикс адреса /24,
--      страна; хранится 12 месяцев с последнего входа (чистит ежедневный
--      /api/retention/photos). Письмо о входе с нового устройства.
--   4. two_step_users(): у кого из компании включён двухэтапный вход —
--      для списка людей и сброса (главный пользователь, поддержка).
--
-- Новые таблицы после этой миграции политику mfa_required не получают
-- сами: добавлять её в миграции таблицы (или прогнать цикл ниже снова).
-- ═══════════════════════════════════════════════════════════════════

alter type public.notification_kind add value if not exists 'SECURITY';


-- ── Двухэтапный вход пройден или не нужен ──────────────────────────

/*
 * true — сессия aal2 или у пользователя нет подтверждённых факторов.
 * Без пользователя (служебный ключ, планировщик) — true: там нет сессии,
 * которую можно было бы украсть паролем.
 *
 * Утверждения без aal — тоже true. Токены Supabase Auth aal несут всегда;
 * без него бывают только утверждения, которые ставит сама база:
 * API-ключи (api_keys и далее, set_config('request.jwt.claims')) входят
 * от имени владельца ключа. Ключ — отдельный секрет компании, и с
 * включённым двухэтапным входом у владельца API работать не перестаёт.
 */
create or replace function app.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal2') = 'aal2'
    or not exists (
      select 1
      from auth.mfa_factors f
      where f.user_id = (select auth.uid())
        and f.status = 'verified'
    );
$$;

comment on function app.mfa_satisfied() is
  'Двухэтапный вход пройден (aal2) или не включён. Основа политик mfa_required.';

revoke all on function app.mfa_satisfied() from public;
grant execute on function app.mfa_satisfied() to authenticated, service_role;


-- ── Хелперы доступа: без кода — ни компании, ни роли ───────────────

create or replace function app.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select company_id from public.profiles
  where id = (select auth.uid())
    and (select app.mfa_satisfied());
$$;

create or replace function app.current_party_role()
returns public.party_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles
  where id = (select auth.uid())
    and (select app.mfa_satisfied());
$$;

/* Оператор — только с введённым кодом: для операторов двухэтапный вход обязателен. */
create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'ADMIN'
    );
$$;

comment on function app.is_admin() is
  'Является ли текущий пользователь администратором Aivomaa (только сессия aal2).';


-- ── Устройства входа ───────────────────────────────────────────────

create table public.sign_in_devices (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,

  /* sha256 от браузера без номеров версий и языков браузера. */
  fingerprint text not null,
  /* «Chrome · Windows» — для письма и списка. */
  label text not null,
  /* Только префикс: IPv4 /24, IPv6 /48. Полный адрес не храним. */
  ip_prefix text,
  /* Страна по заголовку Vercel. */
  country text,

  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),

  constraint sign_in_devices_unique unique (user_id, fingerprint),
  constraint sign_in_devices_fingerprint check (fingerprint ~ '^[0-9a-f]{64}$'),
  constraint sign_in_devices_label check (char_length(label) between 1 and 120),
  constraint sign_in_devices_prefix check (ip_prefix is null or char_length(ip_prefix) <= 64),
  constraint sign_in_devices_country check (country is null or country ~ '^[A-Z]{2}$')
);

comment on table public.sign_in_devices is
  'Устройства входа: отпечаток браузера, префикс адреса, страна. Свои строки; 12 месяцев с последнего входа.';

create index sign_in_devices_last_seen_idx on public.sign_in_devices (last_seen);

alter table public.sign_in_devices enable row level security;
revoke all on public.sign_in_devices from anon, authenticated;

create policy sign_in_devices_own
  on public.sign_in_devices for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select on public.sign_in_devices to authenticated;
grant insert (user_id, fingerprint, label, ip_prefix, country) on public.sign_in_devices to authenticated;
grant update (last_seen, label, ip_prefix, country) on public.sign_in_devices to authenticated;
grant all on public.sign_in_devices to service_role;
grant usage, select on sequence public.sign_in_devices_id_seq to service_role;


-- ── У кого включён двухэтапный вход ────────────────────────────────

/*
 * Своя компания — любому её человеку (список людей в «Omat tiedot»);
 * чужая — только оператору, по p_company_id.
 */
create or replace function public.two_step_users(p_company_id uuid default null)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct f.user_id
  from auth.mfa_factors f
  join public.profiles p on p.id = f.user_id
  where f.status = 'verified'
    and p.company_id is not null
    and p.company_id = coalesce(
      case when p_company_id is not null and (select app.is_admin()) then p_company_id end,
      (select app.current_company_id())
    );
$$;

revoke all on function public.two_step_users(uuid) from public, anon;
grant execute on function public.two_step_users(uuid) to authenticated;


-- ── Без кода — ни строки: ограничительная политика на всех таблицах ──

/*
 * Restrictive складывается с остальными политиками через AND: права
 * прежние, но при aal1 у пользователя с фактором — пусто. Подзапрос
 * (select …) считается один раз на запрос, не на строку.
 */
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  loop
    execute format('drop policy if exists mfa_required on public.%I', r.relname);
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated using ((select app.mfa_satisfied())) with check ((select app.mfa_satisfied()))',
      r.relname
    );
  end loop;
end;
$$;
