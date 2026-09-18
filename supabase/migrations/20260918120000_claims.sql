-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · претензии и отклонения (claims)
--
-- Рейс закрыт, документы у заказчика, а через день выясняется, что
-- прицеп пришёл с вмятиной, двух паллет нет, машина простояла у ворот
-- шесть часов. До сих пор этому было некуда деться, кроме почты
-- оператору, где претензия отрывалась от рейса, фото и ответа второй
-- стороны.
--
-- Claim — это спор, привязанный к рейсу. Подаёт его одна сторона рейса
-- против другой: заказчик перевозчику или перевозчик заказчику. Оператор
-- не сторона, а посредник — видит все претензии и ведёт их к решению.
--
-- ТРИ РЕШЕНИЯ, которые здесь зашиты.
--
-- Первое: сторона против стороны, но без имён. Контрагент заказчика —
-- Aivomaa, а не перевозчик (миграция carrier_anonymity), и спор этого не
-- меняет: заказчик видит «перевозчик» и госномер, а имя компании — нет.
-- Перевозчик имя заказчика знает и так, из выполненных рейсов.
--
-- Второе: история и переписка — одна лента. Комментарий, смена статуса,
-- приложенный файл — строки одной таблицы в порядке времени. Разнести их
-- по трём таблицам значило бы собирать ленту на клиенте и спорить потом,
-- что было раньше: ответ перевозчика или решение оператора.
--
-- Третье: фото рейса в claim не копируются, а берутся по рейсу. Их будет
-- присылать приложение водителя, которого ещё нет, — и присылать в
-- рейс, а не в спор, о котором водитель при съёмке не знает. Поэтому
-- claim читает order_documents своего рейса в момент открытия: фото,
-- пришедшее после подачи, появится в нём само.
-- ═══════════════════════════════════════════════════════════════════


-- ── Фото рейса: откуда, до или после, что снято ────────────────────

/*
 * Кто положил файл в рейс. Кабинет — перевозчик руками при закрытии;
 * приложение водителя — снимок в момент взятия или сдачи.
 */
create type public.trip_document_source as enum ('CABINET', 'DRIVER_APP');

/*
 * Когда снято: при взятии (состояние «до») или при сдаче («после»).
 * В споре о повреждении это главный вопрос — было ли оно до перевозки.
 */
create type public.trip_phase as enum ('PICKUP', 'DELIVERY');

/* Что в кадре. NULL — не указано, как у всего загруженного до этой миграции. */
create type public.photo_subject as enum ('TRAILER', 'CARGO', 'SEAL', 'DOCUMENT', 'OTHER');

alter table public.order_documents
  add column source public.trip_document_source not null default 'CABINET',
  add column phase public.trip_phase,
  add column subject public.photo_subject,
  /*
   * Момент съёмки, а не загрузки. Приложение без сети копит снимки и
   * отправляет их вечером; по created_at фото «при взятии» оказалось бы
   * сделанным после выгрузки.
   */
  add column captured_at timestamptz,
  add column captured_lat double precision,
  add column captured_lon double precision,
  /*
   * Идентификатор снимка на стороне приложения. Повторная отправка —
   * обычное дело для мобильной сети, и второй экземпляр того же кадра
   * не должен ложиться второй строкой.
   */
  add column external_id text;

alter table public.order_documents
  add constraint order_documents_external_id_unique unique (external_id),
  add constraint order_documents_external_id_length
    check (external_id is null or length(external_id) between 1 and 200),
  add constraint order_documents_captured_position
    check ((captured_lat is null) = (captured_lon is null)
           and (captured_lat is null or (captured_lat between -90 and 90
                                         and captured_lon between -180 and 180)));

comment on column public.order_documents.source is
  'CABINET — загружено перевозчиком в кабинете; DRIVER_APP — снимок из приложения водителя.';
comment on column public.order_documents.phase is
  'PICKUP — при взятии (состояние «до»), DELIVERY — при сдаче («после»). Основа доказательства в claim.';

/*
 * Фаза у уже загруженного выводится из рода: фото загрузки — взятие,
 * фото выгрузки — сдача, фото повреждения — по роли своей точки.
 */
update public.order_documents d
set phase = case
  when d.kind = 'LOADING_PHOTO' then 'PICKUP'::public.trip_phase
  when d.kind = 'UNLOADING_PHOTO' then 'DELIVERY'::public.trip_phase
  when d.kind = 'DAMAGE_PHOTO' then (
    select case when s.role in ('PICKUP', 'EXTRA_LOAD') then 'PICKUP'::public.trip_phase
                else 'DELIVERY'::public.trip_phase end
    from public.order_stops s where s.id = d.stop_id
  )
end
where d.phase is null and d.kind <> 'CMR';

create index order_documents_phase_idx on public.order_documents (order_id, phase);


/*
 * Вход для приложения водителя.
 *
 * Приложение кладёт файл в trip-docs по пути <order_id>/app/<phase>/…
 * служебным ключом и регистрирует его здесь. Строка появляется в рейсе —
 * и тем самым во всех claims этого рейса, без отдельной привязки.
 *
 * Только служебная роль: у водителя нет учётной записи в кабинете, его
 * запросы подписывает шлюз (lib/driver/gate.ts), как у агента WhatsApp.
 */
create or replace function public.register_trip_photo(
  p_order_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes integer,
  p_phase public.trip_phase,
  p_subject public.photo_subject default null,
  p_stop_id uuid default null,
  p_captured_at timestamptz default null,
  p_lat double precision default null,
  p_lon double precision default null,
  p_external_id text default null,
  p_damage boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_status;
  v_id uuid;
begin
  select status into v_status from public.orders where id = p_order_id;
  if v_status is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  /* Снимать есть что, пока рейс идёт; после закрытия — досылка отложенного. */
  if v_status not in ('AWAIT_DRIVER', 'IN_PROGRESS', 'DONE') then
    raise exception 'Рейс в статусе % фото не принимает.', v_status using errcode = '55000';
  end if;

  /* Путь обязан лежать в папке своего рейса: по ней решают политики Storage. */
  if split_part(p_storage_path, '/', 1) <> p_order_id::text then
    raise exception 'Файл лежит не в папке рейса.' using errcode = '22023';
  end if;

  if p_stop_id is not null and not exists (
    select 1 from public.order_stops where id = p_stop_id and order_id = p_order_id
  ) then
    raise exception 'Точка не из этого рейса.' using errcode = '22023';
  end if;

  /* Повтор той же отправки возвращает уже записанную строку. */
  if p_external_id is not null then
    select id into v_id from public.order_documents where external_id = p_external_id;
    if v_id is not null then return v_id; end if;
  end if;

  insert into public.order_documents (
    order_id, stop_id, kind, storage_path, file_name, mime_type, size_bytes,
    source, phase, subject, captured_at, captured_lat, captured_lon, external_id
  )
  values (
    p_order_id,
    p_stop_id,
    case
      when p_damage and p_stop_id is not null then 'DAMAGE_PHOTO'
      when p_phase = 'PICKUP' then 'LOADING_PHOTO'
      else 'UNLOADING_PHOTO'
    end::public.trip_document_kind,
    p_storage_path,
    left(p_file_name, 120),
    p_mime_type,
    p_size_bytes,
    'DRIVER_APP',
    p_phase,
    p_subject,
    p_captured_at,
    p_lat,
    p_lon,
    p_external_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.register_trip_photo(
  uuid, text, text, text, integer, public.trip_phase, public.photo_subject, uuid,
  timestamptz, double precision, double precision, text, boolean
) is 'Регистрирует фото из приложения водителя в рейсе. Идемпотентна по external_id. Только service_role.';

revoke all on function public.register_trip_photo(
  uuid, text, text, text, integer, public.trip_phase, public.photo_subject, uuid,
  timestamptz, double precision, double precision, text, boolean
) from public, anon, authenticated;

grant execute on function public.register_trip_photo(
  uuid, text, text, text, integer, public.trip_phase, public.photo_subject, uuid,
  timestamptz, double precision, double precision, text, boolean
) to service_role;


-- ── Claim ──────────────────────────────────────────────────────────

create type public.claim_kind as enum (
  'CARGO_DAMAGE',  -- повреждение груза или прицепа
  'SHORTAGE',      -- недостача
  'DOWNTIME',      -- простой
  'DEVIATION',     -- отклонение от маршрута или времени
  'OTHER'
);

create type public.claim_status as enum ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

comment on type public.claim_status is
  'OPEN — подан; IN_REVIEW — оператор разбирает; RESOLVED — решён; REJECTED — отклонён.';

create table public.claims (
  id uuid primary key default gen_random_uuid(),

  /* CL-<номер рейса>-<n>: по нему спор ищут в переписке и в отчёте. */
  ref text not null unique,

  order_id uuid not null references public.orders (id) on delete cascade,

  /* Где случилось. NULL — рейс целиком: простой, отклонение от маршрута. */
  stop_id uuid references public.order_stops (id) on delete set null,

  kind public.claim_kind not null,
  status public.claim_status not null default 'OPEN',

  /* Кто подал и против кого. Оператор стороной не бывает. */
  filed_by_role public.party_role not null,
  filed_by_company_id uuid not null references public.companies (id) on delete cascade,
  against_company_id uuid not null references public.companies (id) on delete cascade,
  filed_by uuid references auth.users (id) on delete set null,

  description text not null,

  /* Сумма претензии без налога, в центах. Необязательна: простой не всегда оценён. */
  amount_cents integer,

  /* Решение оператора — обязательно у RESOLVED и REJECTED. */
  resolution text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint claims_parties_differ check (filed_by_company_id <> against_company_id),
  constraint claims_filer_role check (filed_by_role in ('SHIPPER', 'CARRIER')),
  constraint claims_description_length check (length(btrim(description)) between 10 and 4000),
  constraint claims_amount_sane check (amount_cents is null or amount_cents between 0 and 100000000),
  constraint claims_resolution_length check (resolution is null or length(resolution) <= 4000),
  constraint claims_closed_has_moment
    check ((status in ('RESOLVED', 'REJECTED')) = (resolved_at is not null))
);

comment on table public.claims is
  'Претензии и отклонения по рейсу: сторона против стороны, оператор посредник.';

create index claims_order_idx on public.claims (order_id);
create index claims_filed_by_idx on public.claims (filed_by_company_id, created_at desc);
create index claims_against_idx on public.claims (against_company_id, created_at desc);
create index claims_open_idx on public.claims (updated_at desc) where status in ('OPEN', 'IN_REVIEW');

create trigger claims_touch
  before update on public.claims
  for each row execute function app.touch_updated_at();


-- ── Вложения ───────────────────────────────────────────────────────

create table public.claim_attachments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,

  /* Путь в бакете claim-docs. Первый сегмент — идентификатор claim. */
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,

  author_role public.party_role not null,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint claim_attachments_size check (size_bytes between 1 and 10485760)
);

create index claim_attachments_claim_idx on public.claim_attachments (claim_id, created_at);


-- ── Лента: история и переписка ─────────────────────────────────────

create type public.claim_event_kind as enum ('CREATED', 'COMMENT', 'STATUS', 'ATTACHMENT');

create table public.claim_events (
  id bigint generated always as identity primary key,
  claim_id uuid not null references public.claims (id) on delete cascade,

  kind public.claim_event_kind not null,

  /* Роль, а не компания: так лента читается одинаково у всех, и имя перевозчика не утекает. */
  author_role public.party_role not null,
  author_id uuid references auth.users (id) on delete set null,

  body text,
  status_from public.claim_status,
  status_to public.claim_status,
  attachment_id uuid references public.claim_attachments (id) on delete set null,

  created_at timestamptz not null default now(),

  constraint claim_events_body_length check (body is null or length(body) <= 4000),
  constraint claim_events_comment_has_body
    check (kind <> 'COMMENT' or length(btrim(coalesce(body, ''))) > 0),
  constraint claim_events_status_has_target check (kind <> 'STATUS' or status_to is not null),
  constraint claim_events_attachment_has_file check (kind <> 'ATTACHMENT' or attachment_id is not null)
);

create index claim_events_claim_idx on public.claim_events (claim_id, created_at, id);


-- ── Кто сторона claim ──────────────────────────────────────────────

/*
 * Подавший, тот, против кого, или оператор. Definer: вызывается из
 * политик Storage, где RLS таблицы claims уже не помощник.
 */
create or replace function app.party_to_claim(p_claim_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_admin() or exists (
    select 1 from public.claims c
    where c.id = p_claim_id
      and app.current_company_id() in (c.filed_by_company_id, c.against_company_id)
  );
$$;

revoke all on function app.party_to_claim(uuid) from public, anon;
grant execute on function app.party_to_claim(uuid) to authenticated, service_role;


-- ── Права: читать можно, писать — только функциями ─────────────────

alter table public.claims enable row level security;
alter table public.claim_attachments enable row level security;
alter table public.claim_events enable row level security;

revoke all on public.claims, public.claim_attachments, public.claim_events from anon, authenticated;

/*
 * Колонки против-кого и подавшего отданы в SELECT, но интерфейс их не
 * показывает: имена приходят из claim_detail, где анонимность решена.
 * Идентификатор компании — не имя, и своей стороне он и так известен.
 */
grant select on public.claims, public.claim_attachments, public.claim_events to authenticated;
grant select, insert, update, delete on public.claims, public.claim_attachments, public.claim_events
  to service_role;
grant usage, select on sequence public.claim_events_id_seq to service_role;

create policy claims_select_party
  on public.claims for select to authenticated
  using ((select app.party_to_claim(id)));

create policy claim_attachments_select_party
  on public.claim_attachments for select to authenticated
  using ((select app.party_to_claim(claim_id)));

create policy claim_events_select_party
  on public.claim_events for select to authenticated
  using ((select app.party_to_claim(claim_id)));


-- ── Бакет вложений ─────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'claim-docs',
  'claim-docs',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "claim docs: стороны читают"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'claim-docs'
    and (select app.party_to_claim(((storage.foldername(name))[1])::uuid))
  );

create policy "claim docs: стороны пишут в папку claim"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'claim-docs'
    and (select app.party_to_claim(((storage.foldername(name))[1])::uuid))
  );

/* Удаления у сторон нет: вложение — доказательство, как CMR. */
create policy "claim docs: оператор удаляет"
  on storage.objects for delete to authenticated
  using (bucket_id = 'claim-docs' and (select app.is_admin()));


-- ── Подать ─────────────────────────────────────────────────────────

create or replace function public.file_claim(
  p_order_id uuid,
  p_kind public.claim_kind,
  p_description text,
  p_stop_id uuid default null,
  p_amount_cents integer default null
)
returns public.claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_role public.party_role;
  v_company uuid;
  v_against uuid;
  v_n integer;
  v_claim public.claims;
begin
  v_role := (select app.current_party_role());
  v_company := (select app.current_company_id());

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if v_role = 'SHIPPER' and v_order.shipper_company_id = v_company then
    v_against := v_order.assigned_company_id;
  elsif v_role = 'CARRIER' and v_order.assigned_company_id = v_company then
    v_against := v_order.shipper_company_id;
  else
    raise exception 'Подать claim может только сторона рейса.' using errcode = '42501';
  end if;

  /*
   * Спорить есть о чём с того момента, как у рейса есть вторая сторона
   * и работа началась. Отменённый и не начатый рейс спора не порождает.
   */
  if v_order.status not in ('IN_PROGRESS', 'DONE') or v_against is null then
    raise exception 'Claim подаётся по идущему или выполненному рейсу.' using errcode = '55000';
  end if;

  if p_stop_id is not null and not exists (
    select 1 from public.order_stops where id = p_stop_id and order_id = p_order_id
  ) then
    raise exception 'Точка не из этого рейса.' using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_description, ''))) < 10 then
    raise exception 'Опишите, что произошло.' using errcode = '22023';
  end if;

  /* Номер по порядку внутри рейса; замок — чтобы два одновременных не взяли один. */
  perform pg_advisory_xact_lock(hashtext('claim:' || p_order_id::text));
  select count(*) + 1 into v_n from public.claims where order_id = p_order_id;

  insert into public.claims (
    ref, order_id, stop_id, kind, filed_by_role, filed_by_company_id,
    against_company_id, filed_by, description, amount_cents
  )
  values (
    'CL-' || v_order.ref || '-' || v_n,
    p_order_id, p_stop_id, p_kind, v_role, v_company,
    v_against, (select auth.uid()), btrim(p_description), p_amount_cents
  )
  returning * into v_claim;

  insert into public.claim_events (claim_id, kind, author_role, author_id, body, status_to)
  values (v_claim.id, 'CREATED', v_role, (select auth.uid()), null, 'OPEN');

  return v_claim;
end;
$$;

revoke all on function public.file_claim(uuid, public.claim_kind, text, uuid, integer) from public, anon;
grant execute on function public.file_claim(uuid, public.claim_kind, text, uuid, integer)
  to authenticated, service_role;


-- ── Комментарий ────────────────────────────────────────────────────

create or replace function public.comment_claim(p_claim_id uuid, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
  v_role public.party_role;
  v_id bigint;
begin
  select * into v_claim from public.claims where id = p_claim_id;
  if v_claim.id is null or not (select app.party_to_claim(p_claim_id)) then
    raise exception 'Claim не найден.' using errcode = 'P0002';
  end if;

  v_role := case when (select app.is_admin()) then 'ADMIN'::public.party_role
                 else (select app.current_party_role()) end;

  /*
   * Закрытый спор сторонам не пишется: решение принято, и переписка
   * после него — это новый спор. Оператору можно — пояснить решение.
   */
  if v_claim.status in ('RESOLVED', 'REJECTED') and v_role <> 'ADMIN' then
    raise exception 'Claim закрыт.' using errcode = '55000';
  end if;

  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Пустой комментарий.' using errcode = '22023';
  end if;

  insert into public.claim_events (claim_id, kind, author_role, author_id, body)
  values (p_claim_id, 'COMMENT', v_role, (select auth.uid()), left(btrim(p_body), 4000))
  returning id into v_id;

  update public.claims set updated_at = now() where id = p_claim_id;

  return v_id;
end;
$$;

revoke all on function public.comment_claim(uuid, text) from public, anon;
grant execute on function public.comment_claim(uuid, text) to authenticated, service_role;


-- ── Вложение ───────────────────────────────────────────────────────

/*
 * Файл уже в Storage — политика пустила только сторону claim. Здесь
 * строка и событие в ленте, одной транзакцией.
 */
create or replace function public.attach_to_claim(
  p_claim_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
  v_role public.party_role;
  v_id uuid;
begin
  select * into v_claim from public.claims where id = p_claim_id;
  if v_claim.id is null or not (select app.party_to_claim(p_claim_id)) then
    raise exception 'Claim не найден.' using errcode = 'P0002';
  end if;

  v_role := case when (select app.is_admin()) then 'ADMIN'::public.party_role
                 else (select app.current_party_role()) end;

  if v_claim.status in ('RESOLVED', 'REJECTED') and v_role <> 'ADMIN' then
    raise exception 'Claim закрыт.' using errcode = '55000';
  end if;

  if split_part(p_storage_path, '/', 1) <> p_claim_id::text then
    raise exception 'Файл лежит не в папке claim.' using errcode = '22023';
  end if;

  insert into public.claim_attachments (
    claim_id, storage_path, file_name, mime_type, size_bytes, author_role, uploaded_by
  )
  values (
    p_claim_id, p_storage_path, left(p_file_name, 120), p_mime_type, p_size_bytes,
    v_role, (select auth.uid())
  )
  returning id into v_id;

  insert into public.claim_events (claim_id, kind, author_role, author_id, body, attachment_id)
  values (p_claim_id, 'ATTACHMENT', v_role, (select auth.uid()),
          nullif(left(btrim(coalesce(p_note, '')), 4000), ''), v_id);

  update public.claims set updated_at = now() where id = p_claim_id;

  return v_id;
end;
$$;

revoke all on function public.attach_to_claim(uuid, text, text, text, integer, text) from public, anon;
grant execute on function public.attach_to_claim(uuid, text, text, text, integer, text)
  to authenticated, service_role;


-- ── Статус ─────────────────────────────────────────────────────────

/*
 * Решает оператор: разбор, решение, отклонение, возврат в разбор.
 *
 * Одно исключение для подавшего: он может закрыть свой claim как
 * решённый — стороны договорились сами, и держать спор открытым ради
 * подписи оператора незачем. Отклонить свой claim или решить чужой
 * сторона не может.
 */
create or replace function public.set_claim_status(
  p_claim_id uuid,
  p_status public.claim_status,
  p_note text default null
)
returns public.claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
  v_admin boolean;
  v_role public.party_role;
  v_note text;
  v_from public.claim_status;
begin
  select * into v_claim from public.claims where id = p_claim_id for update;
  if v_claim.id is null or not (select app.party_to_claim(p_claim_id)) then
    raise exception 'Claim не найден.' using errcode = 'P0002';
  end if;

  v_admin := (select app.is_admin());
  v_role := case when v_admin then 'ADMIN'::public.party_role
                 else (select app.current_party_role()) end;
  v_note := nullif(left(btrim(coalesce(p_note, '')), 4000), '');

  if v_claim.status = p_status then
    raise exception 'Claim уже в этом статусе.' using errcode = '55000';
  end if;

  if not v_admin then
    if not (
      p_status = 'RESOLVED'
      and v_claim.filed_by_company_id = (select app.current_company_id())
      and v_claim.status in ('OPEN', 'IN_REVIEW')
    ) then
      raise exception 'Статус claim меняет оператор.' using errcode = '42501';
    end if;
  end if;

  /* Решение без слов — не решение: сторонам надо знать, на чём оно основано. */
  if p_status in ('RESOLVED', 'REJECTED') and v_admin and v_note is null then
    raise exception 'Опишите решение.' using errcode = '22023';
  end if;

  v_from := v_claim.status;

  update public.claims
  set status = p_status,
      resolution = case when p_status in ('RESOLVED', 'REJECTED') then v_note else resolution end,
      resolved_at = case when p_status in ('RESOLVED', 'REJECTED') then now() else null end,
      resolved_by = case when p_status in ('RESOLVED', 'REJECTED') then (select auth.uid()) else null end
  where id = p_claim_id
  returning * into v_claim;

  insert into public.claim_events (claim_id, kind, author_role, author_id, body, status_from, status_to)
  values (p_claim_id, 'STATUS', v_role, (select auth.uid()), v_note, v_from, p_status);

  return v_claim;
end;
$$;

revoke all on function public.set_claim_status(uuid, public.claim_status, text) from public, anon;
grant execute on function public.set_claim_status(uuid, public.claim_status, text)
  to authenticated, service_role;


-- ── Список ─────────────────────────────────────────────────────────

/*
 * Claims компании — и поданные ею, и против неё. Оператору все.
 *
 * counterparty_name — имя второй стороны так, как его положено видеть:
 * перевозчику — имя заказчика, заказчику — ничего, оператору — обе.
 */
create or replace function public.my_claims(p_status public.claim_status default null)
returns table (
  id uuid,
  ref text,
  order_id uuid,
  order_ref text,
  kind public.claim_kind,
  status public.claim_status,
  filed_by_role public.party_role,
  mine boolean,
  amount_cents integer,
  route_from text,
  route_to text,
  vehicle_plate text,
  shipper_name text,
  carrier_name text,
  events_count integer,
  last_event_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := (select app.is_admin());
  v_role public.party_role := (select app.current_party_role());
  v_company uuid := (select app.current_company_id());
begin
  return query
  select
    c.id, c.ref, c.order_id, o.ref, c.kind, c.status, c.filed_by_role,
    (c.filed_by_company_id = v_company),
    c.amount_cents,
    (select coalesce(s.city, s.place_name) from public.order_stops s
      where s.order_id = o.id order by s.sequence limit 1),
    (select coalesce(s.city, s.place_name) from public.order_stops s
      where s.order_id = o.id order by s.sequence desc limit 1),
    v.plate,
    case when v_admin or v_role = 'CARRIER' then sh.name end,
    case when v_admin then ca.name end,
    (select count(*)::integer from public.claim_events e where e.claim_id = c.id),
    (select max(e.created_at) from public.claim_events e where e.claim_id = c.id),
    c.created_at, c.updated_at
  from public.claims c
  join public.orders o on o.id = c.order_id
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where (v_admin or v_company in (c.filed_by_company_id, c.against_company_id))
    and (p_status is null or c.status = p_status)
  order by (c.status in ('OPEN', 'IN_REVIEW')) desc, c.updated_at desc
  limit 500;
end;
$$;

revoke all on function public.my_claims(public.claim_status) from public, anon;
grant execute on function public.my_claims(public.claim_status) to authenticated, service_role;


-- ── Карточка claim ─────────────────────────────────────────────────

/*
 * Всё о споре одним ответом: сам claim, рейс с маршрутом, документы и
 * фото рейса (доказательства «до» и «после»), вложения и лента.
 *
 * Фото рейса читаются здесь, в момент открытия, а не хранятся в claim:
 * снимок, который приложение водителя пришлёт завтра, окажется здесь
 * без единой строки привязки.
 */
create or replace function public.claim_detail(p_claim_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := (select app.is_admin());
  v_role public.party_role := (select app.current_party_role());
  v_company uuid := (select app.current_company_id());
  v_claim public.claims;
  v_order public.orders;
  v_viewer public.party_role;
begin
  select * into v_claim from public.claims where id = p_claim_id;
  if v_claim.id is null or not (v_admin or v_company in (v_claim.filed_by_company_id, v_claim.against_company_id)) then
    return null;
  end if;

  select * into v_order from public.orders where id = v_claim.order_id;
  v_viewer := case when v_admin then 'ADMIN'::public.party_role else v_role end;

  return jsonb_build_object(
    'viewer', v_viewer,
    'claim', jsonb_build_object(
      'id', v_claim.id,
      'ref', v_claim.ref,
      'kind', v_claim.kind,
      'status', v_claim.status,
      'filed_by_role', v_claim.filed_by_role,
      'mine', v_claim.filed_by_company_id = v_company,
      'stop_id', v_claim.stop_id,
      'description', v_claim.description,
      'amount_cents', v_claim.amount_cents,
      'resolution', v_claim.resolution,
      'resolved_at', v_claim.resolved_at,
      'created_at', v_claim.created_at,
      'updated_at', v_claim.updated_at
    ),
    'order', (
      select jsonb_build_object(
        'id', o.id,
        'ref', o.ref,
        'shipper_ref', o.shipper_ref,
        'status', o.status,
        'order_type', o.order_type,
        'haul_kind', o.haul_kind,
        'container_feet', o.container_feet,
        'trailer', o.trailer,
        'trailer_plate', o.trailer_plate,
        'distance_km', o.distance_km,
        /* Ставку видят все три: заказчик её платит, перевозчик о ней договаривался. */
        'rate_cents', o.rate_cents,
        'closed_at', o.closed_at,
        'vehicle_plate', v.plate,
        'shipper_name', case when v_viewer in ('ADMIN', 'CARRIER') then sh.name end,
        'carrier_name', case when v_viewer = 'ADMIN' then ca.name end,
        'route_geometry', o.route_geometry,
        'route_bounds', o.route_bounds,
        'stops', (
          select jsonb_agg(to_jsonb(s) order by s.sequence)
          from public.order_stops s where s.order_id = o.id
        )
      )
      from public.orders o
      join public.companies sh on sh.id = o.shipper_company_id
      left join public.companies ca on ca.id = o.assigned_company_id
      left join public.vehicles v on v.id = o.assigned_vehicle_id
      where o.id = v_order.id
    ),
    'documents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'kind', d.kind,
          'file_name', d.file_name,
          'storage_path', d.storage_path,
          'mime_type', d.mime_type,
          'size_bytes', d.size_bytes,
          'stop_id', d.stop_id,
          'source', d.source,
          'phase', d.phase,
          'subject', d.subject,
          'captured_at', d.captured_at,
          'created_at', d.created_at
        )
        order by coalesce(d.captured_at, d.created_at)
      )
      from public.order_documents d where d.order_id = v_claim.order_id
    ), '[]'::jsonb),
    'attachments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'file_name', a.file_name,
          'storage_path', a.storage_path,
          'mime_type', a.mime_type,
          'size_bytes', a.size_bytes,
          'author_role', a.author_role,
          'created_at', a.created_at
        )
        order by a.created_at
      )
      from public.claim_attachments a where a.claim_id = v_claim.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'kind', e.kind,
          'author_role', e.author_role,
          'body', e.body,
          'status_from', e.status_from,
          'status_to', e.status_to,
          'attachment_id', e.attachment_id,
          'created_at', e.created_at
        )
        order by e.created_at, e.id
      )
      from public.claim_events e where e.claim_id = v_claim.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.claim_detail(uuid) from public, anon;
grant execute on function public.claim_detail(uuid) to authenticated, service_role;


-- ── Уведомления ────────────────────────────────────────────────────

alter type public.notification_kind add value if not exists 'CLAIM';

/*
 * Каждое событие ленты — уведомление сторонам, кроме автора.
 *
 * Триггером, как у событий заказа: путь записи может быть любым —
 * кабинет, админка, служебный ключ, — а сторона узнать должна всегда.
 * Письмо шлёт приложение следом: в базе нет ни почтового провайдера,
 * ни шаблонов на двух языках.
 */
create or replace function app.on_claim_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
  v_order_ref text;
  v_code text;
  v_params jsonb;
  v_target uuid;
  v_shipper uuid;
begin
  select * into v_claim from public.claims where id = new.claim_id;
  select o.ref, o.shipper_company_id into v_order_ref, v_shipper
  from public.orders o where o.id = v_claim.order_id;

  v_code := case new.kind
    when 'CREATED' then 'claim.opened'
    when 'COMMENT' then 'claim.comment'
    when 'ATTACHMENT' then 'claim.attachment'
    when 'STATUS' then 'claim.status'
  end;

  v_params := jsonb_build_object(
    'ref', v_claim.ref,
    'order', v_order_ref,
    'kind', v_claim.kind,
    'status', coalesce(new.status_to, v_claim.status)
  );

  foreach v_target in array array[v_claim.filed_by_company_id, v_claim.against_company_id]
  loop
    /* Автору о его же действии не пишем; оператору пишем обеим сторонам. */
    if new.author_role <> 'ADMIN'
       and ((new.author_role = 'SHIPPER') = (v_target = v_shipper)) then
      continue;
    end if;

    perform app.notify_event(
      v_target,
      'CLAIM'::public.notification_kind,
      v_code,
      v_params,
      case when v_target = v_shipper then '/shipper/claims/' else '/carrier/claims/' end
        || v_claim.id::text
    );
  end loop;

  return new;
end;
$$;

create trigger claim_events_notify
  after insert on public.claim_events
  for each row execute function app.on_claim_event();


-- ── Оператору в пульс ──────────────────────────────────────────────

/*
 * Счётчик для админки: сколько споров ждёт оператора. Без порога —
 * это очередь работы, а не неисправность.
 */
create or replace function public.claims_open_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when app.is_admin()
    then (select count(*)::integer from public.claims where status in ('OPEN', 'IN_REVIEW'))
    else null end;
$$;

revoke all on function public.claims_open_count() from public, anon;
grant execute on function public.claims_open_count() to authenticated, service_role;
