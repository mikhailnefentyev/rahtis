-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассрочка техники открыта в Эстонии и Латвии (23.11.2026)
--
--   · Раздел открыт компаниям Финляндии, Эстонии и Латвии. Для двух новых
--     стран готовы правила о просрочке, договор на языке страны, тексты
--     счетов и кабинета (src/lib/installments: rules.ts, contractText/,
--     invoiceTexts.ts, countryTexts/). Сделка по-прежнему только внутри
--     одной страны.
--   · Обычная ставка НДС страны — в одной функции
--     app.country_vat_standard_bps: до этого список ставок стоял внутри
--     save_equipment_listing. Числа те же; с пакетами стран в коде
--     (COUNTRY_PACKS, vatStandardBps) их сверяет тест countryOpen.test.mjs.
--   · Год в номере договора и «дата передачи ещё не прошла» при согласии —
--     по часовому поясу страны продавца (app.stop_timezone), а не всегда по
--     Хельсинки. Для Таллина и Риги время то же, что в Хельсинки; разница
--     появится у стран с другим поясом.
--   · Правило Латвии «два пропущенных срока платежа» и договорные пороги
--     Эстонии считаются в коде (rules.ts) по строкам installment_payments;
--     в базе для них ничего не нужно: она порогов не знает и машин не
--     изымает.
-- ═══════════════════════════════════════════════════════════════════

-- ── Открытые страны ─────────────────────────────────────────────────

/*
 * Открыт ли раздел рассрочки компаниям этой страны.
 *
 * СПИСОК ПОВТОРЯЕТ РЕЕСТР В КОДЕ: src/lib/installments/countries.ts
 * (страны с open: true). Открываешь страну — новой миграцией переопредели
 * эту функцию и поправь реестр; расхождение ловит тест
 * src/lib/installments/countries.test.mjs.
 *
 * 23.11.2026: добавлены Эстония и Латвия.
 */
create or replace function app.installment_country_open(p_country text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select upper(coalesce(p_country, '')) in ('FI', 'EE', 'LV')
$$;

revoke all on function app.installment_country_open(text) from public, anon, authenticated;

-- ── Ставка НДС страны ───────────────────────────────────────────────

/*
 * Обычная ставка НДС страны платформы, базисные пункты; null — страна не
 * из пакетов. Повторяет vatStandardBps в src/lib/country/index.ts
 * (COUNTRY_PACKS): меняется ставка страны — меняй в обоих местах,
 * расхождение ловит тест src/lib/installments/countryOpen.test.mjs.
 */
create or replace function app.country_vat_standard_bps(p_country text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case upper(coalesce(p_country, ''))
    when 'FI' then 2550
    when 'SE' then 2500
    when 'NO' then 2500
    when 'DK' then 2500
    when 'EE' then 2400
    when 'LV' then 2100
    when 'LT' then 2100
    when 'PL' then 2300
    when 'DE' then 1900
    when 'RO' then 2100
  end
$$;

revoke all on function app.country_vat_standard_bps(text) from public, anon, authenticated;

-- ── Объявление: ставка НДС страны продавца ──────────────────────────

/*
 * Объявление продавца — как в 20261127100000, кроме одного: ставка НДС
 * берётся из app.country_vat_standard_bps, а не из списка внутри функции.
 * Продавец — главный в проверенной компании открытой страны.
 */
create or replace function public.save_equipment_listing(
  p_id uuid,
  p_vehicle_id uuid,
  p_price_cents bigint,
  p_vat_mode text,
  p_down_payment_cents bigint,
  p_months integer,
  p_final_cents bigint,
  p_annual_rate_bps integer,
  p_odometer_km integer,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_seller();
  v_carrier boolean;
  v_vehicle uuid;
  v_sale_vehicle uuid;
  v_vat_bps integer;
  v_id uuid;
begin
  if p_vat_mode is distinct from 'STANDARD' then
    raise exception 'Продажа в рассрочку — только с обычным НДС.' using errcode = '22023';
  end if;
  select c.kind = 'CARRIER' into v_carrier from public.companies c where c.id = v_me;
  if v_carrier then
    if not exists (select 1 from public.vehicles v where v.id = p_vehicle_id and v.company_id = v_me and v.access = 'APPROVED') then
      raise exception 'Машина не из вашего парка или не одобрена.' using errcode = '42501';
    end if;
    v_vehicle := p_vehicle_id;
  else
    if not app.sale_vehicle_sellable(p_vehicle_id, v_me) then
      raise exception 'Машина на продажу не ваша, не одобрена оператором или уже продана.' using errcode = '42501';
    end if;
    v_sale_vehicle := p_vehicle_id;
  end if;
  /* Машину и пробег нельзя менять, пока идут переговоры: покупатель видел другое. */
  if p_id is not null and exists (
    select 1 from public.equipment_listings l
    where l.id = p_id
      and (l.vehicle_id is distinct from v_vehicle or l.sale_vehicle_id is distinct from v_sale_vehicle
           or l.odometer_km is distinct from p_odometer_km)
      and exists (select 1 from public.installment_deals d where d.listing_id = l.id and d.status = 'NEGOTIATING')
  ) then
    raise exception 'По объявлению идут переговоры — машину и пробег не изменить.' using errcode = '55000';
  end if;
  /* НДС — обычная ставка страны регистрации продавца, из одного места (app.country_vat_standard_bps). */
  select app.country_vat_standard_bps(c.country::text) into v_vat_bps from public.companies c where c.id = v_me;
  if v_vat_bps is null then
    raise exception 'Страна продавца не поддерживается.' using errcode = '22023';
  end if;
  perform app.installment_terms_ok(p_price_cents, p_vat_mode, v_vat_bps, p_down_payment_cents, p_months, p_final_cents, p_annual_rate_bps);

  if p_id is null then
    insert into public.equipment_listings (
      seller_company_id, vehicle_id, sale_vehicle_id, price_cents, vat_mode, vat_bps, down_payment_cents, months,
      final_cents, annual_rate_bps, odometer_km, description
    )
    values (
      v_me, v_vehicle, v_sale_vehicle, p_price_cents, p_vat_mode, v_vat_bps, p_down_payment_cents, p_months,
      p_final_cents, p_annual_rate_bps, p_odometer_km, coalesce(p_description, '')
    )
    returning id into v_id;
  else
    update public.equipment_listings
    set vehicle_id = v_vehicle, sale_vehicle_id = v_sale_vehicle, price_cents = p_price_cents, vat_mode = p_vat_mode,
        vat_bps = v_vat_bps, down_payment_cents = p_down_payment_cents, months = p_months, final_cents = p_final_cents,
        annual_rate_bps = p_annual_rate_bps, odometer_km = p_odometer_km,
        description = coalesce(p_description, ''), updated_at = now()
    where id = p_id and seller_company_id = v_me and status in ('DRAFT', 'PUBLISHED')
    returning id into v_id;
    if v_id is null then
      raise exception 'Объявление нельзя изменить.' using errcode = '55000';
    end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.save_equipment_listing(uuid, uuid, bigint, text, bigint, integer, bigint, integer, integer, text) from public, anon;
grant execute on function public.save_equipment_listing(uuid, uuid, bigint, text, bigint, integer, bigint, integer, integer, text) to authenticated;

-- ── Согласие: год договора и «сегодня» по времени страны ────────────

/*
 * Принять условия другой стороны — как в 20261128100000, кроме времени:
 * «дата передачи ещё не прошла» и год в номере договора считаются по
 * часовому поясу страны продавца (23.11.2026). Номер по-прежнему из одной
 * последовательности и с приставкой OS- во всех странах: это номер в
 * RAHTIS, а не название договора.
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
  select app.stop_timezone(c.country::text) into v_zone from public.companies c where c.id = v_deal.seller_company_id;
  v_zone := coalesce(v_zone, 'Europe/Helsinki');
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
