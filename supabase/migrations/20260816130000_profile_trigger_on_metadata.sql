-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 1 · исправление триггера создания профиля
--
-- Симптом: приглашённый через Admin API пользователь создавался, а профиль
-- нет. При этом app_metadata у него содержал и роль, и компанию.
--
-- Причина: GoTrue не пишет метаданные одной вставкой. Строка в auth.users
-- появляется раньше, чем в неё попадает raw_app_meta_data, поэтому триггер
-- AFTER INSERT видел пустые метаданные, не находил роль и корректно ничего
-- не делал.
--
-- Опираться на внутренний порядок записи чужого сервиса нельзя: он не
-- документирован и меняется между версиями. Поэтому профиль создаётся не
-- по факту вставки, а по факту появления роли — с какой бы операцией она
-- ни пришла.
-- ═══════════════════════════════════════════════════════════════════

/*
 * Вставка идемпотентна: ON CONFLICT DO NOTHING. Триггер может сработать
 * несколько раз — на вставке и на каждом обновлении метаданных, — и второй
 * раз обязан быть безвредным.
 *
 * Существующий профиль не переписывается. Роль и компания назначаются один
 * раз при выдаче доступа; смена компании — отдельная операция оператора,
 * а не побочный эффект правки метаданных.
 */
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_role public.party_role;
begin
  v_role := nullif(new.raw_app_meta_data ->> 'role', '')::public.party_role;
  v_company_id := nullif(new.raw_app_meta_data ->> 'company_id', '')::uuid;

  /*
   * Роли нет — пользователь заведён в обход приглашения, например вручную
   * в панели Supabase. Профиль не создаём: без роли он был бы невалиден.
   * Такому пользователю роль назначает скрипт бутстрапа или оператор,
   * а приложение ведёт его на страницу-тупик.
   */
  if v_role is null then
    return new;
  end if;

  insert into public.profiles (id, company_id, role, full_name)
  values (
    new.id,
    v_company_id,
    v_role,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function app.handle_new_user() is
  'Создаёт профиль, как только в app_metadata появляется роль: при вставке пользователя или при обновлении метаданных.';

/*
 * Второй триггер, на обновление метаданных. Условие WHEN отсекает лишние
 * срабатывания: метаданные меняются и при входе, и при подтверждении почты,
 * а нам интересен только момент, когда их содержимое действительно стало
 * другим.
 */
drop trigger if exists on_auth_user_metadata_set on auth.users;

create trigger on_auth_user_metadata_set
  after update of raw_app_meta_data on auth.users
  for each row
  when (new.raw_app_meta_data is distinct from old.raw_app_meta_data)
  execute function app.handle_new_user();
