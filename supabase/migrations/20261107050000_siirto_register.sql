-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · загрязнённый грунт и реестр SIIRTO (7.11.2026)
--
-- SYKE 30.10.2026: чистый грунт вне обязанности siirtoasiakirja вообще;
-- загрязнённый (выше нижнего ориентира PIMA-asetus 214/2007) — 17 05 03*
-- и 17 05 04. Код один и тот же, различает отметка объекта «загрязнён».
--
-- SIIRTO API v4 (testbed.ymparisto.fi/siirtoasiakirjarekisteri):
-- документ на один рейс, после приёма (receivedDate обязателен),
-- правка и удаление — до 90 дней после приёма. Нужны: держатель
-- (компания + контакт с телефоном), перевозчик (контакт с телефоном —
-- водитель рейса), получатель (компания + контакт с телефоном), адреса
-- откуда/куда, номера машин, код отхода, количество, вид деятельности
-- (3 — строительство), тип отхода, код переработки R/D; у опасного —
-- свойства HP, состав, упаковка, агрегатное состояние, способ перевозки.
-- ═══════════════════════════════════════════════════════════════════

-- ── Объект: загрязнённость и данные для реестра ─────────────────────

alter table public.site_jobs
  add column contaminated boolean not null default false,
  add column customer_contact_name text,
  add column customer_contact_phone text,
  add column treatment_code text,
  add column hazard_codes text[] not null default '{}',
  add column hazard_composition text;

alter table public.site_jobs
  add constraint site_jobs_contact_name check (customer_contact_name is null or length(customer_contact_name) <= 120),
  add constraint site_jobs_contact_phone check (customer_contact_phone is null or customer_contact_phone ~ '^\+?[0-9 ()-]{5,24}$'),
  add constraint site_jobs_treatment_code check (treatment_code is null or treatment_code ~ '^(R|D)[0-9]{1,2}(\.[0-9])?$'),
  add constraint site_jobs_hazard_codes check (hazard_codes <@ array['HP1','HP2','HP3','HP4','HP5','HP6','HP7','HP8','HP9','HP10','HP11','HP12','HP13','HP14','HP15']::text[]),
  add constraint site_jobs_hazard_composition check (hazard_composition is null or length(hazard_composition) <= 500);

comment on column public.site_jobs.contaminated is
  'Грунт загрязнён (PIMA): в Финляндии только тогда нужен siirtoasiakirja и подача в SIIRTO. 17 05 03* загрязнён всегда.';
comment on column public.site_jobs.treatment_code is
  'Код переработки у получателя (R5.3, R13, D1 …) для SIIRTO.';


-- ── Пункт приёмки как получатель в реестре ─────────────────────────

alter table public.scale_sites
  add column operator_name text,
  add column operator_business_id text,
  add column postal_code text,
  add column contact_name text,
  add column contact_phone text,
  add column treatment_code text;

alter table public.scale_sites
  add constraint scale_sites_operator_name check (operator_name is null or length(operator_name) <= 160),
  add constraint scale_sites_operator_business_id check (operator_business_id is null or operator_business_id ~ '^[0-9]{7}-[0-9]$'),
  add constraint scale_sites_postal_code check (postal_code is null or postal_code ~ '^[0-9A-Z -]{3,10}$'),
  add constraint scale_sites_contact_name check (contact_name is null or length(contact_name) <= 120),
  add constraint scale_sites_contact_phone check (contact_phone is null or contact_phone ~ '^\+?[0-9 ()-]{5,24}$'),
  add constraint scale_sites_treatment_code check (treatment_code is null or treatment_code ~ '^(R|D)[0-9]{1,2}(\.[0-9])?$');

/*
 * Пункт, добавленный компанией и ещё не проверенный оператором, она же и
 * дополняет (данные получателя для реестра). Проверенные правит оператор.
 */
create or replace function public.update_scale_site_receiver(
  p_site_id uuid,
  p_operator_name text,
  p_operator_business_id text,
  p_postal_code text,
  p_contact_name text,
  p_contact_phone text,
  p_treatment_code text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
begin
  if not (select app.is_admin()) and not exists (
    select 1 from public.scale_sites s
    where s.id = p_site_id and s.created_by_company = v_company and s.approved_at is null
  ) then
    raise exception 'Пункт правит оператор или добавившая его компания до проверки.' using errcode = '42501';
  end if;

  update public.scale_sites set
    operator_name = nullif(btrim(coalesce(p_operator_name, '')), ''),
    operator_business_id = nullif(btrim(coalesce(p_operator_business_id, '')), ''),
    postal_code = nullif(upper(btrim(coalesce(p_postal_code, ''))), ''),
    contact_name = nullif(btrim(coalesce(p_contact_name, '')), ''),
    contact_phone = nullif(btrim(coalesce(p_contact_phone, '')), ''),
    treatment_code = nullif(upper(btrim(coalesce(p_treatment_code, ''))), '')
  where id = p_site_id;
end;
$$;

revoke all on function public.update_scale_site_receiver(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_scale_site_receiver(uuid, text, text, text, text, text, text) to authenticated;


-- ── Рейс: статус в реестре ──────────────────────────────────────────

alter table public.site_loads
  add column siirto_document_id text,
  add column siirto_sent_at timestamptz,
  add column siirto_error text;

alter table public.site_loads
  add constraint site_loads_siirto_error check (siirto_error is null or length(siirto_error) <= 1000);

comment on column public.site_loads.siirto_document_id is
  'Id документа в реестре SIIRTO (shippingDocumentId). Пишет сервер после отправки.';
