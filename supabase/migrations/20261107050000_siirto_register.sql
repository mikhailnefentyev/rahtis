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

/*
 * Отдельной таблицей, а не колонками scale_sites: проверенные пункты
 * видят все вошедшие, а здесь имя и телефон человека на приёмке.
 * Читают: оператор, компания, добавившая пункт, и компании, у которых
 * есть объект или рейс с этим пунктом. Пишут — только функцией ниже.
 */
create table public.scale_site_receivers (
  site_id uuid primary key references public.scale_sites (id) on delete cascade,
  operator_name text,
  operator_business_id text,
  postal_code text,
  contact_name text,
  contact_phone text,
  treatment_code text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  constraint scale_site_receivers_operator_name check (operator_name is null or length(operator_name) <= 160),
  constraint scale_site_receivers_business_id check (operator_business_id is null or operator_business_id ~ '^[0-9]{7}-[0-9]$'),
  constraint scale_site_receivers_postal_code check (postal_code is null or postal_code ~ '^[0-9A-Z -]{3,10}$'),
  constraint scale_site_receivers_contact_name check (contact_name is null or length(contact_name) <= 120),
  constraint scale_site_receivers_contact_phone check (contact_phone is null or contact_phone ~ '^\+?[0-9 ()-]{5,24}$'),
  constraint scale_site_receivers_treatment_code check (treatment_code is null or treatment_code ~ '^(R|D)[0-9]{1,2}(\.[0-9])?$')
);

comment on table public.scale_site_receivers is
  'Пункт приёмки как получатель в реестре отходов (SIIRTO): компания, Y-tunnus, индекс, контакт с телефоном, код переработки. Персональные данные контакта — только тем, кто с пунктом работает.';

alter table public.scale_site_receivers enable row level security;
revoke all on public.scale_site_receivers from anon, authenticated;

create policy scale_site_receivers_read
  on public.scale_site_receivers for select to authenticated
  using (
    (select app.is_admin())
    or exists (
      select 1 from public.scale_sites s
      where s.id = site_id and s.created_by_company = (select app.current_company_id())
    )
    or exists (
      select 1 from public.site_jobs j
      where j.receiving_site_id = site_id and j.company_id = (select app.current_company_id())
    )
    or exists (
      select 1 from public.site_loads l
      where l.scale_site_id = site_id and l.company_id = (select app.current_company_id())
    )
  );

create policy mfa_required on public.scale_site_receivers
  as restrictive for all to authenticated
  using ((select app.mfa_satisfied()))
  with check ((select app.mfa_satisfied()));

grant select on public.scale_site_receivers to authenticated;
grant all on public.scale_site_receivers to service_role;

/*
 * Дополнить данные получателя. Проверенный пункт — оператор; непроверенный —
 * добавившая его компания, если она работает (не отклонена и не заморожена).
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
    select 1
    from public.scale_sites s
    join public.companies c on c.id = s.created_by_company
    where s.id = p_site_id
      and s.created_by_company = v_company
      and s.approved_at is null
      and c.status <> 'REJECTED'
      and c.frozen_at is null
  ) then
    raise exception 'Пункт правит оператор или добавившая его компания до проверки.' using errcode = '42501';
  end if;

  insert into public.scale_site_receivers as r
    (site_id, operator_name, operator_business_id, postal_code, contact_name, contact_phone, treatment_code, updated_at, updated_by)
  values (
    p_site_id,
    nullif(btrim(coalesce(p_operator_name, '')), ''),
    nullif(btrim(coalesce(p_operator_business_id, '')), ''),
    nullif(upper(btrim(coalesce(p_postal_code, ''))), ''),
    nullif(btrim(coalesce(p_contact_name, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(upper(btrim(coalesce(p_treatment_code, ''))), ''),
    now(),
    (select auth.uid())
  )
  on conflict (site_id) do update set
    operator_name = excluded.operator_name,
    operator_business_id = excluded.operator_business_id,
    postal_code = excluded.postal_code,
    contact_name = excluded.contact_name,
    contact_phone = excluded.contact_phone,
    treatment_code = excluded.treatment_code,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;
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
