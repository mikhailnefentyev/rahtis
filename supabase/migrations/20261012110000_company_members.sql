-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · диспетчеры: несколько сотрудников в кабинете компании
--
-- 12.10.2026 решение пользователя: у перевозчика и у заказчика появляются
-- диспетчеры — сотрудники под своими паролями. Функции и допуски те же,
-- что у главного пользователя; назначает и убирает их главный.
--
-- Схема к этому готова с первого дня: profiles — «пользователь и его
-- связь с компанией», кабинет один, людей в нём несколько, а все права
-- (RLS, функции) считаются от компании, а не от человека. Поэтому
-- диспетчер — это ещё один профиль той же компании с той же ролью
-- (CARRIER или SHIPPER), и ни одна политика не меняется.
--
-- Новое здесь одно: кто из людей компании главный. Только он приглашает
-- и убирает диспетчеров; во всём остальном они равны. Все, кто уже есть
-- на платформе, — главные: до этой миграции у компании был один человек.
--
-- Пользователя в Auth заводит и удаляет серверный код секретным ключом
-- (как и приглашение компании): app_metadata получает member_kind, и
-- триггер создаёт профиль диспетчера.
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles
  add column member_kind text not null default 'OWNER',
  add constraint profiles_member_kind check (member_kind in ('OWNER', 'DISPATCHER'));

comment on column public.profiles.member_kind is
  'OWNER — главный пользователь компании, управляет диспетчерами; DISPATCHER — сотрудник с теми же функциями.';


-- ── Профиль диспетчера создаёт тот же триггер ──────────────────────

/*
 * Тело из 20260816130000 с одной правкой: member_kind из app_metadata.
 * Записать app_metadata может только секретный ключ, поэтому назначить
 * себя главным диспетчер не может.
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

  if v_role is null then
    return new;
  end if;

  insert into public.profiles (id, company_id, role, full_name, member_kind)
  values (
    new.id,
    v_company_id,
    v_role,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    case when new.raw_app_meta_data ->> 'member_kind' = 'DISPATCHER' then 'DISPATCHER' else 'OWNER' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


-- ── Кто главный ────────────────────────────────────────────────────

create or replace function app.is_company_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.member_kind = 'OWNER' and p.company_id is not null
    from public.profiles p
    where p.id = (select auth.uid())
  ), false);
$$;

revoke all on function app.is_company_owner() from public, anon;
grant execute on function app.is_company_owner() to authenticated;


-- ── Люди компании ──────────────────────────────────────────────────

/*
 * Список для раздела «Käyttäjät». Почта и последний вход лежат в
 * auth.users, куда у пользователя доступа нет, — поэтому функция, а не
 * выборка. Видят его все люди компании: коллеги и так видны друг другу
 * (profiles_select_colleagues).
 */
create or replace function public.company_members()
returns table (
  user_id uuid,
  full_name text,
  email text,
  member_kind text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, u.email::text, p.member_kind, p.created_at, u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.company_id = (select app.current_company_id())
    and (select app.current_company_id()) is not null
  order by (p.member_kind = 'OWNER') desc, p.created_at;
$$;

revoke all on function public.company_members() from public, anon;
grant execute on function public.company_members() to authenticated;


/*
 * Убрать диспетчера. Только главный, только диспетчера своей компании.
 *
 * Профиль удаляется здесь же: доступ к данным компании пропадает в той
 * же транзакции, а не тогда, когда серверный код следом удалит
 * пользователя в Auth. Сделанное диспетчером остаётся: ссылки на автора
 * в заказах, документах и журналах стоят с on delete set null.
 */
create or replace function public.remove_company_member(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select app.current_company_id());
begin
  if v_me is null or not (select app.is_company_owner()) then
    raise exception 'Пользователями управляет главный пользователь компании.' using errcode = '42501';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'Себя убрать нельзя.' using errcode = '55000';
  end if;

  delete from public.profiles
  where id = p_user_id and company_id = v_me and member_kind = 'DISPATCHER';

  if not found then
    raise exception 'Диспетчер не найден.' using errcode = 'P0002';
  end if;

  return p_user_id;
end;
$$;

revoke all on function public.remove_company_member(uuid) from public, anon;
grant execute on function public.remove_company_member(uuid) to authenticated;


-- ── Условия использования ──────────────────────────────────────────

/*
 * Новый черновик TERMS (действующая редакция не меняется, активация —
 * решение пользователя): пункт 3.6 о диспетчерах. Состав данных не
 * меняется — имя и почта пользователя уже описаны в PRIVACY 2.2, а
 * обязанность компании информировать своих сотрудников — в TERMS 10.1.
 */
do $$
declare
  v_active uuid := public.active_legal_document('TERMS');
  v_draft uuid;
begin
  if v_active is null then
    raise exception 'Нет действующей редакции TERMS.' using errcode = '55007';
  end if;

  select d.id into v_draft
  from public.legal_documents d
  where d.kind = 'TERMS' and d.status = 'DRAFT'
    and d.version > (select version from public.legal_documents where id = v_active)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values ('TERMS', (select max(version) + 1 from public.legal_documents where kind = 'TERMS'),
            'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  insert into public.legal_clauses (document_id, locale, path, body)
  values
    (v_draft, 'fi', array[3, 6],
     'Yrityksen pääkäyttäjä voi kutsua palveluun yrityksen muita käyttäjiä, ajojärjestelijöitä. Jokaisella on omat henkilökohtaiset tunnuksensa ja samat toiminnot kuin pääkäyttäjällä; käyttäjiä lisää ja poistaa vain pääkäyttäjä. Ajojärjestelijän toimet palvelussa ovat yrityksen toimia. Yritys vastaa siitä, että sillä on oikeus antaa kutsuttavan henkilön nimi ja sähköpostiosoite, ja poistaa käyttöoikeuden heti, kun henkilön valtuudet päättyvät. Poistetun käyttäjän tekemät toimeksiannot, asiakirjat ja merkinnät säilyvät yrityksen tiedoissa.'),
    (v_draft, 'en', array[3, 6],
     'The company''s main user may invite other users of the company, dispatchers, to the service. Each has their own personal credentials and the same functions as the main user; only the main user adds and removes users. A dispatcher''s actions in the service are the company''s actions. The company is responsible for having the right to provide the invited person''s name and email address, and removes the access as soon as the person''s authority ends. Assignments, documents and entries made by a removed user remain in the company''s records.')
  on conflict (document_id, locale, path) do update set body = excluded.body;
end;
$$;
