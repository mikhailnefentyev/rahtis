-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 1 · профили
--
-- Пользователь платформы и его связь с компанией. У компании может быть
-- несколько пользователей: владелец, диспетчер, бухгалтер. Правило
-- «один Y-tunnus = один кабинет» при этом соблюдается — кабинет один,
-- людей в нём несколько.
-- ═══════════════════════════════════════════════════════════════════

create table public.profiles (
  /*
   * Тот же идентификатор, что у auth.users. Не суррогатный ключ со ссылкой,
   * а именно общий: профиль без пользователя не имеет смысла, а удаление
   * пользователя должно уносить профиль.
   */
  id uuid primary key references auth.users (id) on delete cascade,

  company_id uuid,

  /*
   * Роль живёт здесь и только здесь.
   *
   * Её категорически нельзя хранить в user_metadata: это поле пользователь
   * меняет сам вызовом supabase.auth.updateUser(), и любой заказчик выписал
   * бы себе ADMIN. В app_metadata роль попадает лишь на время приглашения —
   * туда пишет только секретный ключ.
   */
  role public.party_role not null,

  full_name text,
  phone text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* Администратор Aivomaa не принадлежит ни перевозчику, ни заказчику. */
  constraint profiles_admin_without_company check (
    (role = 'ADMIN' and company_id is null)
    or (role <> 'ADMIN' and company_id is not null)
  ),

  /*
   * Составной внешний ключ вместо триггера: база не даст привязать
   * пользователя с ролью CARRIER к компании с kind = SHIPPER.
   *
   * У администратора company_id равен NULL, и правило MATCH SIMPLE такую
   * пару не проверяет — ограничение выполняется автоматически.
   */
  constraint profiles_company_matches_role
    foreign key (company_id, role)
    references public.companies (id, kind)
);

comment on table public.profiles is
  'Пользователь платформы. Роль и принадлежность компании — источник истины для RLS.';

create index profiles_company_id_idx on public.profiles (company_id);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function app.touch_updated_at();


-- ── Создание профиля при появлении пользователя ────────────────────

/*
 * Открытой регистрации нет. Пользователь появляется одним способом:
 * оператор одобряет компанию и отправляет приглашение через Admin API,
 * положив в app_metadata company_id и роль.
 *
 * Профиль создаётся триггером, а не тремя вызовами в серверном действии,
 * потому что создание пользователя в Auth и вставка строки в базу — разные
 * системы, и общей транзакции у них нет. Триггер делает связку атомарной
 * со стороны базы: пользователь не может появиться без профиля.
 *
 * Доверять app_metadata можно: записать его способен только секретный ключ.
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
   * Роли нет — значит пользователь заведён в обход приглашения, например
   * вручную в панели Supabase. Профиль не создаём: без роли он был бы
   * невалиден. Такому пользователю роль назначает скрипт бутстрапа
   * (первый администратор) или оператор.
   *
   * Приложение обязано это состояние обрабатывать: вошедший пользователь
   * без профиля не должен попадать ни в один кабинет.
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
  'Создаёт профиль по данным приглашения из app_metadata. Без роли профиль не создаётся.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();


-- ── Права ──────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;

grant select on public.profiles to authenticated;

/*
 * Пользователь правит только своё имя и телефон. Роли и company_id в списке
 * нет: повышение собственных прав должно быть невозможно на уровне базы,
 * а не только по политике.
 */
grant update (full_name, phone) on public.profiles to authenticated;
