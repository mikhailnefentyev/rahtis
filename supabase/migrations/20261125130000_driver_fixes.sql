-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · приложение водителя: правки после проверки кода (22.11.2026)
--
--   1. Push на языке водителя: driver_push_subscriptions.locale принимал
--      только fi и en, и водитель с языком телефона (app_language пуст)
--      получал уведомление по-фински. Теперь в подписке — любой язык
--      приложения (DRIVER_LOCALES в src/lib/i18n/driverLocale.ts).
--   2. Отметка, дошедшая позже суток, получала время доставки, а не
--      нажатия: «конец дня» в пятницу без связи, доставленный в
--      понедельник. Окно доверия времени телефона — 7 дней (в будущее —
--      по-прежнему не дальше 5 минут); то же у времени съёмки фото.
--   3. Заработок: рейс, закрытый около полуночи, у компании вне Финляндии
--      выпадал из месяца — база отбирала по дате Хельсинки, а приложение
--      раскладывает по поясу компании. Рейсы отдаются с запасом в сутки,
--      дата ставки — по поясу компании.
--   4. Заправка в леях: в списке валют driver_fuel_add не было RON.
--   5. Объект через полночь: рейс или «закончил» после полуночи искали
--      день по новой дате и отклонялись. Нет дня на эту дату — берётся
--      последний незаконченный день водителя на объекте за 24 часа.
--
-- Функции, которые раньше правились точечно (driver_site_action) или
-- меняются в одной строке (driver_register_photo), правятся так же, как в
-- 20261013210000 и 20261103020000: текст берётся из базы. Остальные —
-- целиком, от последнего определения.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Язык подписки на push ───────────────────────────────────────

alter table public.driver_push_subscriptions
  drop constraint driver_push_subscriptions_locale;

alter table public.driver_push_subscriptions
  add constraint driver_push_subscriptions_locale
  check (locale in ('fi', 'en', 'et', 'ru', 'sv', 'lv', 'lt', 'pl', 'nb', 'da', 'ro', 'de'));

comment on column public.driver_push_subscriptions.locale is
  'Язык приложения водителя в момент подписки (его выбор или язык телефона). На нём текст push, пока drivers.app_language пуст.';

/* Последнее определение — 20260922160000_driver_push; изменён только язык. */
create or replace function public.driver_push_subscribe(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_locale text default 'fi'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select app.current_driver_id());
begin
  if v_driver is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  insert into public.driver_push_subscriptions (driver_id, endpoint, p256dh, auth, locale)
  values (
    v_driver, p_endpoint, p_p256dh, p_auth,
    case
      when p_locale in ('fi', 'en', 'et', 'ru', 'sv', 'lv', 'lt', 'pl', 'nb', 'da', 'ro', 'de') then p_locale
      else 'fi'
    end
  )
  on conflict (endpoint) do update
    set driver_id = excluded.driver_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        locale = excluded.locale;
end;
$$;

revoke all on function public.driver_push_subscribe(text, text, text, text) from public, anon;
grant execute on function public.driver_push_subscribe(text, text, text, text) to authenticated;


-- ── 2. Время нажатия: окно доверия 7 дней ──────────────────────────

/*
 * Время нажатия с телефона, если ему можно верить, иначе — сейчас.
 * Было 24 часа: отметка из очереди, пролежавшая выходные без связи,
 * получала время доставки, и смена выходила длиннее суток. Из будущего
 * время не принимается (запас 5 минут — на неточные часы телефона).
 */
create or replace function app.client_time(p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_at between now() - interval '7 days' and now() + interval '5 minutes' then least(p_at, now())
    else now()
  end;
$$;

revoke all on function app.client_time(timestamptz) from public, anon, authenticated;

/* Время съёмки фото — то же окно (в функции оно записано своим условием). */
do $$
declare
  v_sig constant text := 'public.driver_register_photo(uuid, uuid, text, text, integer, public.photo_subject, text, boolean, boolean, text, timestamptz, double precision, double precision, text)';
  v_def text := replace(pg_get_functiondef(v_sig::regprocedure), E'\r\n', E'\n');
  v_mark constant text := $m$when p_captured_at between now() - interval '1 day' and now() + interval '5 minutes' then p_captured_at$m$;
  v_note constant text := 'Время съёмки не из будущего и не старше суток: иначе — время приёма.';
begin
  if (length(v_def) - length(replace(v_def, v_mark, ''))) / length(v_mark) <> 1 then
    raise exception 'driver_register_photo: место правки не найдено или встретилось не один раз';
  end if;

  v_def := replace(
    v_def,
    v_mark,
    $m$when p_captured_at between now() - interval '7 days' and now() + interval '5 minutes' then least(p_captured_at, now())$m$
  );
  v_def := replace(v_def, v_note, 'Время съёмки не из будущего и не старше 7 дней (как app.client_time): иначе — время приёма.');
  execute v_def;
end;
$$;


-- ── 3. Заработок: сутки рейса по поясу компании ────────────────────

/* Последнее определение — 20261106100100_pay_agreed_fields. */
create or replace function public.driver_earnings(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select app.current_driver_id());
  /* Пояс компании водителя: по нему приложение считает сутки рейса (22.11.2026). */
  v_zone text;
begin
  if v_driver is null then
    raise exception 'Заработок виден только водителю.' using errcode = '42501';
  end if;

  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'Период не больше двух месяцев.' using errcode = '22023';
  end if;

  select app.stop_timezone(c.country::text) into v_zone
  from public.drivers d
  join public.companies c on c.id = d.company_id
  where d.id = v_driver;
  v_zone := coalesce(v_zone, 'Europe/Helsinki');

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
                                       (o.closed_at at time zone v_zone)::date) * coalesce(p.trip_bps, p.bonus_trip_bps, 0) / 10000.0)::integer
          from public.driver_pay_profiles p
          where p.driver_id = v_driver
            and p.valid_from <= (o.closed_at at time zone v_zone)::date
          order by p.valid_from desc
          limit 1
        ), 0)
      ) order by o.closed_at)
      from public.orders o
      where o.assigned_driver_id = v_driver
        and o.status = 'DONE'
        /*
         * Запас в сутки с каждой стороны: приложение раскладывает рейсы по
         * поясу компании и дни вне месяца отбрасывает само (earnings.ts).
         */
        and (o.closed_at at time zone 'Europe/Helsinki')::date between p_from - 1 and p_to + 1
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

revoke all on function public.driver_earnings(date, date) from public, anon;
grant execute on function public.driver_earnings(date, date) to authenticated;


-- ── 4. Заправка в леях ─────────────────────────────────────────────

/* Последнее определение — 20261105100000_currency; в списке валют добавлен RON. */
create or replace function public.driver_fuel_add(
  p_data jsonb,
  p_at timestamptz default null,
  p_event_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers;
  v_vehicle uuid;
  v_at timestamptz := coalesce(app.client_time(p_at), clock_timestamp());
  v_line jsonb;
  v_first boolean := true;
  v_odometer integer;
  v_amount integer;
  v_receipt text := nullif(p_data ->> 'receipt_path', '');
  v_station text;
  v_full boolean;
  v_product text;
  v_qty numeric;
  v_match uuid;
  v_currency text;
begin
  select * into v_driver from public.drivers where id = (select app.current_driver_id());
  if v_driver.id is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  if app.driver_event_seen(p_event_id, 'FUEL', p_at) then
    return;
  end if;

  /* Числа — после проверки повтора: повтор с кривыми полями не должен падать вместо «уже было». */
  v_odometer := nullif(p_data ->> 'odometer_km', '')::numeric::integer;
  v_amount := round(nullif(p_data ->> 'amount', '')::numeric * 100)::integer;
  v_station := nullif(left(btrim(coalesce(p_data ->> 'station', '')), 120), '');
  v_full := coalesce((p_data ->> 'full_tank')::boolean, true);
  /*
   * Валюта чека: заправка за границей — в местной валюте; не выбрана — валюта компании.
   * Лей (RON) добавлен 22.11.2026: экран его предлагал, а чек записывался в валюте компании.
   */
  v_currency := coalesce(nullif(upper(p_data ->> 'currency'), ''), app.company_currency(v_driver.company_id));
  if v_currency not in ('EUR', 'SEK', 'NOK', 'DKK', 'PLN', 'RON') then
    v_currency := app.company_currency(v_driver.company_id);
  end if;

  select vehicle_id into v_vehicle from public.vehicle_drivers
  where driver_id = v_driver.id and upper_inf(during);
  if v_vehicle is null then
    raise exception 'Водитель не закреплён за машиной.' using errcode = '55000';
  end if;

  if jsonb_typeof(p_data -> 'lines') <> 'array' or jsonb_array_length(p_data -> 'lines') not between 1 and 4 then
    raise exception 'Нет строк заправки.' using errcode = '22023';
  end if;

  /* Фото чека — только из папки своей компании: путь собирает сервер, но верить ему на слово незачем. */
  if v_receipt is not null
     and v_receipt !~ ('^' || v_driver.company_id::text || '/receipts/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    v_receipt := null;
  end if;

  for v_line in select * from jsonb_array_elements(p_data -> 'lines') loop
    v_product := v_line ->> 'product';
    v_qty := (v_line ->> 'quantity')::numeric;
    v_match := app.fuel_match(v_vehicle, v_product, v_at, v_qty, 'DRIVER');

    if v_match is not null then
      /* Отчёт или спутник уже есть: водитель добавляет свой объём, одометр, полный бак и чек; сумма отчёта главнее. */
      update public.fuel_entries
      set qty_driver = v_qty,
          quantity = coalesce(qty_report, v_qty),
          driver_id = v_driver.id,
          event_id = coalesce(event_id, p_event_id),
          odometer_km = coalesce(v_odometer, odometer_km),
          full_tank = v_full,
          currency = case when amount_cents is null and v_first and v_amount is not null then v_currency::public.currency_code else currency end,
          amount_cents = coalesce(amount_cents, case when v_first then v_amount end),
          station = coalesce(station, v_station),
          receipt_path = coalesce(receipt_path, case when v_first then v_receipt end),
          /* Время спутника точнее всех, водителя — точнее отчёта (там его часто нет). */
          filled_at = case when qty_telematics is null then v_at else filled_at end
      where id = v_match;
    else
      insert into public.fuel_entries (
        company_id, vehicle_id, driver_id, filled_at, product, quantity, qty_driver, amount_cents, odometer_km,
        full_tank, station, source, receipt_path, event_id, currency)
      values (
        v_driver.company_id, v_vehicle, v_driver.id, v_at, v_product, v_qty, v_qty,
        case when v_first then v_amount end,
        v_odometer, v_full, v_station, 'DRIVER',
        case when v_first then v_receipt end,
        p_event_id,
        v_currency::public.currency_code
      );
    end if;
    v_first := false;
  end loop;
end;
$$;

revoke all on function public.driver_fuel_add(jsonb, timestamptz, uuid) from public, anon;
grant execute on function public.driver_fuel_add(jsonb, timestamptz, uuid) to authenticated;


-- ── 5. Объект через полночь ────────────────────────────────────────

/*
 * День объекта ищется по дате нажатия. Приехал в 22:00, взвесил рейс в
 * 00:30 — дня на новую дату нет, и рейс отклонялся («сначала отметьте
 * прибытие»), а «закончил» после полуночи не закрывал день. Теперь для
 * рейса и конца дня: нет дня на эту дату — берётся последний
 * незаконченный день этого водителя на объекте, начатый не раньше чем
 * за 24 часа до нажатия. Прибытие по-прежнему заводит день своей даты.
 */
do $$
declare
  v_sig constant text := 'public.driver_site_action(text, uuid, jsonb, timestamptz, uuid)';
  v_def text := replace(pg_get_functiondef(v_sig::regprocedure), E'\r\n', E'\n');
  v_mark constant text := E'  if v_day.id is null then\n    raise exception ''Сначала отметьте прибытие на объект.''';
begin
  if (length(v_def) - length(replace(v_def, v_mark, ''))) / length(v_mark) <> 1 then
    raise exception 'driver_site_action: место правки не найдено или встретилось не один раз';
  end if;

  v_def := replace(
    v_def,
    v_mark,
    E'  /* Работа через полночь: день начат вчера и ещё не закончен (22.11.2026). */\n'
    || E'  if v_day.id is null then\n'
    || E'    select * into v_day from public.site_days\n'
    || E'    where job_id = v_job.id and driver_id = v_driver.id\n'
    || E'      and ended_at is null\n'
    || E'      and arrived_at <= v_at\n'
    || E'      and arrived_at > v_at - interval ''24 hours''\n'
    || E'    order by arrived_at desc\n'
    || E'    limit 1\n'
    || E'    for update;\n'
    || E'  end if;\n\n'
    || v_mark
  );
  execute v_def;
end;
$$;
