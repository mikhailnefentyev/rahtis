-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · «проверенный перевозчик» и пакет tilaajavastuu (3.11.2026)
--
-- Заказчик в Финляндии обязан до договора получить от подрядчика
-- справки по tilaajavastuulaki 1233/2006 (5 §; изменения 464/2025 и
-- 729/2025, в силе частично с 1.1.2026): за упущение — laiminlyöntimaksu.
-- Перечень по официальной странице работодательского надзора
-- https://tyosuojelu.fi/en/grey-economy/contractor-s-obligations-and-liability
-- (обновлена 14.8.2025) и Verohallinto
-- https://www.vero.fi/yritykset-ja-yhteisot/ (Tilaajavastuu):
--
--   REGISTERS            — ennakkoperintä-, työnantaja- ja ALV-rekisteri;
--   TRADE_REGISTER       — kaupparekisteriote;
--   TAX_DEBT             — verovelkatodistus tai selvitys verojen
--                          maksamisesta (verovelkarekisteri);
--   PENSION              — todistus eläkevakuutuksista (TyEL) ja maksuista;
--   COLLECTIVE_AGREEMENT — sovellettava työehtosopimus tai keskeiset ehdot;
--   OCCUPATIONAL_HEALTH  — selvitys työterveyshuollon järjestämisestä
--                          (с 1.1.2026 по 729/2025);
--   ACCIDENT_INSURANCE   — todistus työtapaturma- ja ammattitautilain
--                          mukaisesta vakuutuksesta.
--
-- Справки о налогах и пенсионном страховании — не старше трёх месяцев
-- (5 § 2 mom.), поэтому срок по умолчанию — дата выдачи + 3 месяца.
-- У TES, työterveyshuolto и страховки срок свой — перевозчик вправе
-- поставить дату действия полиса или договора.
--
-- REGISTERS и TRADE_REGISTER закрываются и автоматически — снимком
-- открытых данных PRH (companies.registry_check, src/lib/registry/prh.ts):
-- ennakkoperintä + ALV и запись в kaupparekisteri. Снимок тоже стареет за
-- три месяца, перевозчик обновляет его кнопкой. Toiminimi в открытых
-- данных нет — им нужен документ.
--
-- Vastuu Group «Luotettava Kumppani» — один отчёт на несколько пунктов:
-- документ хранит массив пунктов (items).
--
-- Значок ставит ОПЕРАТОР (решение пользователя 3.11.2026): совпадение с
-- реестром не доказывает, что заявитель представляет компанию. Значок
-- действует = выдан и не отозван И все обязательные пункты в сроке —
-- считается функцией, поэтому сам гаснет, когда справка устаревает.
-- ═══════════════════════════════════════════════════════════════════

-- ── Хранилище ─────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-docs', 'verification-docs', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

/*
 * Кладёт файл перевозчик своим клиентом (политика ниже), удаляет сервер
 * служебным ключом после удаления строки. Чужим — заказчику и по ссылке —
 * файл отдаёт сервер короткой подписанной ссылкой, политики им не нужны.
 */
create policy verification_docs_read_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select app.current_company_id())::text
  );

create policy verification_docs_read_admin
  on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and (select app.is_admin()));

create policy verification_docs_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select app.current_company_id())::text
  );

-- ── Пункты ────────────────────────────────────────────────────────

create or replace function app.verification_required_items()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['REGISTERS', 'TRADE_REGISTER', 'TAX_DEBT', 'PENSION',
               'COLLECTIVE_AGREEMENT', 'OCCUPATIONAL_HEALTH', 'ACCIDENT_INSURANCE']::text[];
$$;

/* Пункты, у которых справка по закону не старше трёх месяцев. */
create or replace function app.verification_three_month_items()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['REGISTERS', 'TRADE_REGISTER', 'TAX_DEBT', 'PENSION']::text[];
$$;

-- ── Документы ─────────────────────────────────────────────────────

create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  /* Какие пункты закрывает файл: обычно один, у отчёта Vastuu — несколько. */
  items text[] not null,
  /* ITEM — справка на пункт; VASTUU — отчёт Luotettava Kumppani. */
  source text not null default 'ITEM' constraint verification_documents_source check (source in ('ITEM', 'VASTUU')),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  issued_on date not null,
  valid_until date not null,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint verification_documents_items
    check (cardinality(items) between 1 and 7 and items <@ app.verification_required_items()),
  constraint verification_documents_dates
    check (issued_on >= date '2000-01-01' and valid_until >= issued_on and valid_until <= issued_on + interval '5 years'),
  /* Справка на трёхмесячный пункт дольше трёх месяцев не действует. */
  constraint verification_documents_three_months
    check (not (items && app.verification_three_month_items()) or valid_until <= (issued_on + interval '3 months')::date),
  /* Путь привязан к компании строки: иначе сервер удалил бы чужой файл. */
  constraint verification_documents_path
    check (storage_path ~ ('^' || company_id::text || '/[0-9a-f-]{36}\.(pdf|jpg|png)$'))
);

create index verification_documents_company_idx on public.verification_documents (company_id, valid_until desc);

alter table public.verification_documents enable row level security;

create policy verification_documents_own
  on public.verification_documents for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy verification_documents_own_insert
  on public.verification_documents for insert to authenticated
  with check (company_id = (select app.current_company_id()));

create policy verification_documents_own_delete
  on public.verification_documents for delete to authenticated
  using (company_id = (select app.current_company_id()));

create policy verification_documents_admin
  on public.verification_documents for select to authenticated
  using ((select app.is_admin()));

grant select, insert, delete on public.verification_documents to authenticated;

-- ── Значок: решение оператора ─────────────────────────────────────

create table public.verification_grants (
  company_id uuid primary key references public.companies (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid,
  /* Заметка оператора — только для админки, наружу не уходит. */
  note text constraint verification_grants_note check (note is null or length(note) <= 1000),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_note text constraint verification_grants_revoke_note check (revoke_note is null or length(revoke_note) <= 1000)
);

alter table public.verification_grants enable row level security;

create policy verification_grants_own
  on public.verification_grants for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy verification_grants_admin
  on public.verification_grants for select to authenticated
  using ((select app.is_admin()));

grant select on public.verification_grants to authenticated;

-- ── Ссылки для заказчиков вне RAHTIS ──────────────────────────────

create table public.verification_shares (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  /* 256 бит случайности, как у ссылки отслеживания рейса. */
  token text not null unique constraint verification_shares_token check (token ~ '^[0-9a-f]{64}$'),
  label text constraint verification_shares_label check (label is null or length(label) <= 120),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index verification_shares_company_idx on public.verification_shares (company_id, created_at desc);

alter table public.verification_shares enable row level security;

create policy verification_shares_own
  on public.verification_shares for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy verification_shares_own_insert
  on public.verification_shares for insert to authenticated
  with check (company_id = (select app.current_company_id()));

/* Отозвать можно, вернуть отозванную — нет: новая ссылка — новый токен. */
create policy verification_shares_own_update
  on public.verification_shares for update to authenticated
  using (company_id = (select app.current_company_id()) and revoked_at is null)
  with check (company_id = (select app.current_company_id()));

grant select, insert on public.verification_shares to authenticated;
grant update (revoked_at) on public.verification_shares to authenticated;

-- ── Журнал напоминаний ────────────────────────────────────────────

create table public.verification_reminders (
  company_id uuid not null references public.companies (id) on delete cascade,
  item text not null,
  valid_until date not null,
  sent_at timestamptz not null default now(),
  primary key (company_id, item, valid_until)
);

alter table public.verification_reminders enable row level security;
/* Пишет и читает только сервер служебным ключом. */

-- ── Состояние пунктов ─────────────────────────────────────────────

/*
 * Срок каждого пункта: самый поздний из документа и снимка PRH.
 * NULL — пункт ничем не закрыт.
 */
create or replace function app.verification_items(p_company_id uuid)
returns table (item text, valid_until date, source text)
language sql
stable
security definer
set search_path = ''
as $$
  with req as (
    select unnest(app.verification_required_items()) as item
  ),
  docs as (
    select i.item, max(d.valid_until) as valid_until
    from public.verification_documents d
    cross join lateral unnest(d.items) as i(item)
    where d.company_id = p_company_id
    group by i.item
  ),
  prh as (
    select
      c.registry_check,
      case when c.registry_check ? 'checkedAt'
           then ((c.registry_check ->> 'checkedAt')::timestamptz at time zone 'Europe/Helsinki')::date + interval '3 months'
      end::date as valid_until
    from public.companies c
    where c.id = p_company_id
  ),
  prh_items as (
    select 'REGISTERS'::text as item, p.valid_until
    from prh p
    where coalesce((p.registry_check ->> 'prepayment')::boolean, false)
      and coalesce((p.registry_check ->> 'vat')::boolean, false)
    union all
    select 'TRADE_REGISTER', p.valid_until
    from prh p
    where coalesce((p.registry_check ->> 'tradeRegister')::boolean, false)
  )
  select
    r.item,
    greatest(d.valid_until, p.valid_until),
    case
      when d.valid_until is null and p.valid_until is null then null
      when p.valid_until is not null and (d.valid_until is null or p.valid_until >= d.valid_until) then 'PRH'
      else 'DOC'
    end
  from req r
  left join docs d on d.item = r.item
  left join prh_items p on p.item = r.item;
$$;

revoke all on function app.verification_items(uuid) from public, anon, authenticated;

create or replace function app.company_verified(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.verification_grants g
    where g.company_id = p_company_id and g.revoked_at is null
  )
  and not exists (
    select 1 from app.verification_items(p_company_id) i
    where i.valid_until is null
       or i.valid_until < (now() at time zone 'Europe/Helsinki')::date
  );
$$;

revoke all on function app.company_verified(uuid) from public, anon, authenticated;

/* Пакет целиком: то, что видит заказчик, ссылка и сам перевозчик. */
create or replace function app.verification_package(p_company_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'company', jsonb_build_object('id', c.id, 'name', c.name, 'business_id', c.business_id, 'country', c.country),
    'verified', app.company_verified(c.id),
    'granted_at', (select g.granted_at from public.verification_grants g where g.company_id = c.id and g.revoked_at is null),
    'registry', case when c.registry_check is null then null else jsonb_build_object(
      'checkedAt', c.registry_check -> 'checkedAt',
      'verdict', c.registry_check -> 'verdict',
      'officialName', c.registry_check -> 'officialName',
      'tradeRegister', c.registry_check -> 'tradeRegister',
      'prepayment', c.registry_check -> 'prepayment',
      'vat', c.registry_check -> 'vat',
      'employer', c.registry_check -> 'employer'
    ) end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('item', i.item, 'valid_until', i.valid_until, 'source', i.source))
      from app.verification_items(c.id) i
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'items', d.items, 'source', d.source, 'file_name', d.file_name,
        'storage_path', d.storage_path, 'issued_on', d.issued_on, 'valid_until', d.valid_until
      ) order by d.valid_until desc)
      from public.verification_documents d
      where d.company_id = c.id
        and d.valid_until >= (now() at time zone 'Europe/Helsinki')::date
    ), '[]'::jsonb)
  )
  from public.companies c
  where c.id = p_company_id and c.kind = 'CARRIER';
$$;

revoke all on function app.verification_package(uuid) from public, anon, authenticated;

/*
 * Пакет внутри RAHTIS. Видят: сам перевозчик, оператор и заказчик,
 * которому перевозчик и так известен по имени — активная связь и
 * перевозчик-подписчик (то же правило, что в known_vehicles_for_shipper).
 * На заказах стола по договору с RAHTIS стороны друг друга не видят —
 * там заказчику достаётся только значок (verification_badges_*).
 */
create or replace function public.verification_package(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.current_company_id();
begin
  if not (
    (select app.is_admin())
    or p_company_id = v_me
    or exists (
      select 1
      from public.carrier_shipper_links l
      join public.companies carrier on carrier.id = l.carrier_company_id
      where l.carrier_company_id = p_company_id
        and l.shipper_company_id = v_me
        and l.status = 'ACTIVE'
        and carrier.partnership = 'SUBSCRIBER'
    )
  ) then
    return null;
  end if;

  return app.verification_package(p_company_id);
end;
$$;

revoke all on function public.verification_package(uuid) from public, anon;
grant execute on function public.verification_package(uuid) to authenticated;

/* Пакет по ссылке: без входа, только живой токен. */
create or replace function public.verification_share_package(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select app.verification_package(s.company_id)
  from public.verification_shares s
  where s.token = p_token
    and p_token ~ '^[0-9a-f]{64}$'
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now());
$$;

revoke all on function public.verification_share_package(text) from public;
grant execute on function public.verification_share_package(text) to anon, authenticated, service_role;

/* Значок к откликам на заказах заказчика: только да/нет, без имени. */
create or replace function public.verification_badges_for_offers(p_order_ids uuid[])
returns table (offer_id uuid, verified boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, app.company_verified(f.carrier_company_id)
  from public.order_offers f
  join public.orders o on o.id = f.order_id
  where f.order_id = any (p_order_ids)
    and o.shipper_company_id = (select app.current_company_id());
$$;

revoke all on function public.verification_badges_for_offers(uuid[]) from public, anon;
grant execute on function public.verification_badges_for_offers(uuid[]) to authenticated;

/*
 * Значок к «знакомым машинам» заказчика. carrier_id — только там, где
 * перевозчика видно по имени (подписчик, активная связь): по нему
 * открывается пакет.
 */
create or replace function public.verification_badges_for_known()
returns table (vehicle_id uuid, verified boolean, carrier_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (v.id)
    v.id,
    app.company_verified(v.company_id),
    case when carrier.partnership = 'SUBSCRIBER' then carrier.id end
  from public.orders o
  join public.vehicles v on v.id = o.assigned_vehicle_id
  join public.companies carrier on carrier.id = v.company_id
  join public.carrier_shipper_links l
    on l.carrier_company_id = v.company_id
   and l.shipper_company_id = o.shipper_company_id
   and l.status = 'ACTIVE'
  where o.shipper_company_id = (select app.current_company_id())
    and o.status = 'DONE';
$$;

revoke all on function public.verification_badges_for_known() from public, anon;
grant execute on function public.verification_badges_for_known() to authenticated;

/* Свой значок перевозчика и значки для админки. */
create or replace function public.company_verified(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select app.is_admin()) or p_company_id = (select app.current_company_id())
    then app.company_verified(p_company_id)
  end;
$$;

revoke all on function public.company_verified(uuid) from public, anon;
grant execute on function public.company_verified(uuid) to authenticated;

-- ── Решение оператора ─────────────────────────────────────────────

create or replace function public.grant_verification(p_company_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Значок ставит только оператор.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.companies where id = p_company_id and kind = 'CARRIER') then
    raise exception 'Значок — только перевозчику.' using errcode = '22023';
  end if;

  insert into public.verification_grants (company_id, granted_at, granted_by, note, revoked_at, revoked_by, revoke_note)
  values (p_company_id, now(), auth.uid(), nullif(trim(p_note), ''), null, null, null)
  on conflict (company_id) do update
    set granted_at = excluded.granted_at,
        granted_by = excluded.granted_by,
        note = excluded.note,
        revoked_at = null,
        revoked_by = null,
        revoke_note = null;
end;
$$;

revoke all on function public.grant_verification(uuid, text) from public, anon;
grant execute on function public.grant_verification(uuid, text) to authenticated;

create or replace function public.revoke_verification(p_company_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Значок снимает только оператор.' using errcode = '42501';
  end if;

  update public.verification_grants
  set revoked_at = now(), revoked_by = auth.uid(), revoke_note = nullif(trim(p_note), '')
  where company_id = p_company_id and revoked_at is null;
end;
$$;

revoke all on function public.revoke_verification(uuid, text) from public, anon;
grant execute on function public.revoke_verification(uuid, text) to authenticated;

-- ── Напоминания ───────────────────────────────────────────────────

/*
 * Пункты, срок которых кончается в ближайшие p_days дней, — для
 * ежедневного напоминания (src/lib/verification/reminders.ts, зовёт
 * /api/reminders/certificates). Только перевозчики, у которых пакет
 * вообще начат (есть документ или выданный значок), без заморозки.
 */
create or replace function public.verification_expiring_items(p_days integer)
returns table (company_id uuid, item text, valid_until date, source text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, i.item, i.valid_until, i.source
  from public.companies c
  cross join lateral app.verification_items(c.id) i
  where c.kind = 'CARRIER'
    and c.frozen_at is null
    and (
      exists (select 1 from public.verification_documents d where d.company_id = c.id)
      or exists (select 1 from public.verification_grants g where g.company_id = c.id and g.revoked_at is null)
    )
    and i.valid_until is not null
    and i.valid_until >= (now() at time zone 'Europe/Helsinki')::date
    and i.valid_until <= (now() at time zone 'Europe/Helsinki')::date + p_days;
$$;

revoke all on function public.verification_expiring_items(integer) from public, anon, authenticated;
grant execute on function public.verification_expiring_items(integer) to service_role;
