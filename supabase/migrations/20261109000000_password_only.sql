-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · вход только по паролю (9.11.2026)
--
-- Владелец решил убрать двухэтапный вход (20261106190000_two_step).
-- Сайт кода больше не спрашивает, поэтому база не должна его требовать:
--
--   1. app.mfa_satisfied() — всегда true. Политики mfa_required и
--      хелперы current_company_id() / current_party_role() остаются,
--      но больше ничего не ограничивают.
--   2. app.is_admin() — без условия aal2: оператор входит паролем.
--   3. Подключённые TOTP-факторы удаляются: с ними Supabase Auth сам
--      требует aal2 для смены пароля и почты.
--
-- Устройства входа (sign_in_devices) и письмо о входе с нового
-- устройства остаются: это не второй фактор, а уведомление.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select true;
$$;

comment on function app.mfa_satisfied() is
  'Двухэтапный вход убран 9.11.2026: всегда true. Основа политик mfa_required.';

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

delete from auth.mfa_factors;
