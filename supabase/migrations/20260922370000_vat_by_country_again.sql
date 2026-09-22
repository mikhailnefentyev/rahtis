-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · ALV снова по стране в счетах и отчётах
--
-- Миграция vat_zero (22.09.2026) поняла указание неверно и выключила ALV
-- везде. Пользователь уточнил: суммы в кабинетах и расчётах — без ALV
-- («ALV 0 в значениях»), а в счёте и отчёте ALV прибавляется по стране:
-- финской компании 25,5 %, иностранной — 0 % по обратному начислению.
-- Так и было до vat_zero.
--
-- Переключатель app.vat_charged() остаётся и теперь включён: месячный
-- сбор финскому перевозчику снова считается с 25,5 %. Черновики TERMS
-- (8.5) и SHIPPER_AGREEMENT (3.2) получают обратно правило ALV по стране —
-- дословно из действующих редакций.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.vat_charged()
returns boolean
language sql
immutable
as $$
  select true;
$$;

comment on function app.vat_charged() is
  'Прибавляется ли ALV в счетах и отчётах. true: финской компании 25,5 %, иностранной 0 %. Суммы в кабинетах — без ALV.';

do $$
declare
  v_terms uuid;
  v_shipper uuid;
  v_terms_active uuid := public.active_legal_document('TERMS');
  v_shipper_active uuid := public.active_legal_document('SHIPPER_AGREEMENT');
begin
  select id into v_terms from public.legal_documents
  where kind = 'TERMS' and status = 'DRAFT' order by version desc limit 1;
  select id into v_shipper from public.legal_documents
  where kind = 'SHIPPER_AGREEMENT' and status = 'DRAFT' order by version desc limit 1;

  update public.legal_clauses d
  set body = regexp_replace(
    d.body,
    case d.locale when 'fi' then 'Hintoihin ei toistaiseksi lisätä arvonlisäveroa.*$' else 'For the time being no VAT is added.*$' end,
    substring(a.body from case a.locale
      when 'fi' then 'Arvonlisävero määräytyy sopimuskumppanin maan mukaan:.*$'
      else 'Value added tax follows the counterparty''s country:.*$' end))
  from public.legal_clauses a
  where d.document_id = v_terms and d.path = array[8, 5]
    and a.document_id = v_terms_active and a.path = array[8, 5] and a.locale = d.locale;

  update public.legal_clauses d
  set body = regexp_replace(
    d.body,
    case d.locale when 'fi' then 'Hintoihin ei toistaiseksi lisätä arvonlisäveroa.*$' else 'For the time being no VAT is added.*$' end,
    substring(a.body from case a.locale
      when 'fi' then 'Vahvistuksessa ja laskussa kerrotaan sovellettava arvonlisäverokäsittely:.*$'
      else 'The confirmation and the invoice state the applicable value added tax treatment:.*$' end))
  from public.legal_clauses a
  where d.document_id = v_shipper and d.path = array[3, 2]
    and a.document_id = v_shipper_active and a.path = array[3, 2] and a.locale = d.locale;
end;
$$;
