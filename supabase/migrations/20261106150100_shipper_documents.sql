-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы заказчика для перевозчиков прямого режима
--
-- Решение пользователя 6.11.2026: заказчик (экспедитор и грузовладелец)
-- по желанию загружает в кабинете выписку из реестра, справку об
-- отсутствии налоговой задолженности, подтверждение регистрации по НДС
-- и документ о праве подписи. Ничего не обязательно и ничего не
-- закрывает. Проверяет оператор (review_company_document); перевозчик в
-- режиме «напрямую» видит в сведениях об оплате только отметки
-- «проверено, выдан …, действует до …» — ни файлов, ни проверяющего.
--
-- Сроки:
--   · справка о налогах — до даты, указанной в ней, иначе 90 дней от
--     выдачи;
--   · выписка из реестра — «свежая» 12 месяцев от выдачи (или до
--     указанной даты, если она раньше);
--   · НДС и право подписи — бессрочно, если дата не указана.
-- Срок ничего не пишет по расписанию: сводка сравнивает даты сама.
--
-- Документы — те же company_documents, бакет company-docs, загрузка и
-- решение оператора, что у полиса экспедитора. Хранение — как у прочих
-- документов компании.
-- ═══════════════════════════════════════════════════════════════════


-- ── Дата выдачи ────────────────────────────────────────────────────

alter table public.company_documents
  add column if not exists issued_on date;

comment on column public.company_documents.issued_on is
  'Дата выдачи документа. Обязательна у выписки из реестра и налоговых справок заказчика: по ней судят о свежести.';

alter table public.company_documents
  add constraint company_documents_shipper_issued_on
    check (
      kind not in ('REGISTER_EXTRACT', 'TAX_DEBT_CERTIFICATE', 'VAT_CERTIFICATE')
      or issued_on is not null
    ),
  add constraint company_documents_issued_before_until
    check (issued_on is null or valid_until is null or valid_until >= issued_on);

comment on column public.company_documents.review_status is
  'Решение оператора по документу экспедитора (FORWARDER_*) и заказчика (REGISTER_EXTRACT, TAX_DEBT_CERTIFICATE, VAT_CERTIFICATE, SIGNATORY_AUTHORITY): PENDING, APPROVED, REJECTED. У документов перевозчика не используется.';


-- ── Только заказчик ────────────────────────────────────────────────

/*
 * Эти виды — у заказчика; у перевозчика свой набор (лицензия и
 * страховка). Дата выдачи не из будущего: справку «на завтра» не выдают.
 * Поля решения сбрасывает прежний триггер company_documents_review_defaults
 * — он не смотрит на вид, новые виды тоже приходят PENDING.
 */
create or replace function app.shipper_document_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind in ('REGISTER_EXTRACT', 'TAX_DEBT_CERTIFICATE', 'VAT_CERTIFICATE', 'SIGNATORY_AUTHORITY') then
    if not exists (
      select 1 from public.companies c
      where c.id = new.company_id and c.kind = 'SHIPPER'
    ) then
      raise exception 'Этот документ загружает заказчик.' using errcode = '22023';
    end if;
    if new.issued_on is not null and new.issued_on > (now() at time zone 'Europe/Helsinki')::date then
      raise exception 'Дата выдачи в будущем.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app.shipper_document_guard() from public, anon, authenticated;

create trigger company_documents_shipper_kinds
  before insert on public.company_documents
  for each row execute function app.shipper_document_guard();

create index company_documents_shipper_review_idx
  on public.company_documents (uploaded_at)
  where review_status = 'PENDING'
    and kind in ('REGISTER_EXTRACT', 'TAX_DEBT_CERTIFICATE', 'VAT_CERTIFICATE', 'SIGNATORY_AUTHORITY');


-- ── Срок и отметка ─────────────────────────────────────────────────

/*
 * До какой даты отметка «проверено» действует. NULL — бессрочно (или
 * даты нет вовсе). Повторено в src/lib/shipper-docs/model.ts.
 */
create or replace function app.company_document_fresh_until(
  p_kind public.document_kind,
  p_issued_on date,
  p_valid_until date
)
returns date
language sql
immutable
as $$
  select case
    when p_kind = 'TAX_DEBT_CERTIFICATE'
      then coalesce(p_valid_until, p_issued_on + 90)
    /* least() пропускает NULL: без указанной даты — 12 месяцев от выдачи. */
    when p_kind = 'REGISTER_EXTRACT'
      then least(p_valid_until, (p_issued_on + interval '12 months')::date)
    else p_valid_until
  end;
$$;

comment on function app.company_document_fresh_until(public.document_kind, date, date) is
  'Срок отметки о документе заказчика: налоговая справка — указанная дата или 90 дней от выдачи; выписка — 12 месяцев от выдачи; прочие — указанная дата или бессрочно.';

/*
 * Последний РАССМОТРЕННЫЙ документ вида, как у полиса экспедитора:
 * новая версия на проверке не гасит прежнюю отметку, а отклонённая —
 * гасит (ранняя одобренная не оживает). Только решение и даты.
 */
create or replace function app.shipper_document_of(p_company_id uuid, p_kind public.document_kind)
returns table (approved boolean, issued_on date, valid_until date)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.review_status = 'APPROVED',
    case when d.review_status = 'APPROVED' then d.issued_on end,
    case when d.review_status = 'APPROVED'
      then app.company_document_fresh_until(d.kind, d.issued_on, d.valid_until)
    end
  from public.company_documents d
  where d.company_id = p_company_id
    and d.kind = p_kind
    and d.review_status <> 'PENDING'
  order by d.uploaded_at desc
  limit 1;
$$;

revoke all on function app.shipper_document_of(uuid, public.document_kind) from public, anon, authenticated;
grant execute on function app.shipper_document_of(uuid, public.document_kind) to service_role;


-- ── Сводка о заказчике: + документы ────────────────────────────────

/*
 * Тип строки меняется (новые колонки в конце), CREATE OR REPLACE этого
 * не умеет — пересоздаём все три функции с прежними правами. Прежние
 * колонки и их порядок — без изменений.
 */
drop function if exists public.shipper_trust(uuid[]);
drop function if exists public.company_trust(uuid);
drop function if exists app.shipper_trust_of(uuid);

create function app.shipper_trust_of(p_company_id uuid)
returns table (
  company_id uuid,
  country text,
  registered_on date,
  on_platform_since date,
  registry_verdict text,
  registry_situations text[],
  registry_vat boolean,
  registry_prepayment boolean,
  registry_checked_at date,
  invoiced_count integer,
  paid_on_time integer,
  paid_late integer,
  avg_days_late integer,
  overdue_count integer,
  reports_on_time integer,
  reports_late integer,
  reports_unpaid integer,
  done_12m integer,
  first_done_at date,
  register_extract_approved boolean,
  register_extract_issued_on date,
  register_extract_valid_until date,
  tax_debt_approved boolean,
  tax_debt_issued_on date,
  tax_debt_valid_until date,
  vat_certificate_approved boolean,
  vat_certificate_issued_on date,
  vat_certificate_valid_until date,
  signatory_approved boolean,
  signatory_issued_on date,
  signatory_valid_until date
)
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select co.*, coalesce(co.registry_check, '{}'::jsonb) as rc
    from public.companies co
    where co.id = p_company_id
  ),
  inv as (
    select
      o.billing,
      (o.paid_at at time zone 'Europe/Helsinki')::date as paid_on,
      app.invoice_due(app.payout_period_start(app.closed_moment(o))) as due
    from public.orders o
    where o.shipper_company_id = p_company_id
      and o.status = 'DONE'
      and o.contract_party = 'RAHTIS'
      and app.closed_moment(o) > now() - interval '12 months'
      and (o.invoiced_at is not null or o.billing <> 'PENDING')
  ),
  pay as (
    select
      count(*)::integer as invoiced,
      /* Оплачен без даты оплаты (старые отметки) — нарушения не видно, считается вовремя. */
      count(*) filter (where paid_on <= due or (paid_on is null and billing in ('PAID', 'SETTLED')))::integer as on_time,
      count(*) filter (where paid_on > due)::integer as late,
      round(avg(paid_on - due) filter (where paid_on > due))::integer as avg_late,
      count(*) filter (
        where paid_on is null and billing = 'INVOICED'
          and (now() at time zone 'Europe/Helsinki')::date > due
      )::integer as overdue
    from inv
  ),
  rep as (
    select
      count(*) filter (where r.status = 'ON_TIME')::integer as on_time,
      count(*) filter (where r.status = 'LATE')::integer as late,
      count(*) filter (where r.status = 'UNPAID')::integer as unpaid
    from public.direct_payment_reports r
    where r.shipper_company_id = p_company_id
      and r.removed_at is null
      and r.reported_at > now() - interval '12 months'
  ),
  vol as (
    select
      count(*) filter (where app.closed_moment(o) > now() - interval '12 months')::integer as done_12m,
      (min(app.closed_moment(o)) at time zone 'Europe/Helsinki')::date as first_done
    from public.orders o
    where o.shipper_company_id = p_company_id and o.status = 'DONE'
  )
  select
    c.id,
    c.country::text,
    app.jsonb_date(c.rc -> 'registeredOn'),
    (coalesce(c.approved_at, c.created_at) at time zone 'Europe/Helsinki')::date,
    c.rc ->> 'verdict',
    case when jsonb_typeof(c.rc -> 'situations') = 'array'
      then array(select jsonb_array_elements_text(c.rc -> 'situations'))
      else '{}'::text[]
    end,
    app.jsonb_bool(c.rc -> 'vat'),
    app.jsonb_bool(c.rc -> 'prepayment'),
    app.jsonb_date(c.rc -> 'checkedAt'),
    pay.invoiced,
    pay.on_time,
    pay.late,
    pay.avg_late,
    pay.overdue,
    rep.on_time,
    rep.late,
    rep.unpaid,
    vol.done_12m,
    vol.first_done,
    coalesce(ex.approved, false),
    ex.issued_on,
    ex.valid_until,
    coalesce(tx.approved, false),
    tx.issued_on,
    tx.valid_until,
    coalesce(vt.approved, false),
    vt.issued_on,
    vt.valid_until,
    coalesce(sg.approved, false),
    sg.issued_on,
    sg.valid_until
  from c
  cross join pay
  cross join rep
  cross join vol
  left join lateral app.shipper_document_of(c.id, 'REGISTER_EXTRACT') ex on true
  left join lateral app.shipper_document_of(c.id, 'TAX_DEBT_CERTIFICATE') tx on true
  left join lateral app.shipper_document_of(c.id, 'VAT_CERTIFICATE') vt on true
  left join lateral app.shipper_document_of(c.id, 'SIGNATORY_AUTHORITY') sg on true;
$$;

revoke all on function app.shipper_trust_of(uuid) from public, anon, authenticated;
grant execute on function app.shipper_trust_of(uuid) to service_role;

/*
 * Для стола перевозчика: сводки по заказчикам. Только служебным ключом —
 * сервер страницы сам отбирает видимые перевозчику заказы (desk_orders,
 * my_assignments) и спрашивает по их заказчикам; свои клиенты
 * перевозчика (client_of) сюда не попадают.
 */
create function public.shipper_trust(p_company_ids uuid[])
returns table (
  company_id uuid,
  country text,
  registered_on date,
  on_platform_since date,
  registry_verdict text,
  registry_situations text[],
  registry_vat boolean,
  registry_prepayment boolean,
  registry_checked_at date,
  invoiced_count integer,
  paid_on_time integer,
  paid_late integer,
  avg_days_late integer,
  overdue_count integer,
  reports_on_time integer,
  reports_late integer,
  reports_unpaid integer,
  done_12m integer,
  first_done_at date,
  register_extract_approved boolean,
  register_extract_issued_on date,
  register_extract_valid_until date,
  tax_debt_approved boolean,
  tax_debt_issued_on date,
  tax_debt_valid_until date,
  vat_certificate_approved boolean,
  vat_certificate_issued_on date,
  vat_certificate_valid_until date,
  signatory_approved boolean,
  signatory_issued_on date,
  signatory_valid_until date
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.*
  from public.companies c
  cross join lateral app.shipper_trust_of(c.id) t
  where c.id = any (p_company_ids) and c.kind = 'SHIPPER' and c.client_of is null;
$$;

revoke all on function public.shipper_trust(uuid[]) from public, anon, authenticated;
grant execute on function public.shipper_trust(uuid[]) to service_role;

/*
 * Та же сводка о своей компании — заказчику («что видят о вас
 * перевозчики»), о любой — оператору.
 */
create function public.company_trust(p_company_id uuid default null)
returns table (
  company_id uuid,
  country text,
  registered_on date,
  on_platform_since date,
  registry_verdict text,
  registry_situations text[],
  registry_vat boolean,
  registry_prepayment boolean,
  registry_checked_at date,
  invoiced_count integer,
  paid_on_time integer,
  paid_late integer,
  avg_days_late integer,
  overdue_count integer,
  reports_on_time integer,
  reports_late integer,
  reports_unpaid integer,
  done_12m integer,
  first_done_at date,
  register_extract_approved boolean,
  register_extract_issued_on date,
  register_extract_valid_until date,
  tax_debt_approved boolean,
  tax_debt_issued_on date,
  tax_debt_valid_until date,
  vat_certificate_approved boolean,
  vat_certificate_issued_on date,
  vat_certificate_valid_until date,
  signatory_approved boolean,
  signatory_issued_on date,
  signatory_valid_until date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := coalesce(p_company_id, (select app.current_company_id()));
begin
  if v_company is null then
    return;
  end if;
  if v_company is distinct from (select app.current_company_id()) and not app.is_admin() then
    raise exception 'Нет доступа к этой компании.' using errcode = '42501';
  end if;

  return query
  select t.*
  from public.companies c
  cross join lateral app.shipper_trust_of(c.id) t
  where c.id = v_company and c.kind = 'SHIPPER';
end;
$$;

revoke all on function public.company_trust(uuid) from public, anon;
grant execute on function public.company_trust(uuid) to authenticated, service_role;


-- ── Решение оператора: + документы заказчика ───────────────────────

/*
 * Та же функция, что для полиса экспедитора (20261106120000), со
 * списком видов шире. Только оператор; отказ — с причиной, её читает
 * компания. Отклонить можно и одобренный прежде (подделка, отзыв).
 */
create or replace function public.review_company_document(
  p_document_id uuid,
  p_decision text,
  p_note text default null
)
returns public.company_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.company_documents;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not app.is_admin() then
    raise exception 'Решение по документу принимает оператор.' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Неизвестное решение: %.', p_decision using errcode = '22023';
  end if;

  if p_decision = 'REJECTED' and v_note is null then
    raise exception 'Причина отказа обязательна.' using errcode = '22023';
  end if;

  update public.company_documents
  set review_status = p_decision,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      review_note = left(v_note, 1000)
  where id = p_document_id
    and kind in (
      'FORWARDER_INSURANCE', 'FORWARDER_LICENSE',
      'REGISTER_EXTRACT', 'TAX_DEBT_CERTIFICATE', 'VAT_CERTIFICATE', 'SIGNATORY_AUTHORITY'
    )
  returning * into v_doc;

  if v_doc.id is null then
    raise exception 'Документ не найден.' using errcode = 'P0002';
  end if;

  return v_doc;
end;
$$;

revoke all on function public.review_company_document(uuid, text, text) from public, anon;
grant execute on function public.review_company_document(uuid, text, text) to authenticated;
