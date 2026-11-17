-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · недельный счёт перевозчика заказчику (17.11.2026)
--
-- Модель: Aivomaa Oy в перевозках не участвует; счета между участниками
-- выставляются раз в неделю. Счёт выставляет сам перевозчик — его имя,
-- Y-tunnus, IBAN, его серия номеров. RAHTIS по понедельникам составляет
-- его из завершённых на прошлой неделе прямых заказов (contract_party
-- CARRIER) и отправляет заказчику письмом с PDF, ответ — на почту
-- перевозчика. Деньги идут перевозчику напрямую.
--
--   · companies.weekly_invoicing — перевозчик поручает RAHTIS составлять
--     и отправлять такие счета от его имени (по умолчанию да); кто
--     выставляет из своей бухгалтерии, выключает;
--   · orders.carrier_invoice_id — заказ уже в счёте: второй раз не
--     попадёт (закрепление «где пусто», как у дней объекта);
--   · carrier_invoices.kind / customer_company_id — счёт за перевозки и
--     его получатель; заказчик видит выставленные ему счета;
--   · объекты: расписание счетов — раз в неделю (две недели убраны).
-- ═══════════════════════════════════════════════════════════════════

alter table public.companies
  add column weekly_invoicing boolean not null default true;

comment on column public.companies.weekly_invoicing is
  'Перевозчик поручил RAHTIS составлять и отправлять от его имени недельный счёт заказчику по прямым заказам (17.11.2026).';

alter table public.carrier_invoices
  add column kind text not null default 'SITE'
    constraint carrier_invoices_kind check (kind in ('SITE', 'FREIGHT')),
  add column customer_company_id uuid references public.companies (id) on delete set null;

create index carrier_invoices_customer_idx on public.carrier_invoices (customer_company_id, issued_on desc)
  where customer_company_id is not null;

/* Заказчик видит счета, выставленные ему через RAHTIS. */
create policy carrier_invoices_customer
  on public.carrier_invoices for select to authenticated
  using (customer_company_id = (select app.current_company_id()));

alter table public.orders
  add column carrier_invoice_id uuid references public.carrier_invoices (id) on delete set null;

create index orders_uninvoiced_direct_idx on public.orders (assigned_company_id, closed_at)
  where status = 'DONE' and contract_party = 'CARRIER' and carrier_invoice_id is null;

comment on column public.orders.carrier_invoice_id is
  'Недельный счёт перевозчика, в который вошёл заказ (17.11.2026). Один заказ — один счёт.';

-- ── Объекты: только раз в неделю или по кнопке ─────────────────────

update public.site_jobs set invoice_schedule = 'WEEKLY' where invoice_schedule = 'BIWEEKLY';

alter table public.site_jobs alter column invoice_schedule set default 'WEEKLY';
alter table public.site_jobs drop constraint site_jobs_invoice_schedule;
alter table public.site_jobs add constraint site_jobs_invoice_schedule
  check (invoice_schedule in ('MANUAL', 'WEEKLY'));
