-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · договорённость с водителем: поля и проверки (6.11.2026)
--
-- Исследование docs/pay/research-real-practice.md: с водителем
-- договариваются о сумме «на руки» — за день (все дни в рейсе, только
-- рабочие или только за границей; дома своя ставка; ставки по странам),
-- за месяц, за рейс. Калькулятор считает, сколько причитается по
-- договорённости, и законную схему, которая её выдаёт (оклад + суточные
-- в пределах нормы + облагаемый разрыв). Как прятать часть зарплаты —
-- не храним и не считаем.
-- ═══════════════════════════════════════════════════════════════════

alter table public.driver_pay_profiles
  add column agreed_day_cents integer,
  add column agreed_day_basis text,
  add column agreed_home_day_cents integer,
  add column agreed_country_day_cents jsonb,
  add column agreed_monthly_cents integer,
  add column agreed_trip_cents integer,
  add column third_country_driver boolean not null default false,
  add constraint driver_pay_profiles_agreed_basis check (agreed_day_basis is null or agreed_day_basis in ('ROUTE', 'WORK', 'ABROAD')),
  add constraint driver_pay_profiles_agreed_amounts check (
    (agreed_day_cents is null or agreed_day_cents between 1 and 1000000)
    and (agreed_home_day_cents is null or agreed_home_day_cents between 0 and 1000000)
    and (agreed_monthly_cents is null or agreed_monthly_cents between 1 and 100000000)
    and (agreed_trip_cents is null or agreed_trip_cents between 1 and 10000000)
    and (agreed_country_day_cents is null or jsonb_typeof(agreed_country_day_cents) = 'object')
  );

comment on column public.driver_pay_profiles.agreed_day_cents is
  'Договорённость «на руки» за день (модель DAY_NET). Справочно: законная схема и разрыв — в отчёте.';
comment on column public.driver_pay_profiles.third_country_driver is
  'Водитель из третьей страны: проверка порога зарплаты для разрешения (LT 2 893 €, LV 1 637 €).';

alter table public.driver_pay_profiles
  drop constraint driver_pay_profiles_fields,
  add constraint driver_pay_profiles_fields check (
    coalesce(
      case model
        when 'PER_KM' then per_km_cents between 1 and 100000
        when 'TRIP_PERCENT' then trip_bps between 1 and 10000
        when 'FLAT_HOURLY' then hourly_cents between 1 and 100000
        when 'TES' then tes_rule_set_id is not null
        when 'DAY_NET' then agreed_day_cents is not null or agreed_country_day_cents is not null
        when 'MONTHLY_NET' then agreed_monthly_cents is not null
        when 'PER_TRIP' then agreed_trip_cents is not null
      end,
      false
    )
  );


-- ── Приложение водителя: договорённость в профиле ──────────────────

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
        'agreed_day_cents', p.agreed_day_cents,
        'agreed_day_basis', p.agreed_day_basis,
        'agreed_home_day_cents', p.agreed_home_day_cents,
        'agreed_country_day_cents', p.agreed_country_day_cents,
        'agreed_monthly_cents', p.agreed_monthly_cents,
        'agreed_trip_cents', p.agreed_trip_cents,
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
