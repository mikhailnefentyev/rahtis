-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 1 · хелперы и политики доступа
--
-- Вся модель доступа собрана в одном файле намеренно: её читают целиком,
-- когда проверяют, не видит ли одна компания данные другой.
-- ═══════════════════════════════════════════════════════════════════

-- ── Хелперы ────────────────────────────────────────────────────────

/*
 * Все три функции — SECURITY DEFINER: они читают public.profiles в обход
 * RLS. Без этого политика на profiles, обращающаяся к profiles, ушла бы
 * в бесконечную рекурсию.
 *
 * `set search_path = ''` обязателен для SECURITY DEFINER: иначе вызывающий
 * подсунет свой search_path и подменит profiles на собственную таблицу.
 * Отсюда же полные имена вроде public.profiles внутри тела.
 *
 * STABLE позволяет Postgres вычислить функцию один раз на запрос, а не на
 * каждую строку — но только если в политике вызов обёрнут в подзапрос:
 * `(select app.is_admin())`, а не `app.is_admin()`. На больших таблицах
 * разница на порядки, поэтому обёртка используется ниже везде.
 *
 * Роль в JWT намеренно не кладём: статусы меняются модерацией, и одобренный
 * оператором заказчик не должен ждать до часа, пока протухнет токен.
 */

create or replace function app.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select company_id from public.profiles where id = (select auth.uid());
$$;

comment on function app.current_company_id() is
  'Компания текущего пользователя. NULL у администратора платформы и у гостя.';

/* Имя current_role занято: это зарезервированное слово SQL. */
create or replace function app.current_party_role()
returns public.party_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

comment on function app.current_party_role() is
  'Роль текущего пользователя. NULL, если профиля нет.';

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'ADMIN'
  );
$$;

comment on function app.is_admin() is
  'Является ли текущий пользователь администратором Aivomaa.';

revoke all on function
  app.current_company_id(),
  app.current_party_role(),
  app.is_admin()
from public;

grant execute on function
  app.current_company_id(),
  app.current_party_role(),
  app.is_admin()
to authenticated, service_role;


-- ── Политики: companies ────────────────────────────────────────────

create policy companies_select_own
  on public.companies for select to authenticated
  using (id = (select app.current_company_id()));

create policy companies_select_admin
  on public.companies for select to authenticated
  using ((select app.is_admin()));

/*
 * Правка своей компании разрешена только после одобрения. У компании в
 * статусе PENDING пользователей ещё нет — приглашение уходит при одобрении, —
 * но условие оставлено явным: оно защищает и от отклонённой компании,
 * чей пользователь остался в системе.
 *
 * Какие именно колонки правятся, решают колоночные гранты из миграции
 * companies: политика на это влиять не может.
 */
create policy companies_update_own
  on public.companies for update to authenticated
  using (
    id = (select app.current_company_id())
    and status in ('APPROVED', 'ACTIVE')
  )
  with check (id = (select app.current_company_id()));

/*
 * Политик INSERT и DELETE для companies нет. Заявку создаёт серверное
 * действие под секретным ключом, компании не удаляются — отказ выражается
 * статусом REJECTED, иначе исчезнет история модерации.
 */


-- ── Политики: profiles ─────────────────────────────────────────────

create policy profiles_select_self
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

/*
 * Коллеги по компании видны друг другу: диспетчер должен понимать, кто из
 * его компании взял заказ. За пределы компании эти данные не выходят —
 * персональные данные, ТЗ §14.
 */
create policy profiles_select_colleagues
  on public.profiles for select to authenticated
  using (
    company_id is not null
    and company_id = (select app.current_company_id())
  );

create policy profiles_select_admin
  on public.profiles for select to authenticated
  using ((select app.is_admin()));

create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

/*
 * Политик INSERT и DELETE для profiles нет. Профиль создаёт триггер
 * (SECURITY DEFINER, RLS к нему не применяется), удаляется он каскадом
 * вместе с пользователем. Пути завести профиль самому у клиента нет.
 */
