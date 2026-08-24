-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · юридические документы, их версии и согласия
--
-- Тексты сюда не пишутся: они придут от юриста. Здесь только форма, в
-- которую их положат, и она обязана выдержать три требования, о которых
-- вспоминают поздно.
--
-- Первое: версия документа не зависит от языка. Если бы редакция
-- хранилась вместе с языком, финская могла оказаться третьей, а
-- английская второй — и запись «принял версию 3» перестала бы что-либо
-- значить. Поэтому документ это одна версия на всех языках, а текст
-- висит на пунктах с указанием языка. Нумерация общая: п. 5.2 остаётся
-- п. 5.2 в обеих редакциях.
--
-- Второе: пункт должен находиться по номеру одним запросом. Это нужно не
-- людям, а агенту, который сошлётся «по п. 5.2» и обязан подставить
-- ровно тот текст.
--
-- Третье: принятое согласие указывает на конкретный документ, а не на
-- пару «тип плюс номер». Спор о том, какая редакция действовала в день
-- сделки, тогда решается джойном, а не археологией.
-- ═══════════════════════════════════════════════════════════════════

create type public.legal_kind as enum
  ('TERMS', 'PRIVACY', 'CARRIER_AGREEMENT', 'SHIPPER_AGREEMENT');

create type public.legal_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');


-- ── Документ = одна редакция ───────────────────────────────────────

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),

  kind public.legal_kind not null,

  /*
   * Целым числом, а не строкой «1.0». Строка сортируется как строка, и
   * десятая редакция встаёт между первой и второй. Показывать её можно
   * как угодно, сравнивать нужно числом.
   */
  version integer not null,

  /* С какого дня редакция считается действующей. */
  effective_from date not null default current_date,

  status public.legal_status not null default 'DRAFT',

  created_at timestamptz not null default now(),
  activated_at timestamptz,

  constraint legal_documents_version_positive check (version >= 1),
  constraint legal_documents_version_unique unique (kind, version)
);

/*
 * Действующая редакция у типа ровно одна. Частичный уникальный индекс, а
 * не проверка в коде: активировать вторую нельзя даже из панели базы.
 */
create unique index legal_documents_one_active
  on public.legal_documents (kind) where status = 'ACTIVE';

create index legal_documents_kind_idx on public.legal_documents (kind, version desc);

comment on table public.legal_documents is
  'Редакция юридического документа. Язык здесь не хранится: текст лежит в legal_clauses.';


-- ── Пункты ─────────────────────────────────────────────────────────

/*
 * Номер пункта из адреса: {5,2} → «5.2».
 *
 * Своя обёртка, потому что array_to_string объявлена stable, а
 * генерируемая колонка требует immutable. Для массива целых результат
 * детерминирован: функция вывода int4 неизменна, разделитель задан
 * литералом. То есть объявление честное — оно верно для того типа
 * аргумента, ради которого функция и написана.
 *
 * Без SET search_path: вызов сразу указывает на pg_catalog, а лишняя
 * настройка мешает планировщику встроить функцию в выражение колонки.
 */
create or replace function app.clause_number(p_path integer[])
returns text
language sql
immutable
strict
as $$ select pg_catalog.array_to_string(p_path, '.'); $$;

revoke all on function app.clause_number(integer[]) from public, anon;
grant execute on function app.clause_number(integer[]) to authenticated, service_role;


create table public.legal_clauses (
  id uuid primary key default gen_random_uuid(),

  document_id uuid not null references public.legal_documents (id) on delete cascade,
  locale text not null,

  /*
   * Адрес пункта массивом: {5} это раздел 5, {5,2} — пункт 5.2,
   * {5,2,1} — подпункт. Массив сортируется правильно сам и допускает
   * любую глубину без правки схемы.
   */
  path integer[] not null,

  /* Номер для показа и для ссылки. Считается, а не вводится руками. */
  number text generated always as (app.clause_number(path)) stored,

  /* Заголовок есть у раздела, тело — у пункта. Бывает и то и другое. */
  title text,
  body text,

  constraint legal_clauses_locale_known check (locale in ('fi', 'en')),
  constraint legal_clauses_path_shape
    check (array_length(path, 1) between 1 and 4 and path[1] >= 1),
  constraint legal_clauses_has_content check (title is not null or body is not null),
  constraint legal_clauses_unique unique (document_id, locale, path)
);

/* Точка входа агента: документ, язык, номер. */
create index legal_clauses_number_idx on public.legal_clauses (document_id, locale, number);

comment on column public.legal_clauses.path is
  'Адрес пункта: {5,2} для 5.2. Массивом ради верной сортировки и произвольной глубины.';


-- ── Согласия ───────────────────────────────────────────────────────

create table public.legal_acceptances (
  id bigint generated always as identity primary key,

  company_id uuid not null references public.companies (id) on delete cascade,

  /* На документ, а не на пару «тип плюс версия»: см. шапку файла. */
  document_id uuid not null references public.legal_documents (id) on delete restrict,

  /*
   * Кто принял. NULL допустим: заявку подают до появления учётной
   * записи, и согласие с формы заявки принадлежит компании, а не
   * человеку, которого ещё нет.
   */
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz not null default now(),

  /* Откуда пришло согласие — форма заявки или активация кабинета. */
  source text not null default 'ACTIVATION',

  constraint legal_acceptances_source_known
    check (source in ('APPLICATION', 'ACTIVATION', 'REACCEPT')),

  /* Одно согласие на компанию и редакцию: повторное нажатие не событие. */
  constraint legal_acceptances_unique unique (company_id, document_id)
);

create index legal_acceptances_company_idx
  on public.legal_acceptances (company_id, accepted_at desc);

comment on table public.legal_acceptances is
  'Кто и когда принял конкретную редакцию. Ссылка на документ, а не на номер версии.';


-- ── Доступ ─────────────────────────────────────────────────────────

alter table public.legal_documents enable row level security;
alter table public.legal_clauses enable row level security;
alter table public.legal_acceptances enable row level security;

revoke all on public.legal_documents from anon, authenticated;
revoke all on public.legal_clauses from anon, authenticated;
revoke all on public.legal_acceptances from anon, authenticated;

grant select on public.legal_documents to anon, authenticated;
grant select on public.legal_clauses to anon, authenticated;
grant select on public.legal_acceptances to authenticated;

grant select, insert, update, delete on public.legal_documents to service_role;
grant select, insert, update, delete on public.legal_clauses to service_role;
grant select, insert on public.legal_acceptances to service_role;
grant usage, select on sequence public.legal_acceptances_id_seq to service_role;

/*
 * Действующие редакции открыты всем, включая анонима: условия нельзя
 * прятать за входом — человек читает их до того, как согласится.
 * Черновики видит только оператор.
 */
create policy legal_documents_read_active
  on public.legal_documents for select to anon, authenticated
  using (status = 'ACTIVE');

create policy legal_documents_read_admin
  on public.legal_documents for select to authenticated
  using ((select app.is_admin()));

create policy legal_clauses_read_active
  on public.legal_clauses for select to anon, authenticated
  using (
    exists (
      select 1 from public.legal_documents d
      where d.id = document_id and d.status = 'ACTIVE'
    )
  );

create policy legal_clauses_read_admin
  on public.legal_clauses for select to authenticated
  using ((select app.is_admin()));

/* Свои согласия видит компания, все — оператор. */
create policy legal_acceptances_read_own
  on public.legal_acceptances for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy legal_acceptances_read_admin
  on public.legal_acceptances for select to authenticated
  using ((select app.is_admin()));


-- ── Действующая редакция и поиск пункта ────────────────────────────

create or replace function public.active_legal_document(p_kind public.legal_kind)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.legal_documents
  where kind = p_kind and status = 'ACTIVE'
    and effective_from <= current_date
  order by version desc
  limit 1;
$$;

grant execute on function public.active_legal_document(public.legal_kind)
  to anon, authenticated, service_role;


/*
 * Пункт по номеру из действующей редакции.
 *
 * Ради агента: он сошлётся «по п. 5.2» и обязан подставить ровно тот
 * текст, который человек прочитает на сайте. Отдаётся заголовок раздела,
 * в который пункт входит, — без него цитата теряет смысл.
 */
create or replace function public.legal_clause(
  p_kind public.legal_kind,
  p_locale text,
  p_number text
)
returns table (number text, title text, body text, section_title text, version integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.number,
    c.title,
    c.body,
    (
      select s.title from public.legal_clauses s
      where s.document_id = c.document_id
        and s.locale = c.locale
        and s.path = c.path[1:1]
    ),
    d.version
  from public.legal_clauses c
  join public.legal_documents d on d.id = c.document_id
  where d.kind = p_kind
    and d.status = 'ACTIVE'
    and c.locale = p_locale
    and c.number = p_number;
$$;

grant execute on function public.legal_clause(public.legal_kind, text, text)
  to anon, authenticated, service_role;


-- ── Управление редакциями ──────────────────────────────────────────

/*
 * Новая редакция копией предыдущей.
 *
 * Юрист правит текст, а не набирает документ заново: между редакциями
 * меняются два-три пункта из полусотни. Копия сохраняет и нумерацию —
 * ссылка «п. 5.2» из старого договора должна указывать на тот же пункт.
 */
create or replace function public.new_legal_version(p_kind public.legal_kind)
returns public.legal_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source uuid;
  v_new public.legal_documents;
begin
  if not (select app.is_admin()) then
    raise exception 'Редакции документов заводит только оператор.' using errcode = '42501';
  end if;

  select id into v_source from public.legal_documents
  where kind = p_kind order by version desc limit 1;

  insert into public.legal_documents (kind, version)
  values (
    p_kind,
    coalesce((select max(version) + 1 from public.legal_documents where kind = p_kind), 1)
  )
  returning * into v_new;

  if v_source is not null then
    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_new.id, locale, path, title, body
    from public.legal_clauses where document_id = v_source;
  end if;

  perform app.audit('legal.new_version', v_new.id::text,
    jsonb_build_object('kind', p_kind, 'version', v_new.version));

  return v_new;
end;
$$;

revoke all on function public.new_legal_version(public.legal_kind) from public, anon;
grant execute on function public.new_legal_version(public.legal_kind)
  to authenticated, service_role;


create or replace function public.activate_legal_version(p_document_id uuid)
returns public.legal_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.legal_documents;
begin
  if not (select app.is_admin()) then
    raise exception 'Активировать редакции может только оператор.' using errcode = '42501';
  end if;

  select * into v_doc from public.legal_documents where id = p_document_id;

  if v_doc.id is null then
    raise exception 'Редакция не найдена.' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.legal_clauses where document_id = p_document_id) then
    raise exception 'В редакции нет ни одного пункта.' using errcode = '55006';
  end if;

  /* Прежняя уходит в архив: действующая у типа ровно одна. */
  update public.legal_documents
  set status = 'ARCHIVED'
  where kind = v_doc.kind and status = 'ACTIVE' and id <> p_document_id;

  update public.legal_documents
  set status = 'ACTIVE', activated_at = now()
  where id = p_document_id
  returning * into v_doc;

  perform app.audit('legal.activate', p_document_id::text,
    jsonb_build_object('kind', v_doc.kind, 'version', v_doc.version));

  return v_doc;
end;
$$;

revoke all on function public.activate_legal_version(uuid) from public, anon;
grant execute on function public.activate_legal_version(uuid) to authenticated, service_role;


-- ── Принятие условий ───────────────────────────────────────────────

/*
 * Согласие компании с действующими условиями.
 *
 * Принимаются оба обязательных документа разом: разделять «принял
 * условия, но не принял обработку данных» бессмысленно — без второго
 * пользоваться платформой нельзя по закону, а не по нашему желанию.
 */
create or replace function public.accept_legal(p_source text default 'ACTIVATION')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_kind public.legal_kind;
  v_doc uuid;
  v_count integer := 0;
begin
  v_company := (select app.current_company_id());

  if v_company is null then
    raise exception 'Принять условия может только сотрудник компании.' using errcode = '42501';
  end if;

  foreach v_kind in array array['TERMS', 'PRIVACY']::public.legal_kind[] loop
    v_doc := public.active_legal_document(v_kind);

    if v_doc is null then
      raise exception 'Нет действующей редакции документа %.', v_kind using errcode = '55007';
    end if;

    insert into public.legal_acceptances (company_id, document_id, accepted_by, source)
    values (v_company, v_doc, (select auth.uid()), p_source)
    on conflict (company_id, document_id) do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.accept_legal(text) from public, anon;
grant execute on function public.accept_legal(text) to authenticated, service_role;


/* Приняты ли компанией обе обязательные редакции. */
create or replace function app.legal_accepted(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from unnest(array['TERMS', 'PRIVACY']::public.legal_kind[]) as kind
    where public.active_legal_document(kind) is not null
      and not exists (
        select 1 from public.legal_acceptances a
        where a.company_id = p_company_id
          and a.document_id = public.active_legal_document(kind)
      )
  );
$$;

revoke all on function app.legal_accepted(uuid) from public, anon;
grant execute on function app.legal_accepted(uuid) to authenticated, service_role;


-- ── Редакция условий на момент сделки ──────────────────────────────

alter table public.orders
  add column terms_document_id uuid references public.legal_documents (id) on delete set null;

comment on column public.orders.terms_document_id is
  'Редакция условий, действовавшая при публикации. Замораживается, как commission_bps.';

/*
 * Проставляется триггером, а не в create_order: заказ появляется и
 * другими путями, а редакция должна фиксироваться при каждом.
 */
create or replace function app.stamp_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.terms_document_id is null then
    new.terms_document_id := public.active_legal_document('TERMS');
  end if;
  return new;
end;
$$;

create trigger orders_stamp_terms
  before insert on public.orders
  for each row execute function app.stamp_terms();


-- ── Активация требует принятых условий ─────────────────────────────

/*
 * Та же функция плюс одна проверка.
 *
 * Гейт стоит в базе, а не в форме: согласие на обработку данных — это
 * требование закона, и обходить его нажатием кнопки в обход интерфейса
 * не должно получаться. Проверка стоит последней, после реквизитов:
 * человеку показывают одну недостачу за раз, и сначала ту, которую он
 * пришёл заполнять.
 */
create or replace function public.activate_company(p_company_id uuid)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  if p_company_id is distinct from (select app.current_company_id()) then
    raise exception 'Активировать можно только свою компанию.' using errcode = '42501';
  end if;

  select * into v_company from public.companies where id = p_company_id for update;

  if v_company.id is null then
    raise exception 'Компания не найдена.' using errcode = 'P0002';
  end if;

  /* Повторный вызов безвреден: форму можно отправить дважды. */
  if v_company.status = 'ACTIVE' then
    return v_company;
  end if;

  if v_company.status <> 'APPROVED' then
    raise exception 'Активация возможна только после одобрения. Текущий статус: %.',
      v_company.status using errcode = '55000';
  end if;

  if v_company.legal_name is null
     or v_company.legal_street is null
     or v_company.legal_postal_code is null
     or v_company.legal_city is null
     or v_company.legal_country is null
     or v_company.vat_number is null
     or (v_company.kind = 'SHIPPER' and v_company.billing_email is null)
     or (v_company.kind = 'CARRIER' and v_company.iban is null)
  then
    raise exception 'Заполнены не все обязательные реквизиты.' using errcode = '23514';
  end if;

  if not app.legal_accepted(p_company_id) then
    raise exception 'Условия и политика обработки данных не приняты.' using errcode = '55008';
  end if;

  update public.companies
  set status = 'ACTIVE',
      activated_at = now()
  where id = p_company_id
  returning * into v_company;

  return v_company;
end;
$$;
