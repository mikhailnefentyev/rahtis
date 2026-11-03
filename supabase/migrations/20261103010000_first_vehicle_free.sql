-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · первая машина бесплатно, каждая следующая 14,90 € (3.11.2026)
--
-- Решение пользователя 3.11.2026 — агрессивный вход в рынок: у
-- перевозчика на подписке первая активная машина месяца бесплатна,
-- каждая следующая — 14,90 € без ALV. Лесенка 29,90 → 23,90 € снята.
-- Без изменений: «активная» = закрыла рейс в месяце; стол — 3 % + 5 %,
-- минимум 15 €; год вперёд −10 %; от 100 машин — по договорённости;
-- первый месяц бесплатно.
--
-- Цена снижается, поэтому действует сразу — начиная со сбора за ноябрь
-- 2026 (сбор считается после конца месяца). TERMS 8.5 и
-- CARRIER_AGREEMENT 3.2 правятся в черновиках, активация — решение
-- пользователя.
--
-- Строка сбора теперь пишет в active_vehicles число ПЛАТНЫХ машин, а в
-- unit_cents — 14,90 €, чтобы в счёте было «N машин × 14,90 €».
-- ═══════════════════════════════════════════════════════════════════

/* Сумма месяца за n активных машин без ALV. Тот же расчёт — в src/lib/config.ts (subscriptionLadderCents). */
create or replace function app.subscription_ladder_cents(p_vehicles integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum((least(p_vehicles, b.hi) - b.lo + 1) * b.unit), 0)::integer
  from (values (1, 1, 0), (2, 2147483647, 1490)) as b (lo, hi, unit)
  where p_vehicles >= b.lo;
$$;

comment on function app.subscription_ladder_cents(integer) is
  'Абонемент за n активных машин в месяц без ALV: первая бесплатно, каждая следующая 14,90 € (с 3.11.2026); от 100 — по договорённости, без неё 14,90 €.';

-- ─── Месячный сбор: платные машины сверх года ───

create or replace function public.issue_monthly_subscriptions(p_month date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  v_count integer;
begin
  insert into public.carrier_subscription_fees (
    carrier_company_id, month, kind, active_vehicles, unit_cents, net_cents, vat_bps, gross_cents
  )
  select
    x.company_id, v_month, 'MONTH', x.billed,
    round(x.net::numeric / x.billed)::integer,
    x.net,
    x.vat_bps,
    x.net + round(x.net * x.vat_bps / 10000.0)::integer
  from (
    select
      a.company_id,
      /* Первая машина бесплатна и считается внутри года, если он есть. */
      a.vehicles - greatest(least(a.vehicles, coalesce(p.vehicles, 0)), 1) as billed,
      app.subscription_ladder_cents(a.vehicles) - app.subscription_ladder_cents(least(a.vehicles, coalesce(p.vehicles, 0))) as net,
      case when c.country = 'FI' then 2550 else 0 end as vat_bps
    from (
      select o.assigned_company_id as company_id, count(distinct o.assigned_vehicle_id)::integer as vehicles
      from public.orders o
      where o.status = 'DONE'
        and o.assigned_vehicle_id is not null
        and (app.closed_moment(o) at time zone 'Europe/Helsinki')::date between v_month and v_end
      group by o.assigned_company_id
    ) a
    join public.companies c on c.id = a.company_id
    left join public.carrier_annual_plans p
      on p.company_id = a.company_id and p.cancelled_at is null and p.starts_on <= v_month and p.ends_on >= v_end
    where not c.is_test
      and c.partnership = 'SUBSCRIBER'
      and (app.free_until(c.id) is null or app.free_until(c.id) < v_end)
  ) x
  where x.billed > 0 and x.net > 0
  on conflict (carrier_company_id, month, kind) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.issue_monthly_subscriptions(date) from public, anon, authenticated;
grant execute on function public.issue_monthly_subscriptions(date) to service_role;

-- ─── Год вперёд: от 2 машин (одна и так бесплатна) ───

create or replace function public.carrier_annual_plan_create(p_vehicles integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_now date := (now() at time zone 'Europe/Helsinki')::date;
  v_start date := (date_trunc('month', v_now) + interval '1 month')::date;
  v_free date;
  v_net integer;
  v_vat integer;
  v_fee uuid;
  v_plan uuid;
begin
  select * into v_company from public.companies where id = (select app.current_company_id());
  if v_company.id is null then
    raise exception 'Компания не найдена.' using errcode = '42501';
  end if;
  if v_company.partnership is distinct from 'SUBSCRIBER' then
    raise exception 'Год вперёд — только на подписке.' using errcode = '42501';
  end if;
  if (select version from public.legal_documents where id = public.active_legal_document('TERMS')) < app.annual_terms_version() then
    raise exception 'Оплата года вперёд откроется с новыми условиями.' using errcode = '55000';
  end if;
  if p_vehicles is null or p_vehicles not between 2 and 99 then
    raise exception 'Число машин 2–99 (первая бесплатна); от 100 — по договорённости.' using errcode = '22023';
  end if;

  /* Бесплатный период не съедается годом: год начинается после него. */
  v_free := app.free_until(v_company.id);
  if v_free is not null and v_free >= v_start then
    v_start := (date_trunc('month', v_free) + interval '1 month')::date;
  end if;

  if exists (
    select 1 from public.carrier_annual_plans
    where company_id = v_company.id and cancelled_at is null and ends_on >= v_start
  ) then
    raise exception 'Год уже оплачен.' using errcode = '23505';
  end if;

  v_net := round(app.subscription_ladder_cents(p_vehicles) * 12 * (10000 - app.annual_discount_bps()) / 10000.0)::integer;
  v_vat := case when v_company.country = 'FI' then 2550 else 0 end;

  /* В строке сбора — платные машины (без первой), цена за машину в месяц со скидкой. */
  insert into public.carrier_subscription_fees (
    carrier_company_id, month, kind, active_vehicles, unit_cents, net_cents, vat_bps, gross_cents
  ) values (
    v_company.id, date_trunc('month', v_now)::date, 'ANNUAL', p_vehicles - 1,
    round(v_net::numeric / (p_vehicles - 1) / 12)::integer, v_net, v_vat,
    v_net + round(v_net * v_vat / 10000.0)::integer
  )
  returning id into v_fee;

  insert into public.carrier_annual_plans (company_id, vehicles, starts_on, ends_on, fee_id, created_by)
  values (v_company.id, p_vehicles, v_start, (v_start + interval '12 months' - interval '1 day')::date, v_fee, auth.uid())
  returning id into v_plan;

  return v_plan;
end;
$$;

revoke all on function public.carrier_annual_plan_create(integer) from public, anon;
grant execute on function public.carrier_annual_plan_create(integer) to authenticated;

-- ─── Условия: TERMS 8.5 и договор перевозчика 3.2 (черновики) ───

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

create or replace function pg_temp.swap(p_doc uuid, p_path integer[], p_locale text, p_from text, p_to text)
returns void
language plpgsql
as $$
begin
  update public.legal_clauses
  set body = replace(body, p_from, p_to)
  where document_id = p_doc and path = p_path and locale = p_locale and position(p_from in body) > 0;
  if not found then
    raise exception 'Пункт % (%): фрагмент не найден: %', array_to_string(p_path, '.'), p_locale, left(p_from, 60);
  end if;
end;
$$;

do $$
declare
  v_terms uuid := pg_temp.draft_of('TERMS');
  v_carrier uuid := pg_temp.draft_of('CARRIER_AGREEMENT');
begin
  perform pg_temp.swap(v_terms, array[8, 5], 'fi',
    'Hinta on porrastettu niin, että kunkin portaan ajoneuvoista maksetaan portaan hinta: 1.–9. ajoneuvo 29,90 euroa, 10.–19. ajoneuvo 27,90 euroa, 20.–49. ajoneuvo 25,90 euroa ja 50. ajoneuvosta alkaen 23,90 euroa ajoneuvolta kuukaudessa. 100. ajoneuvosta alkaen hinnasta voidaan sopia erikseen; ellei toisin sovita, sovelletaan 50. ajoneuvosta alkaen olevaa hintaa. Kuljetusliike voi maksaa vuoden etukäteen valitsemastaan ajoneuvomäärästä, jolloin se maksaa kahdentoista kuukauden porrastetun hinnan kyseisestä määrästä 10 prosentilla alennettuna.',
    'Ensimmäisestä tällaisesta ajoneuvosta ei makseta; kustakin seuraavasta ajoneuvosta maksu on 14,90 euroa kuukaudessa. 100. ajoneuvosta alkaen hinnasta voidaan sopia erikseen; ellei toisin sovita, sovelletaan samaa hintaa. Kuljetusliike voi maksaa vuoden etukäteen valitsemastaan ajoneuvomäärästä, jolloin se maksaa kahdentoista kuukauden hinnan kyseisestä määrästä 10 prosentilla alennettuna.');
  perform pg_temp.swap(v_terms, array[8, 5], 'fi',
    'maksetaan kuukausittain porrastetun hinnan mukaan ilman alennusta',
    'maksetaan kuukausittain 14,90 euroa ajoneuvolta ilman alennusta');

  perform pg_temp.swap(v_terms, array[8, 5], 'en',
    'The price is tiered so that the vehicles of each tier are charged that tier''s price: vehicles 1 to 9 at 29.90 euros, vehicles 10 to 19 at 27.90 euros, vehicles 20 to 49 at 25.90 euros and from the 50th vehicle 23.90 euros per vehicle per month. From the 100th vehicle the price may be agreed separately; unless otherwise agreed, the price from the 50th vehicle applies. The carrier may pay a year in advance for a number of vehicles it chooses, in which case it pays the tiered price of twelve months for that number less 10 per cent.',
    'No fee is charged for the first such vehicle; for each further vehicle the fee is 14.90 euros per month. From the 100th vehicle the price may be agreed separately; unless otherwise agreed, the same price applies. The carrier may pay a year in advance for a number of vehicles it chooses, in which case it pays the price of twelve months for that number less 10 per cent.');
  perform pg_temp.swap(v_terms, array[8, 5], 'en',
    'are charged monthly at the tiered price without discount',
    'are charged monthly at 14.90 euros per vehicle without discount');

  perform pg_temp.swap(v_carrier, array[3, 2], 'fi',
    ', porrastetun hinnan ilman arvonlisäveroa: 1.–9. ajoneuvo 29,90 euroa, 10.–19. ajoneuvo 27,90 euroa, 20.–49. ajoneuvo 25,90 euroa ja 50. ajoneuvosta alkaen 23,90 euroa ajoneuvolta. 100. ajoneuvosta alkaen hinnasta voidaan sopia erikseen; ellei toisin sovita, sovelletaan 50. ajoneuvosta alkaen olevaa hintaa.',
    ', 14,90 euroa ilman arvonlisäveroa kustakin tällaisesta ajoneuvosta lukuun ottamatta ensimmäistä, josta ei makseta. 100. ajoneuvosta alkaen hinnasta voidaan sopia erikseen; ellei toisin sovita, sovelletaan samaa hintaa.');
  perform pg_temp.swap(v_carrier, array[3, 2], 'en',
    ', a tiered price excluding value added tax: vehicles 1 to 9 at 29.90 euros, vehicles 10 to 19 at 27.90 euros, vehicles 20 to 49 at 25.90 euros and from the 50th vehicle 23.90 euros per vehicle. From the 100th vehicle the price may be agreed separately; unless otherwise agreed, the price from the 50th vehicle applies.',
    ', 14.90 euros excluding value added tax for each such vehicle except the first, for which no fee is charged. From the 100th vehicle the price may be agreed separately; unless otherwise agreed, the same price applies.');
end;
$$;
