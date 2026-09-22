-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · калькулятор TES по Kuorma-autoalan TES 2025–2028
--
-- 22.09.2026 пользователь положил в проект текст отраслевого договора
-- (Autoliikenteen Työnantajaliitto – AKT, 26.2.2025–31.1.2028) и решил:
-- расчёт привести к договору и дать готовый шаблон с таблицами ставок.
-- Шаблон — данные в базе, а не цифры в формулах: его можно скопировать и
-- поправить, как любой набор правил.
--
-- Что договор требует и чего калькулятор не умел:
--
--   § 11.1, § 14.2  сверхурочные считаются за 2-недельный период: сверх
--                   80 часов первые 12 — +50 %, дальше +100 %. Раньше
--                   были только дневные;
--   § 10.1          вечер 18–22 +15 %, ночь 22–06 +20 % от табличной
--                   ставки — процентом, а не суммой в центах;
--   § 14.5          воскресенье, церковные праздники, День независимости
--                   и 1 мая — +100 %; § 11.4 канун Пасхи, Иванов день и
--                   Рождество — выходные, работа в них по § 10.2 +100 %;
--   § 11.3          работа короче 4 ч 45 мин оплачивается и считается
--                   рабочим временем как 4 ч 45 мин;
--   § 8             ставка зависит от категории водителя и стажа и
--                   растёт 1.6.2026 и 1.6.2027.
--
-- Надбавки за сверхурочные и воскресенья по договору считаются от
-- средней квартальной ставки (keskituntiansio, § 15). Её платформа не
-- знает; § 15.3 велит в этом случае брать табличную, так и сделано.
--
-- Надбавки, о которых платформа знать не может (ADR, спецперевозки,
-- стаж в международных рейсах, ожидание), остаются на работодателе.
-- ═══════════════════════════════════════════════════════════════════

-- ── Новые правила набора ───────────────────────────────────────────

alter table public.tes_rule_sets
  add column overtime_basis text not null default 'DAY',
  add column period_regular_minutes integer not null default 4800,
  add column period_anchor date not null default date '2026-01-05',
  add column evening_bps integer not null default 0,
  add column night_bps integer not null default 0,
  add column holidays_as_sunday boolean not null default false,
  add column min_paid_minutes integer not null default 0,
  add constraint tes_rule_sets_overtime_basis check (overtime_basis in ('DAY', 'PERIOD')),
  add constraint tes_rule_sets_period_minutes check (period_regular_minutes between 60 and 20160),
  add constraint tes_rule_sets_anchor_monday check (extract(isodow from period_anchor) = 1),
  add constraint tes_rule_sets_window_bps check (evening_bps between 0 and 30000 and night_bps between 0 and 30000),
  add constraint tes_rule_sets_min_paid check (min_paid_minutes between 0 and 720);

comment on column public.tes_rule_sets.overtime_basis is
  'DAY — сверхурочные сверх дневной нормы; PERIOD — сверх нормы 2-недельного периода (jaksotyö).';
comment on column public.tes_rule_sets.period_anchor is
  'Понедельник, с которого отсчитываются 2-недельные периоды работодателя.';
comment on column public.tes_rule_sets.holidays_as_sunday is
  'Праздники Финляндии и выходные кануны (TES § 11.4, § 14.5) оплачиваются как воскресенье.';
comment on column public.tes_rule_sets.min_paid_minutes is
  'Рабочий день короче этого оплачивается и считается рабочим временем как этот минимум (TES § 11.3).';


-- ── Таблица ставок по категории и стажу ────────────────────────────

create table public.tes_wage_rates (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.tes_rule_sets (id) on delete cascade,
  grade text not null,
  label text not null,
  sort integer not null default 0,
  valid_from date not null,
  hourly_cents integer not null,
  constraint tes_wage_rates_unique unique (rule_set_id, grade, valid_from),
  constraint tes_wage_rates_hourly check (hourly_cents between 1 and 100000),
  constraint tes_wage_rates_grade check (grade ~ '^[A-Z0-9_]{1,40}$'),
  constraint tes_wage_rates_label check (length(btrim(label)) between 2 and 160)
);

comment on table public.tes_wage_rates is
  'Табличные ставки набора TES: категория водителя и стаж (grade) с датой начала действия.';

create index tes_wage_rates_set_idx on public.tes_wage_rates (rule_set_id, grade, valid_from desc);

alter table public.tes_wage_rates enable row level security;
revoke all on public.tes_wage_rates from anon, authenticated;
grant select, insert, update, delete on public.tes_wage_rates to authenticated;

/* Видно тому, кому виден набор. Писать — владельцу набора или оператору в шаблон. */
create policy tes_wage_rates_select
  on public.tes_wage_rates for select to authenticated
  using (exists (select 1 from public.tes_rule_sets r where r.id = rule_set_id));

create policy tes_wage_rates_write
  on public.tes_wage_rates for all to authenticated
  using (exists (
    select 1 from public.tes_rule_sets r
    where r.id = rule_set_id
      and ((r.company_id = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER')
           or (r.company_id is null and (select app.is_admin())))
  ))
  with check (exists (
    select 1 from public.tes_rule_sets r
    where r.id = rule_set_id
      and ((r.company_id = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER')
           or (r.company_id is null and (select app.is_admin())))
  ));


-- ── Категория водителя в модели оплаты ─────────────────────────────

alter table public.driver_pay_profiles
  add column tes_grade text;

comment on column public.driver_pay_profiles.tes_grade is
  'Категория и стаж по таблице ставок набора TES. NULL — берётся базовая ставка набора.';


-- ── Копия шаблона переносит и новые правила, и таблицу ставок ─────

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
    holidays_as_sunday, min_paid_minutes, note, based_on, created_by
  )
  select
    v_company_id, name, valid_from, base_hourly_cents,
    daily_regular_minutes, overtime1_minutes, overtime1_bps, overtime2_bps,
    evening_start, evening_end, evening_cents, evening_bps,
    night_start, night_end, night_cents, night_bps,
    saturday_bps, sunday_bps, overtime_basis, period_regular_minutes, period_anchor,
    holidays_as_sunday, min_paid_minutes, note, id, (select auth.uid())
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


-- ── Шаблон: Kuorma-autoalan TES 2025–2028 ──────────────────────────

do $$
declare
  v_set uuid;
begin
  insert into public.tes_rule_sets (
    company_id, name, valid_from, base_hourly_cents,
    daily_regular_minutes, overtime_basis, period_regular_minutes, period_anchor,
    overtime1_minutes, overtime1_bps, overtime2_bps,
    evening_start, evening_end, evening_cents, evening_bps,
    night_start, night_end, night_cents, night_bps,
    saturday_bps, sunday_bps, holidays_as_sunday, min_paid_minutes, note
  ) values (
    null, 'Kuorma-autoalan TES 2025–2028', date '2025-03-01', 1609,
    480, 'PERIOD', 4800, date '2026-01-05',
    720, 5000, 10000,
    '18:00', '22:00', 0, 1500,
    '22:00', '06:00', 0, 2000,
    0, 10000, true, 285,
    'Autoliikenteen Työnantajaliitto – AKT, voimassa 26.2.2025–31.1.2028. Palkat 8 §; ilta- ja yötyölisä 10 § 1; ylityö 80 h ylittäviltä tunneilta 2 viikon jaksossa 14 § 2; sunnuntai- ja pyhätyö 14 § 5; vähimmäistyö 4 h 45 min 11 § 3. Lisien perusteena taulukkopalkka (15 § 3). Jakso alkaa maanantaina 5.1.2026 ja sitä seuraavin kahden viikon välein — tarkista oma työvuoroluettelo. Eivät sisälly: ADR-, erikois- ja ulkomaan kokemuslisä, odotusaika, päivärahat.'
  )
  returning id into v_set;

  insert into public.tes_wage_rates (rule_set_id, grade, label, sort, valid_from, hourly_cents)
  select v_set, g.grade, g.label, g.sort, r.valid_from, r.cents
  from (values
    ('FULL_TRAILER_0',  'Täysperävaunu- ja moduuliyhdistelmän kuljettaja, alle 4 v',   10),
    ('FULL_TRAILER_4',  'Täysperävaunu- ja moduuliyhdistelmän kuljettaja, 4–8 v',      11),
    ('FULL_TRAILER_8',  'Täysperävaunu- ja moduuliyhdistelmän kuljettaja, 8–12 v',     12),
    ('FULL_TRAILER_12', 'Täysperävaunu- ja moduuliyhdistelmän kuljettaja, yli 12 v',   13),
    ('SEMI_TRAILER_0',  'Puoliperävaununkuljettaja (C1E/CE), alle 4 v',                20),
    ('SEMI_TRAILER_4',  'Puoliperävaununkuljettaja (C1E/CE), 4–8 v',                   21),
    ('SEMI_TRAILER_8',  'Puoliperävaununkuljettaja (C1E/CE), 8–12 v',                  22),
    ('SEMI_TRAILER_12', 'Puoliperävaununkuljettaja (C1E/CE), yli 12 v',                23),
    ('TRUCK_0',         'Kuorma-autonkuljettaja (B/C1/C), alle 4 v',                   30),
    ('TRUCK_4',         'Kuorma-autonkuljettaja (B/C1/C), 4–8 v',                      31),
    ('TRUCK_8',         'Kuorma-autonkuljettaja (B/C1/C), 8–12 v',                     32),
    ('TRUCK_12',        'Kuorma-autonkuljettaja (B/C1/C), yli 12 v',                   33),
    ('VAN_0',           'Henkilö- ja pakettiautonkuljettaja (T/LT), alle 4 v',         40),
    ('VAN_4',           'Henkilö- ja pakettiautonkuljettaja (T/LT), 4–8 v',            41),
    ('VAN_8',           'Henkilö- ja pakettiautonkuljettaja (T/LT), 8–12 v',           42),
    ('VAN_12',          'Henkilö- ja pakettiautonkuljettaja (T/LT), yli 12 v',         43),
    ('HELPER_0',        'Autonapumies, alle 4 v',                                      50),
    ('HELPER_4',        'Autonapumies, 4–8 v',                                         51),
    ('HELPER_8',        'Autonapumies, 8–12 v',                                        52),
    ('HELPER_12',       'Autonapumies, yli 12 v',                                      53),
    ('INTL',            'Ulkomaanliikenne',                                            60),
    ('INTL_8',          'Ulkomaanliikenne, 8 % korotettuna',                           61)
  ) as g(grade, label, sort)
  join (values
    ('FULL_TRAILER_0',  date '2025-03-01', 1665), ('FULL_TRAILER_0',  date '2026-06-01', 1713), ('FULL_TRAILER_0',  date '2027-06-01', 1754),
    ('FULL_TRAILER_4',  date '2025-03-01', 1682), ('FULL_TRAILER_4',  date '2026-06-01', 1731), ('FULL_TRAILER_4',  date '2027-06-01', 1773),
    ('FULL_TRAILER_8',  date '2025-03-01', 1731), ('FULL_TRAILER_8',  date '2026-06-01', 1781), ('FULL_TRAILER_8',  date '2027-06-01', 1824),
    ('FULL_TRAILER_12', date '2025-03-01', 1766), ('FULL_TRAILER_12', date '2026-06-01', 1817), ('FULL_TRAILER_12', date '2027-06-01', 1861),
    ('SEMI_TRAILER_0',  date '2025-03-01', 1609), ('SEMI_TRAILER_0',  date '2026-06-01', 1656), ('SEMI_TRAILER_0',  date '2027-06-01', 1696),
    ('SEMI_TRAILER_4',  date '2025-03-01', 1626), ('SEMI_TRAILER_4',  date '2026-06-01', 1673), ('SEMI_TRAILER_4',  date '2027-06-01', 1713),
    ('SEMI_TRAILER_8',  date '2025-03-01', 1675), ('SEMI_TRAILER_8',  date '2026-06-01', 1724), ('SEMI_TRAILER_8',  date '2027-06-01', 1765),
    ('SEMI_TRAILER_12', date '2025-03-01', 1707), ('SEMI_TRAILER_12', date '2026-06-01', 1757), ('SEMI_TRAILER_12', date '2027-06-01', 1799),
    ('TRUCK_0',         date '2025-03-01', 1577), ('TRUCK_0',         date '2026-06-01', 1623), ('TRUCK_0',         date '2027-06-01', 1662),
    ('TRUCK_4',         date '2025-03-01', 1594), ('TRUCK_4',         date '2026-06-01', 1640), ('TRUCK_4',         date '2027-06-01', 1679),
    ('TRUCK_8',         date '2025-03-01', 1640), ('TRUCK_8',         date '2026-06-01', 1688), ('TRUCK_8',         date '2027-06-01', 1729),
    ('TRUCK_12',        date '2025-03-01', 1673), ('TRUCK_12',        date '2026-06-01', 1722), ('TRUCK_12',        date '2027-06-01', 1763),
    ('VAN_0',           date '2025-03-01', 1547), ('VAN_0',           date '2026-06-01', 1592), ('VAN_0',           date '2027-06-01', 1630),
    ('VAN_4',           date '2025-03-01', 1563), ('VAN_4',           date '2026-06-01', 1608), ('VAN_4',           date '2027-06-01', 1647),
    ('VAN_8',           date '2025-03-01', 1608), ('VAN_8',           date '2026-06-01', 1655), ('VAN_8',           date '2027-06-01', 1695),
    ('VAN_12',          date '2025-03-01', 1635), ('VAN_12',          date '2026-06-01', 1682), ('VAN_12',          date '2027-06-01', 1722),
    ('HELPER_0',        date '2025-03-01', 1533), ('HELPER_0',        date '2026-06-01', 1577), ('HELPER_0',        date '2027-06-01', 1615),
    ('HELPER_4',        date '2025-03-01', 1550), ('HELPER_4',        date '2026-06-01', 1595), ('HELPER_4',        date '2027-06-01', 1633),
    ('HELPER_8',        date '2025-03-01', 1593), ('HELPER_8',        date '2026-06-01', 1639), ('HELPER_8',        date '2027-06-01', 1678),
    ('HELPER_12',       date '2025-03-01', 1622), ('HELPER_12',       date '2026-06-01', 1669), ('HELPER_12',       date '2027-06-01', 1709),
    ('INTL',            date '2025-03-01', 1746), ('INTL',            date '2026-06-01', 1797), ('INTL',            date '2027-06-01', 1840),
    ('INTL_8',          date '2025-03-01', 1869), ('INTL_8',          date '2026-06-01', 1923), ('INTL_8',          date '2027-06-01', 1969)
  ) as r(grade, valid_from, cents) on r.grade = g.grade;
end;
$$;


-- ── Заработок водителя: смены с начала периода, ставки и категория ─

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
          select round(app.payout_cents(o.rate_cents, coalesce(o.commission_bps, 0)) * p.trip_bps / 10000.0)::integer
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
        'per_km_cents', p.per_km_cents,
        'hourly_cents', p.hourly_cents,
        'tes_grade', p.tes_grade,
        'tes', case when r.id is null then null else to_jsonb(r) - 'company_id' - 'created_by' end,
        'rates', coalesce((
          select jsonb_agg(jsonb_build_object('grade', w.grade, 'valid_from', w.valid_from, 'hourly_cents', w.hourly_cents))
          from public.tes_wage_rates w
          where w.rule_set_id = r.id and w.grade = p.tes_grade
        ), '[]'::jsonb)
      ) order by p.valid_from)
      from public.driver_pay_profiles p
      left join public.tes_rule_sets r on r.id = p.tes_rule_set_id
      where p.driver_id = v_driver
    ), '[]'::jsonb)
  );
end;
$$;
