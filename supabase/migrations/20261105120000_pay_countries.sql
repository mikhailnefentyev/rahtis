-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · зарплата водителя по странам (5.11.2026)
--
-- Просьба пользователя: для Польши и Прибалтики — схемы, которыми там
-- реально платят, на выбор; не вполне законные — рекомендательно, как
-- финский калькулятор. Исследование: docs/pay/research-driver-pay-countries.md.
--
-- Устройство:
--   1. Набор правил оплаты (tes_rule_sets) становится набором любой
--      страны: страна, код шаблона, оклад в месяц (часовая ставка из
--      оклада и нормы месяца), надбавка за праздник страны, минимум
--      страны для проверки, степень законности и источник.
--   2. Суточные — отдельные наборы (allowance_rule_sets) с правилом
--      страны и ставками по стране поездки (allowance_rates).
--   3. Страна рабочего дня водителя — driver_day_facts (ручная правка);
--      по умолчанию — страна точек рейсов этого дня
--      (driver_day_countries).
--   4. Профиль водителя: набор суточных и премии за км и процент рейса
--      поверх базы — оплата только за км в ЕС запрещена, премией можно.
-- Всё справочно, как и финский расчёт: окончательную зарплату считает
-- работодатель.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Набор правил оплаты любой страны ────────────────────────────

alter table public.tes_rule_sets
  add column country text not null default 'FI',
  add column template_code text,
  add column legality text not null default 'LEGAL',
  add column source_note text,
  add column base_monthly_cents integer,
  add column min_monthly_cents integer,
  add column holiday_bps integer not null default 0,
  add constraint tes_rule_sets_country check (country ~ '^[A-Z]{2}$'),
  add constraint tes_rule_sets_legality check (legality in ('LEGAL', 'GREY', 'NON_COMPLIANT')),
  add constraint tes_rule_sets_source_note_length check (source_note is null or length(source_note) <= 4000),
  add constraint tes_rule_sets_template_code check (template_code is null or template_code ~ '^[A-Z0-9_]{2,40}$'),
  add constraint tes_rule_sets_monthly check (
    (base_monthly_cents is null or base_monthly_cents between 0 and 10000000)
    and (min_monthly_cents is null or min_monthly_cents between 0 and 10000000)
  ),
  add constraint tes_rule_sets_holiday_bps check (holiday_bps between 0 and 30000);

comment on column public.tes_rule_sets.country is
  'Страна правил: праздники для надбавки, норма месяца для оклада, минимум для проверки.';
comment on column public.tes_rule_sets.legality is
  'LEGAL — по закону страны; GREY — встречается, но рискованно; NON_COMPLIANT — не соответствует закону, только справочно с предупреждением.';
comment on column public.tes_rule_sets.base_monthly_cents is
  'Оклад в месяц: ставка часа = оклад ÷ норма месяца (рабочие дни страны × дневная норма).';
comment on column public.tes_rule_sets.min_monthly_cents is
  'Минимальная зарплата страны на дату набора — для предупреждения «ниже минимума».';
comment on column public.tes_rule_sets.holiday_bps is
  'Надбавка за работу в праздник страны (EE 100 %, LV 100 %, LT 100 %), отдельно от воскресенья.';


-- ── 2. Суточные ────────────────────────────────────────────────────

create table public.allowance_rule_sets (
  id uuid primary key default gen_random_uuid(),
  /* NULL — шаблон оператора, видный всем перевозчикам. */
  company_id uuid references public.companies (id) on delete cascade,
  name text not null,
  country text not null,
  template_code text,
  valid_from date not null default current_date,
  currency public.currency_code not null,
  /*
   * Правило страны:
   *   PL_DOMESTIC      — dieta krajowa, неполные дни 8/12 ч, ryczałt za nocleg;
   *   PL_INTERNATIONAL — с 2022 не командировка: договорная надбавка за день
   *                      за границей — это зарплата; льготы PIT 20 € и ZUS 60 €;
   *   EE_ABROAD        — päevaraha 75 € первые 15 дней поездки (≤ 15 в месяц), потом 40 €;
   *   LV_TRIP          — dienas nauda по стране, в месяц ≤ 70 % от (зарплата + суточные);
   *   LT_ABROAD        — dienpinigiai по стране; без налога целиком, если оклад ≥ 1,65 МЗП,
   *                      иначе без налога ≤ 50 % оклада;
   *   GENERIC          — ставка по стране поездки без особых правил (SE, DK, NO…).
   */
  rule text not null,
  params jsonb not null default '{}'::jsonb,
  legality text not null default 'LEGAL',
  source_note text,
  based_on uuid references public.allowance_rule_sets (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint allowance_rule_sets_name check (length(btrim(name)) between 1 and 120),
  constraint allowance_rule_sets_country check (country ~ '^[A-Z]{2}$'),
  constraint allowance_rule_sets_rule check (rule in ('PL_DOMESTIC', 'PL_INTERNATIONAL', 'EE_ABROAD', 'LV_TRIP', 'LT_ABROAD', 'GENERIC')),
  constraint allowance_rule_sets_params check (jsonb_typeof(params) = 'object'),
  constraint allowance_rule_sets_legality check (legality in ('LEGAL', 'GREY', 'NON_COMPLIANT')),
  constraint allowance_rule_sets_template_code check (template_code is null or template_code ~ '^[A-Z0-9_]{2,40}$'),
  constraint allowance_rule_sets_source_note_length check (source_note is null or length(source_note) <= 4000)
);

comment on table public.allowance_rule_sets is
  'Суточные водителя по правилам страны работодателя. Справочно: окончательный расчёт — у работодателя.';

create index allowance_rule_sets_company_idx on public.allowance_rule_sets (company_id);

create table public.allowance_rates (
  rule_set_id uuid not null references public.allowance_rule_sets (id) on delete cascade,
  /* Страна поездки; страна работодателя — внутренняя ставка. */
  country text not null,
  /* Валюта ставки: польские зарубежные — в евро, хотя зарплата в злотых. */
  currency public.currency_code not null,
  day_cents integer not null,
  hotel_limit_cents integer,
  primary key (rule_set_id, country),
  constraint allowance_rates_country check (country ~ '^[A-Z]{2}$'),
  constraint allowance_rates_amounts check (
    day_cents between 0 and 1000000 and (hotel_limit_cents is null or hotel_limit_cents between 0 and 10000000)
  )
);

alter table public.allowance_rule_sets enable row level security;
alter table public.allowance_rates enable row level security;
revoke all on public.allowance_rule_sets from anon, authenticated;
revoke all on public.allowance_rates from anon, authenticated;
grant select, insert, update, delete on public.allowance_rule_sets to authenticated;
grant select, insert, update, delete on public.allowance_rates to authenticated;

create policy allowance_rule_sets_select
  on public.allowance_rule_sets for select to authenticated
  using (company_id is null or company_id = (select app.current_company_id()) or (select app.is_admin()));

create policy allowance_rule_sets_write_own
  on public.allowance_rule_sets for all to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER');

create policy allowance_rule_sets_write_template
  on public.allowance_rule_sets for all to authenticated
  using (company_id is null and (select app.is_admin()))
  with check (company_id is null and (select app.is_admin()));

create policy allowance_rates_select
  on public.allowance_rates for select to authenticated
  using (exists (
    select 1 from public.allowance_rule_sets s
    where s.id = rule_set_id
      and (s.company_id is null or s.company_id = (select app.current_company_id()) or (select app.is_admin()))
  ));

create policy allowance_rates_write
  on public.allowance_rates for all to authenticated
  using (exists (
    select 1 from public.allowance_rule_sets s
    where s.id = rule_set_id
      and ((s.company_id = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER')
        or (s.company_id is null and (select app.is_admin())))
  ))
  with check (exists (
    select 1 from public.allowance_rule_sets s
    where s.id = rule_set_id
      and ((s.company_id = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER')
        or (s.company_id is null and (select app.is_admin())))
  ));

create trigger allowance_rule_sets_touch_updated_at
  before update on public.allowance_rule_sets
  for each row execute function app.touch_updated_at();

/* Копия шаблона суточных в компанию — со ставками по странам. */
create or replace function public.copy_allowance_template(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := (select app.current_company_id());
  v_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Копировать шаблон может только перевозчик.' using errcode = '42501';
  end if;

  insert into public.allowance_rule_sets (
    company_id, name, country, template_code, valid_from, currency, rule, params, legality, source_note, based_on, created_by
  )
  select v_company_id, name, country, template_code, valid_from, currency, rule, params, legality, source_note, id, (select auth.uid())
  from public.allowance_rule_sets
  where id = p_template_id and company_id is null
  returning id into v_id;

  if v_id is null then
    raise exception 'Шаблон не найден.' using errcode = 'P0002';
  end if;

  insert into public.allowance_rates (rule_set_id, country, currency, day_cents, hotel_limit_cents)
  select v_id, country, currency, day_cents, hotel_limit_cents
  from public.allowance_rates
  where rule_set_id = p_template_id;

  return v_id;
end;
$$;

revoke all on function public.copy_allowance_template(uuid) from public, anon;
grant execute on function public.copy_allowance_template(uuid) to authenticated;


-- ── 3. Профиль водителя: суточные и премии поверх базы ─────────────

alter table public.driver_pay_profiles
  add column allowance_rule_set_id uuid references public.allowance_rule_sets (id) on delete restrict,
  add column bonus_per_km_cents integer,
  add column bonus_trip_bps integer,
  add constraint driver_pay_profiles_bonus check (
    (bonus_per_km_cents is null or bonus_per_km_cents between 0 and 100000)
    and (bonus_trip_bps is null or bonus_trip_bps between 0 and 10000)
  );

comment on column public.driver_pay_profiles.bonus_per_km_cents is
  'Премия за км поверх базы (часы/оклад). В ЕС оплата преимущественно за км запрещена (Reg. 561/2006 ст. 10), премией — допустимо.';
comment on column public.driver_pay_profiles.bonus_trip_bps is
  'Премия — процент выплаты за рейсы поверх базы.';


-- ── 4. Страна рабочего дня ─────────────────────────────────────────

create table public.driver_day_facts (
  driver_id uuid not null references public.drivers (id) on delete cascade,
  day date not null,
  /* Страна, в которой водитель провёл день (для суточных). */
  country text,
  /* Ночь: HOME дома, CAB в кабине, HOTEL отель/без счёта, FREE жильё дали. */
  night text,
  /* Бесплатное питание: B завтрак, L обед, D ужин. */
  meals text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (driver_id, day),
  constraint driver_day_facts_country check (country is null or country ~ '^[A-Z]{2}$'),
  constraint driver_day_facts_night check (night is null or night in ('HOME', 'CAB', 'HOTEL', 'FREE')),
  constraint driver_day_facts_meals check (meals is null or meals ~ '^B?L?D?$')
);

comment on table public.driver_day_facts is
  'Правка перевозчика к дню водителя: страна, ночёвка, питание. Без строки — страна из точек рейсов дня.';

alter table public.driver_day_facts enable row level security;
revoke all on public.driver_day_facts from anon, authenticated;
grant select, insert, update, delete on public.driver_day_facts to authenticated;

create policy driver_day_facts_carrier
  on public.driver_day_facts for all to authenticated
  using ((select app.owns_driver(driver_id)))
  with check ((select app.owns_driver(driver_id)));

/*
 * Страны дня по точкам рейсов: где водитель отмечал выполнение точек.
 * Последняя страна дня — где он закончил день (там и ночевал). Только
 * водители своей компании.
 */
create or replace function public.driver_day_countries(p_from date, p_to date)
returns table (driver_id uuid, day date, countries text[], last_country text)
language sql
stable
security definer
set search_path = ''
as $$
  with stops as (
    select o.assigned_driver_id as driver_id,
           (s.completed_at at time zone 'Europe/Helsinki')::date as day,
           upper(s.country) as country,
           s.completed_at
    from public.order_stops s
    join public.orders o on o.id = s.order_id
    where o.assigned_company_id = (select app.current_company_id())
      and o.assigned_driver_id is not null
      and s.completed_at is not null
      and s.country ~ '^[A-Za-z]{2}$'
      and (s.completed_at at time zone 'Europe/Helsinki')::date between p_from and p_to
  )
  select driver_id, day,
         array_agg(distinct country),
         (array_agg(country order by completed_at desc))[1]
  from stops
  group by driver_id, day;
$$;

revoke all on function public.driver_day_countries(date, date) from public, anon;
grant execute on function public.driver_day_countries(date, date) to authenticated;


-- ── Копия шаблона оплаты — с новыми полями ─────────────────────────

create or replace function public.copy_tes_template(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := (select app.current_company_id());
  v_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Копировать шаблон может только перевозчик.' using errcode = '42501';
  end if;

  insert into public.tes_rule_sets (
    company_id, name, valid_from, base_hourly_cents,
    daily_regular_minutes, overtime1_minutes, overtime1_bps, overtime2_bps,
    evening_start, evening_end, evening_cents, evening_bps,
    night_start, night_end, night_cents, night_bps,
    saturday_bps, sunday_bps, overtime_basis, period_regular_minutes, period_anchor,
    holidays_as_sunday, min_paid_minutes, note, based_on, created_by,
    currency, country, template_code, legality, source_note, base_monthly_cents, min_monthly_cents, holiday_bps
  )
  select
    v_company_id, name, valid_from, base_hourly_cents,
    daily_regular_minutes, overtime1_minutes, overtime1_bps, overtime2_bps,
    evening_start, evening_end, evening_cents, evening_bps,
    night_start, night_end, night_cents, night_bps,
    saturday_bps, sunday_bps, overtime_basis, period_regular_minutes, period_anchor,
    holidays_as_sunday, min_paid_minutes, note, id, (select auth.uid()),
    currency, country, template_code, legality, source_note, base_monthly_cents, min_monthly_cents, holiday_bps
  from public.tes_rule_sets
  where id = p_template_id and company_id is null
  returning id into v_id;

  if v_id is null then
    raise exception 'Шаблон не найден.' using errcode = 'P0002';
  end if;

  insert into public.tes_wage_rates (rule_set_id, grade, label, sort, valid_from, hourly_cents)
  select v_id, grade, label, sort, valid_from, hourly_cents
  from public.tes_wage_rates
  where rule_set_id = p_template_id;

  return v_id;
end;
$$;


-- ── Приложение водителя: премии поверх базы ────────────────────────

/* Доля от рейсов — и для модели «процент», и для премии-процента поверх часов или оклада. */
create or replace function public.driver_earnings(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select app.current_driver_id());
begin
  if v_driver is null then
    raise exception 'Заработок виден только водителю.' using errcode = '42501';
  end if;

  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'Период не больше двух месяцев.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    /*
     * Смены с запасом в две недели: сверхурочные по TES считаются за
     * 2-недельный период, и первый день месяца может быть его серединой.
     */
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'started_at', s.started_at,
        'ended_at', s.ended_at,
        'odometer_start', s.odometer_start,
        'odometer_end', s.odometer_end,
        'breaks', coalesce((
          select jsonb_agg(jsonb_build_object('started_at', b.started_at, 'ended_at', b.ended_at))
          from public.driver_breaks b
          where b.shift_id = s.id
        ), '[]'::jsonb)
      ) order by s.started_at)
      from public.driver_shifts s
      where s.driver_id = v_driver
        and s.started_at >= (p_from - 14)::timestamptz
        and s.started_at < (p_to + 2)::timestamptz
    ), '[]'::jsonb),

    'trips', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'ref', o.ref,
        'closed_at', o.closed_at,
        'distance_km', o.distance_km,
        'stops_done', (select count(*) from public.order_stops s
                        where s.order_id = o.id and s.completed_at is not null),
        'route_from', (select s.city from public.order_stops s
                        where s.order_id = o.id order by s.sequence limit 1),
        'route_to', (select e.city from app.route_end(o.id) e),
        'share_cents', coalesce((
          select round(app.fx_convert(app.payout_cents(o.rate_cents, coalesce(o.commission_bps, 0)), o.currency, p.currency,
                                       (o.closed_at at time zone 'Europe/Helsinki')::date) * coalesce(p.trip_bps, p.bonus_trip_bps, 0) / 10000.0)::integer
          from public.driver_pay_profiles p
          where p.driver_id = v_driver
            and p.valid_from <= (o.closed_at at time zone 'Europe/Helsinki')::date
          order by p.valid_from desc
          limit 1
        ), 0)
      ) order by o.closed_at)
      from public.orders o
      where o.assigned_driver_id = v_driver
        and o.status = 'DONE'
        and (o.closed_at at time zone 'Europe/Helsinki')::date between p_from and p_to
    ), '[]'::jsonb),

    /* Ставки без процента: доля уже посчитана в share_cents. */
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'valid_from', p.valid_from,
        'model', p.model,
        'currency', p.currency,
        'bonus_per_km_cents', p.bonus_per_km_cents,
        'bonus_trip_bps', p.bonus_trip_bps,
        'per_km_cents', p.per_km_cents,
        'hourly_cents', p.hourly_cents,
        'tes_grade', p.tes_grade,
        'tes_experience_since', p.tes_experience_since,
        'tes', case when r.id is null then null else to_jsonb(r) - 'company_id' - 'created_by' end,
        'rates', coalesce((
          select jsonb_agg(jsonb_build_object('grade', w.grade, 'valid_from', w.valid_from, 'hourly_cents', w.hourly_cents))
          from public.tes_wage_rates w
          where w.rule_set_id = r.id
        ), '[]'::jsonb)
      ) order by p.valid_from)
      from public.driver_pay_profiles p
      left join public.tes_rule_sets r on r.id = p.tes_rule_set_id
      where p.driver_id = v_driver
    ), '[]'::jsonb)
  );
end;
$$;


-- ── Набор суточных в профиле — только свой или шаблон ──────────────

/*
 * Внешний ключ RLS не проверяет: без этой проверки перевозчик мог бы
 * сослаться на чужой набор по id и тем самым запретить владельцу его
 * удалить (ON DELETE RESTRICT). Как app.check_pay_profile_tes для TES.
 */
create or replace function app.check_pay_profile_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.allowance_rule_set_id is not null and not exists (
    select 1
    from public.allowance_rule_sets s
    join public.drivers d on d.id = new.driver_id
    where s.id = new.allowance_rule_set_id
      and (s.company_id is null or s.company_id = d.company_id)
  ) then
    raise exception 'Набор суточных не найден.' using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke all on function app.check_pay_profile_allowance() from public, anon, authenticated;

create trigger driver_pay_profiles_allowance_check
  before insert or update of allowance_rule_set_id, driver_id on public.driver_pay_profiles
  for each row execute function app.check_pay_profile_allowance();
