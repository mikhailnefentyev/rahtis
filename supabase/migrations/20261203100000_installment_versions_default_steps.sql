-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · версия договора в сделке и шаги после порога просрочки (24.11.2026)
--
--   · Версия договора. PDF договора собирался из текущего шаблона при каждом
--     скачивании: правка шаблона меняла договор уже подписанной сделки.
--     Теперь у шаблона явная версия (src/lib/installments/contractVersions.ts),
--     а сделка при согласии запоминает шаблон и версию
--     (contract_template, contract_version). Ставит их сама база в
--     accept_installment_terms — в той же транзакции, что переводит сделку в
--     AGREED. Почему здесь, а не в действии сервера после вызова: действие
--     выполняется уже после фиксации согласия, и если оно сорвётся (обрыв,
--     ошибка, перезапуск), сделка останется согласованной без версии, и
--     договор снова печатался бы текущим шаблоном — ровно то, что
--     исправляется. В базе согласие без версии невозможно, а после записи
--     версию не изменить (триггер installment_deals_contract_pinned).
--     Все сделки, у которых договор уже есть (согласие было), записаны на
--     версию 2026-11-23 — текст, действовавший до этой миграции.
--   · Шаги после порога (installment_default_steps). Продавец записывает
--     «дополнительный срок дан» (дата письма и последний день срока) и «отказ
--     от договора заявлен» (дата). Это записи и напоминания: ни денег, ни
--     машины они не двигают; прекращение сделки — по-прежнему
--     terminate_installment_deal. Срок по стране — app.installment_grace_days
--     (повторяет graceDays в rules.ts): Эстония, Латвия, Литва, Германия,
--     Польша — 14 дней, Румыния — 15, Финляндия, Швеция, Дания — без срока
--     (там один шаг — уведомление об изъятии). Точный последний день
--     (получение на следующий рабочий день, выходной — на понедельник)
--     считает приложение (defaultSteps.ts); база проверяет, что он не раньше
--     дня письма плюс срок страны.
-- ═══════════════════════════════════════════════════════════════════

-- ── Версия договора ─────────────────────────────────────────────────

alter table public.installment_deals
  add column contract_template text,
  add column contract_version text,
  add constraint installment_deals_contract_pinned_pair
    check ((contract_template is null) = (contract_version is null));

comment on column public.installment_deals.contract_template is
  'Шаблон договора, записанный при согласии (FI_OSAMAKSU, EE_JARELMAKS…); по нему печатается договор (24.11.2026).';
comment on column public.installment_deals.contract_version is
  'Версия шаблона, записанная при согласии (ГГГГ-ММ-ДД); договор печатается этой версией, даже если шаблон потом сменился (24.11.2026).';

/*
 * Текущая версия шаблона договора страны: «ШАБЛОН@ГГГГ-ММ-ДД».
 *
 * ПОВТОРЯЕТ РЕЕСТР В КОДЕ: src/lib/installments/countries.ts (contract) и
 * contractVersions.ts (последняя версия шаблона). Новая версия текста —
 * новой миграцией переопредели эту функцию; расхождение ловит тест
 * contractVersions.test.mjs. Страна без шаблона — null.
 */
create or replace function app.installment_contract_current(p_country text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case upper(coalesce(p_country, ''))
    when 'FI' then 'FI_OSAMAKSU@2026-11-23'
    when 'EE' then 'EE_JARELMAKS@2026-11-23'
    when 'LV' then 'LV_NOMAKSA@2026-11-23'
    when 'SE' then 'SE_AVBETALNING@2026-11-23'
    when 'DK' then 'DK_KREDITKOEB@2026-11-23'
    when 'LT' then 'LT_ISSIMOKETINAI@2026-11-23'
    when 'DE' then 'DE_RATENKAUF@2026-11-23'
    when 'PL' then 'PL_RATY@2026-11-23'
    when 'RO' then 'RO_RATE@2026-11-23'
  end
$$;

revoke all on function app.installment_contract_current(text) from public, anon, authenticated;

/* Сделки, у которых договор уже есть: версия, действовавшая до этой миграции. */
update public.installment_deals d
set contract_template = split_part(app.installment_contract_current(c.country::text), '@', 1),
    contract_version = split_part(app.installment_contract_current(c.country::text), '@', 2)
from public.companies c
where c.id = d.seller_company_id
  and d.agreed_at is not null
  and d.contract_number is not null
  and d.contract_template is null
  and app.installment_contract_current(c.country::text) is not null;

/* Записанную версию не изменить: договор сделки печатается ею весь срок. */
create or replace function app.installment_deals_contract_pinned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.contract_version is not null
     and (new.contract_template is distinct from old.contract_template or new.contract_version is distinct from old.contract_version) then
    raise exception 'Версия договора сделки уже записана.' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function app.installment_deals_contract_pinned() from public, anon, authenticated;

drop trigger if exists installment_deals_contract_pinned on public.installment_deals;
create trigger installment_deals_contract_pinned
  before update of contract_template, contract_version on public.installment_deals
  for each row execute function app.installment_deals_contract_pinned();

/*
 * Принять условия другой стороны — как в 20261129100000; добавлено
 * (24.11.2026): вместе с AGREED записываются шаблон и версия договора страны
 * продавца (app.installment_contract_current). Нет шаблона — согласия нет.
 */
create or replace function public.accept_installment_terms(p_deal_id uuid, p_version integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
  v_deal public.installment_deals;
  v_number text;
  v_listing_id uuid;
  v_zone text;
  v_contract text;
begin
  /* Порядок блокировок: объявление, потом сделка — как у снятия объявления, без взаимной блокировки. */
  select listing_id into v_listing_id from public.installment_deals where id = p_deal_id;
  perform 1 from public.equipment_listings where id = v_listing_id for update;
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_me not in (v_deal.seller_company_id, v_deal.buyer_company_id) then
    raise exception 'Нет сделки.' using errcode = '42501';
  end if;
  if not app.installment_side_ok(v_me, v_deal.seller_company_id) then
    raise exception 'Продаёт проверенная компания открытой страны, покупает действующий перевозчик с выпиской из реестра и страховкой.' using errcode = '42501';
  end if;
  if v_deal.status <> 'NEGOTIATING' then
    raise exception 'Сделка уже не в переговорах.' using errcode = '55000';
  end if;
  if v_deal.proposed_by = v_me then
    raise exception 'Своё предложение принимает другая сторона.' using errcode = '42501';
  end if;
  if p_version is null or v_deal.version is distinct from p_version then
    raise exception 'Условия изменились — посмотрите новые.' using errcode = '40001';
  end if;
  /* Пояс страны сделки (страны продавца): по нему «сегодня» и год в номере договора. */
  select app.stop_timezone(c.country::text), app.installment_contract_current(c.country::text)
    into v_zone, v_contract
    from public.companies c where c.id = v_deal.seller_company_id;
  v_zone := coalesce(v_zone, 'Europe/Helsinki');
  if v_contract is null then
    raise exception 'Для страны продавца нет договора.' using errcode = '55000';
  end if;
  if v_deal.handover_date <= (now() at time zone v_zone)::date then
    raise exception 'Дата передачи прошла — предложите новую.' using errcode = '22023';
  end if;
  /* Вторая сторона тоже должна быть в порядке на момент согласия; обе — из одной страны. */
  if not app.installment_seller_ok(v_deal.seller_company_id) or not app.installment_company_ok(v_deal.buyer_company_id)
     or not app.installment_same_country(v_deal.seller_company_id, v_deal.buyer_company_id)
     or (select is_test from public.companies where id = v_deal.seller_company_id)
        is distinct from (select is_test from public.companies where id = v_deal.buyer_company_id) then
    raise exception 'Сторона сделки сейчас не может её заключить.' using errcode = '55000';
  end if;
  if not exists (select 1 from public.equipment_listings where id = v_deal.listing_id and status = 'PUBLISHED') then
    raise exception 'Объявление уже недоступно.' using errcode = '55000';
  end if;

  /* Год — по времени страны сделки (у Финляндии — Хельсинки): договор, согласованный в новогоднюю ночь, получал прошлый год (22.11.2026). */
  v_number := 'OS-' || to_char(now() at time zone v_zone, 'YYYY') || '-' || lpad(nextval('public.installment_contract_seq')::text, 5, '0');

  update public.installment_deals
  set status = 'AGREED', agreed_at = now(), contract_number = v_number,
      /* Версия договора — в той же транзакции, что согласие (24.11.2026). */
      contract_template = split_part(v_contract, '@', 1),
      contract_version = split_part(v_contract, '@', 2),
      parties_snapshot = (
        select jsonb_object_agg(p.role, jsonb_build_object(
          'name', coalesce(c.legal_name, c.name),
          'business_id', c.business_id,
          'address', concat_ws(', ', c.legal_street, nullif(concat_ws(' ', c.legal_postal_code, c.legal_city), '')),
          'vat_registered', coalesce(c.vat_number, '') <> '',
          'email', coalesce(c.billing_email, c.contact_email)
        ))
        from (values ('seller', v_deal.seller_company_id), ('buyer', v_deal.buyer_company_id)) as p(role, id)
        join public.companies c on c.id = p.id
      )
  where id = p_deal_id;

  update public.equipment_listings set status = 'RESERVED', updated_at = now() where id = v_deal.listing_id;

  update public.installment_deals
  set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_deal.seller_company_id
  where listing_id = v_deal.listing_id and id <> p_deal_id and status = 'NEGOTIATING';

  return v_number;
end;
$$;

revoke all on function public.accept_installment_terms(uuid, integer) from public, anon;
grant execute on function public.accept_installment_terms(uuid, integer) to authenticated;

-- ── Шаги после порога просрочки ─────────────────────────────────────

/*
 * Письменный срок после порога, дней.
 *
 * ПОВТОРЯЕТ НАБОР ПРАВИЛ В КОДЕ: src/lib/installments/rules.ts (graceDays
 * правил страны). Расхождение ловит тест defaultSteps.test.mjs. 0 — срока нет
 * (Финляндия, Швеция, Дания: после порога сразу уведомление об изъятии).
 */
create or replace function app.installment_grace_days(p_country text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(coalesce(p_country, '')) in ('EE', 'LV', 'LT', 'DE', 'PL') then 14
    when upper(coalesce(p_country, '')) = 'RO' then 15
    else 0
  end
$$;

revoke all on function app.installment_grace_days(text) from public, anon, authenticated;

create table public.installment_default_steps (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.installment_deals (id) on delete cascade,
  /* GRACE — дополнительный срок (Латвия — предупреждение со сроком); WITHDRAWAL — отказ от договора, расторжение или уведомление об изъятии. */
  step text not null constraint installment_default_steps_step check (step in ('GRACE', 'WITHDRAWAL')),
  /* День письма покупателю (по времени страны сделки). */
  given_on date not null,
  /* Последний день срока для оплаты — только у GRACE. */
  deadline date,
  /* Просрочка на день письма — для письма и истории: [{n, due, cents}]. */
  overdue jsonb not null default '[]'::jsonb,
  overdue_cents bigint not null default 0 constraint installment_default_steps_overdue_cents check (overdue_cents >= 0),
  /* Продавец подтвердил, что делает шаг раньше срока или без порога по данным платформы. */
  early boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint installment_default_steps_deadline check ((step = 'GRACE') = (deadline is not null) and (deadline is null or deadline > given_on)),
  constraint installment_default_steps_overdue check (jsonb_typeof(overdue) = 'array' and jsonb_array_length(overdue) <= 120)
);

/* Отказ от договора заявляется один раз. */
create unique index installment_default_steps_one_withdrawal
  on public.installment_default_steps (deal_id) where step = 'WITHDRAWAL';
create index installment_default_steps_deal on public.installment_default_steps (deal_id, given_on);

comment on table public.installment_default_steps is
  'Шаги продавца после порога просрочки: дополнительный срок и отказ от договора (24.11.2026). Записи и напоминания — денег и машины не двигают.';

alter table public.installment_default_steps enable row level security;

create policy installment_default_steps_parties on public.installment_default_steps
  for select to authenticated
  using (exists (
    select 1 from public.installment_deals d
    where d.id = deal_id
      and ((select app.current_company_id()) in (d.seller_company_id, d.buyer_company_id) or (select app.is_admin()))
  ));

grant select on public.installment_default_steps to authenticated;

/*
 * Продавец записывает шаг (24.11.2026). Проверки:
 *   · сделка в рассрочке (ACTIVE), записывает главный в компании-продавце;
 *   · день письма — не в будущем и не раньше согласия;
 *   · после заявленного отказа шагов больше нет;
 *   · GRACE — только где у страны есть срок; последний день не раньше дня
 *     письма плюс срок страны; новый срок, пока прежний идёт, — только с
 *     подтверждением продавца (p_confirmed);
 *   · WITHDRAWAL — где у страны есть срок, только после записанного срока;
 *     если срок ещё не прошёл на день отказа — только с подтверждением
 *     (в Эстонии и Германии отказ можно заявить заранее).
 * Возвращает id записи. Коды: 42501 — не продавец; 55000 — сделка не в
 * рассрочке или отказ уже заявлен; P0010 — сначала срок; P0011 — нужно
 * подтверждение; 22023 — неверные данные.
 */
create or replace function public.record_installment_default_step(
  p_deal_id uuid,
  p_step text,
  p_given_on date,
  p_deadline date,
  p_overdue jsonb,
  p_overdue_cents bigint,
  p_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
  v_deal public.installment_deals;
  v_country text;
  v_zone text;
  v_today date;
  v_days integer;
  v_grace public.installment_default_steps;
  v_id uuid;
  v_overdue jsonb;
  v_overdue_cents bigint;
begin
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_deal.seller_company_id <> v_me then
    raise exception 'Шаги после просрочки записывает продавец.' using errcode = '42501';
  end if;
  if v_deal.status <> 'ACTIVE' then
    raise exception 'Шаги записываются только по сделке в рассрочке.' using errcode = '55000';
  end if;
  if p_step is null or p_step not in ('GRACE', 'WITHDRAWAL') then
    raise exception 'Шаг.' using errcode = '22023';
  end if;
  /*
   * p_overdue и p_overdue_cents не используются (24.11.2026, по проверке
   * безопасности): просрочку, которая попадёт в письмо покупателю и в его
   * уведомление, считает сама база по графику платежей — прямым вызовом
   * функции продавец не может записать выдуманную сумму. Параметры остались
   * ради совместимости вызова.
   */

  select c.country::text, app.stop_timezone(c.country::text) into v_country, v_zone
    from public.companies c where c.id = v_deal.seller_company_id;
  v_zone := coalesce(v_zone, 'Europe/Helsinki');
  v_today := (now() at time zone v_zone)::date;
  v_days := app.installment_grace_days(v_country);

  if p_given_on is null or p_given_on > v_today or p_given_on < (v_deal.agreed_at at time zone v_zone)::date then
    raise exception 'День письма.' using errcode = '22023';
  end if;
  if exists (select 1 from public.installment_default_steps where deal_id = p_deal_id and step = 'WITHDRAWAL') then
    raise exception 'Отказ от договора уже записан.' using errcode = '55000';
  end if;

  select * into v_grace from public.installment_default_steps
    where deal_id = p_deal_id and step = 'GRACE'
    order by given_on desc, created_at desc limit 1;

  if p_step = 'GRACE' then
    if v_days = 0 then
      raise exception 'В стране сделки дополнительного срока нет.' using errcode = '22023';
    end if;
    if p_deadline is null or p_deadline < p_given_on + v_days then
      raise exception 'Срок короче срока страны.' using errcode = '22023';
    end if;
    if v_grace.id is not null and v_grace.deadline >= v_today and not coalesce(p_confirmed, false) then
      raise exception 'Прежний срок ещё идёт.' using errcode = 'P0011';
    end if;
  else
    if p_deadline is not null then
      raise exception 'У отказа нет срока.' using errcode = '22023';
    end if;
    if v_days > 0 and v_grace.id is null then
      raise exception 'Сначала дополнительный срок.' using errcode = 'P0010';
    end if;
    if v_grace.id is not null and v_grace.deadline >= p_given_on and not coalesce(p_confirmed, false) then
      raise exception 'Срок ещё не прошёл.' using errcode = 'P0011';
    end if;
  end if;

  /* Неоплаченные взносы со сроком раньше дня письма — по графику сделки. */
  select coalesce(jsonb_agg(jsonb_build_object('n', p.n, 'due', p.due_date, 'cents', p.principal_cents + p.interest_cents) order by p.n), '[]'::jsonb),
         coalesce(sum(p.principal_cents + p.interest_cents), 0)
    into v_overdue, v_overdue_cents
    from public.installment_payments p
    where p.deal_id = p_deal_id and p.paid_at is null and p.due_date < p_given_on;
  if v_overdue_cents <= 0 then
    raise exception 'На день письма просроченных взносов нет.' using errcode = '22023';
  end if;

  insert into public.installment_default_steps (deal_id, step, given_on, deadline, overdue, overdue_cents, early, created_by)
  values (p_deal_id, p_step, p_given_on, p_deadline, v_overdue, v_overdue_cents, coalesce(p_confirmed, false), (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_installment_default_step(uuid, text, date, date, jsonb, bigint, boolean) from public, anon;
grant execute on function public.record_installment_default_step(uuid, text, date, date, jsonb, bigint, boolean) to authenticated;
