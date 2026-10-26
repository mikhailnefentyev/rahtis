-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · счета по объектам от имени перевозчика (26.10.2026)
--
-- Решение пользователя: счёт клиенту за работу на объекте выставляет
-- сам перевозчик — его Y-tunnus, IBAN, его нумерация, ALV. RAHTIS
-- составляет счёт из подтверждённых дней и отправляет клиенту письмом с
-- PDF; деньги идут перевозчику напрямую, Aivomaa берёт только подписку.
--
-- Когда уходит счёт — настройка объекта: по кнопке (MANUAL), раз в
-- неделю (WEEKLY) или раз в две недели (BIWEEKLY), по понедельникам.
-- В счёт попадают только подтверждённые дни, и каждый — один раз.
-- ═══════════════════════════════════════════════════════════════════

alter table public.site_jobs
  add column invoice_schedule text not null default 'BIWEEKLY'
    constraint site_jobs_invoice_schedule check (invoice_schedule in ('MANUAL', 'WEEKLY', 'BIWEEKLY')),
  add column payment_term_days smallint not null default 14
    constraint site_jobs_payment_term check (payment_term_days between 0 and 90),
  add column customer_street text,
  add column customer_postal_code text,
  add column customer_city text,
  add column customer_country text not null default 'FI'
    constraint site_jobs_customer_country check (customer_country ~ '^[A-Z]{2}$'),
  /* ALV-номер клиента: для иностранного клиента — обратное начисление. */
  add column customer_vat_id text;

create table public.carrier_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid references public.site_jobs (id) on delete set null,
  number text not null,
  reference text not null,
  issued_on date not null,
  due_on date not null,
  period_from date not null,
  period_to date not null,
  /* Снимки сторон на момент выставления: правка карточек позже счёт не меняет. */
  seller jsonb not null,
  customer jsonb not null,
  lines jsonb not null,
  net_cents bigint not null,
  vat_bps integer not null,
  vat_cents bigint not null,
  total_cents bigint not null,
  file_path text,
  sent_to text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index carrier_invoices_number_key on public.carrier_invoices (company_id, number);
create index carrier_invoices_job_idx on public.carrier_invoices (job_id, issued_on desc);

alter table public.carrier_invoices enable row level security;

create policy carrier_invoices_own
  on public.carrier_invoices for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy carrier_invoices_admin
  on public.carrier_invoices for select to authenticated using ((select app.is_admin()));

grant select on public.carrier_invoices to authenticated;

alter table public.site_days
  add column invoice_id uuid references public.carrier_invoices (id) on delete set null;

/*
 * День, попавший в счёт, больше не меняется: ни новый рейс, ни конец, ни
 * подтверждение — иначе сумма счёта разошлась бы с данными. Исправление
 * после счёта — кредитовый счёт, а не правка задним числом.
 */
create or replace function app.site_day_locked_after_invoice()
returns trigger
language plpgsql
set search_path = ''
as $
begin
  if old.invoice_id is not null and new.invoice_id is not distinct from old.invoice_id and (
       new.ended_at is distinct from old.ended_at
    or new.buffer_minutes is distinct from old.buffer_minutes
    or new.approved_at is distinct from old.approved_at
  ) then
    raise exception 'День уже в счёте.' using errcode = '55000';
  end if;
  return new;
end;
$;

create trigger site_days_locked_after_invoice
  before update on public.site_days
  for each row execute function app.site_day_locked_after_invoice();

create or replace function app.site_load_day_not_invoiced()
returns trigger
language plpgsql
set search_path = ''
as $
begin
  if exists (select 1 from public.site_days where id = new.day_id and invoice_id is not null) then
    raise exception 'День уже в счёте.' using errcode = '55000';
  end if;
  return new;
end;
$;

create trigger site_loads_day_not_invoiced
  before insert on public.site_loads
  for each row execute function app.site_load_day_not_invoiced();

create index site_days_uninvoiced_idx on public.site_days (job_id) where invoice_id is null and approved_at is not null;

/* Нумерация счетов перевозчика: своя серия на год, без пропусков. */
create table app.carrier_invoice_counters (
  company_id uuid not null references public.companies (id) on delete cascade,
  year integer not null,
  last integer not null default 0,
  primary key (company_id, year)
);

create or replace function app.next_carrier_invoice_number(p_company_id uuid, p_year integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
begin
  insert into app.carrier_invoice_counters (company_id, year, last)
  values (p_company_id, p_year, 1)
  on conflict (company_id, year) do update set last = app.carrier_invoice_counters.last + 1
  returning last into v_next;
  return p_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$$;

revoke all on function app.next_carrier_invoice_number(uuid, integer) from public, anon, authenticated;
grant usage on schema app to service_role;
grant execute on function app.next_carrier_invoice_number(uuid, integer) to service_role;

/* Тот же номер — для сервера (секретный ключ), через public-обёртку. */
create or replace function public.next_carrier_invoice_number(p_company_id uuid, p_year integer)
returns text
language sql
security definer
set search_path = ''
as $$
  select app.next_carrier_invoice_number(p_company_id, p_year);
$$;

revoke all on function public.next_carrier_invoice_number(uuid, integer) from public, anon, authenticated;
grant execute on function public.next_carrier_invoice_number(uuid, integer) to service_role;

-- ── Расписание: по понедельникам ──────────────────────────────────

insert into app.runtime_config (key, value, note)
values (
  'site_invoices_url',
  'https://www.rahtis.eu/api/sites/invoices',
  'Куда стучится задание счетов по объектам (понедельник утром).'
)
on conflict (key) do update set value = excluded.value, note = excluded.note, updated_at = now();

create or replace function app.run_site_invoices()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  select value into v_url from app.runtime_config where key = 'site_invoices_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';
  if v_url is null or v_secret is null then
    raise notice 'Счета по объектам не выставлены: нет site_invoices_url или reports_secret.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request;

  insert into app.scheduler_calls (request_id, job) values (v_request, 'site_invoices');
  return v_request;
end;
$$;

revoke all on function app.run_site_invoices() from public, anon, authenticated;

/* 05:00 UTC по понедельникам — утро понедельника в Финляндии. */
select cron.schedule('rahtis-site-invoices', '0 5 * * 1', $$ select app.run_site_invoices(); $$);

-- ── Документы: условия и политика ─────────────────────────────────

create or replace function pg_temp.draft_of(p_kind public.legal_kind)
returns uuid
language plpgsql
as $$
declare
  v_active uuid := public.active_legal_document(p_kind);
  v_draft uuid;
begin
  select d.id into v_draft
  from public.legal_documents d
  where d.kind = p_kind and d.status = 'DRAFT'
    and d.version > (select version from public.legal_documents where id = v_active)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (p_kind, (select max(version) + 1 from public.legal_documents where kind = p_kind), 'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  return v_draft;
end;
$$;

do $$
declare
  v_terms uuid := pg_temp.draft_of('TERMS');
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
  v_next integer;
begin
  select coalesce(max(path[2]), 0) + 1 into v_next
  from public.legal_clauses where document_id = v_terms and path[1] = 8 and array_length(path, 1) = 2;

  insert into public.legal_clauses (document_id, locale, path, title, body) values
    (v_terms, 'fi', array[8, v_next], null,
     'Työmaakuljetusten laskut: kuljetusliike voi lisätä palveluun asiakkaansa työmaan ja valita, lähteekö lasku napin painalluksesta, viikoittain vai joka toinen viikko. Lasku laaditaan kuljetusliikkeen nimissä ja kuljetusliikkeen tiedoilla (Y-tunnus, tilinumero, laskunumerointi, arvonlisävero), ja palvelu lähettää sen asiakkaalle sähköpostitse. Laskulle tulevat vain hyväksytyt työpäivät, kukin kerran. Maksu suoritetaan suoraan kuljetusliikkeelle; Aivomaa Oy ei ole laskun osapuoli eikä peri saatavaa. Kuljetusliike vastaa laskun tietojen oikeellisuudesta ja asiakkaan laskutustiedoista.'),
    (v_terms, 'en', array[8, v_next], null,
     'Worksite haulage invoices: a carrier may add its customer''s worksite to the service and choose whether the invoice is sent at the press of a button, weekly or every other week. The invoice is drawn up in the carrier''s name with the carrier''s details (business ID, bank account, invoice numbering, VAT), and the service sends it to the customer by email. Only approved working days are invoiced, each once. Payment is made directly to the carrier; Aivomaa Oy is not a party to the invoice and does not collect the receivable. The carrier is responsible for the correctness of the invoice details and of the customer''s billing details.');

  update public.legal_clauses
  set body = replace(body,
    'Näistä muodostetaan työtunnit, jätelain 121 §:n mukainen siirtoasiakirja ja kuljetusliikkeen raportti.',
    'Näistä muodostetaan työtunnit, jätelain 121 §:n mukainen siirtoasiakirja, kuljetusliikkeen raportti sekä kuljetusliikkeen nimissä asiakkaalle lähetettävä lasku, jota varten tallennetaan asiakkaan laskutusosoite ja arvonlisäverotunniste.')
  where document_id = v_privacy and path = array[2, 16] and locale = 'fi';
  update public.legal_clauses
  set body = replace(body,
    'From these, the working hours, the waste transfer document under section 121 of the Waste Act and the carrier''s report are formed.',
    'From these, the working hours, the waste transfer document under section 121 of the Waste Act, the carrier''s report and the invoice sent to the customer in the carrier''s name are formed; for the invoice, the customer''s billing address and VAT identifier are stored.')
  where document_id = v_privacy and path = array[2, 16] and locale = 'en';
end;
$$;
