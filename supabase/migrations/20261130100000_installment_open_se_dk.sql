-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассрочка техники открыта в Швеции и Дании (23.11.2026)
--
--   · Раздел открыт компаниям Финляндии, Эстонии, Латвии, Швеции и Дании.
--     Для двух новых стран готовы правила о просрочке, договор на языке
--     страны, тексты счетов и кабинета (src/lib/installments: rules.ts,
--     contractText/se.ts и dk.ts, invoiceTexts.ts, countryTexts/). Сделка
--     по-прежнему только внутри одной страны.
--   · Валюта объявления и сделки — кроны страны продавца: её уже ставят
--     триггеры equipment_listing_currency и installment_deal_currency
--     (20261128100000) через app.country_currency — здесь ничего не нужно.
--     Ставка НДС 25 % у обеих стран уже есть в app.country_vat_standard_bps
--     (20261129100000). Год договора и «сегодня» при согласии — по поясу
--     страны продавца через app.stop_timezone (Стокгольм, Копенгаген).
--   · Швеция: проценты не предлагаются. Как проценты рассрочки облагаются
--     НДС, не выяснено (источники Skatteverket расходятся,
--     docs/equipment-sale/countries/se.md, открытый вопрос 1), и до ответа
--     бухгалтера ставка может быть только 0. Форма её не даёт изменить,
--     сервер не принимает, а здесь — проверка в базе: объявление и сделка
--     шведского продавца с процентами не сохраняются.
--   · Пороги просрочки Швеции (больше 14 дней и больше 1/10 или 1/20
--     kreditfordran) и Дании (30 дней и не меньше 1/10 или 1/20 всей суммы к
--     уплате) считаются в коде (rules.ts) по строкам installment_payments;
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
 * 23.11.2026: добавлены Швеция и Дания (до этого — Финляндия, Эстония, Латвия).
 */
create or replace function app.installment_country_open(p_country text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select upper(coalesce(p_country, '')) in ('FI', 'EE', 'LV', 'SE', 'DK')
$$;

revoke all on function app.installment_country_open(text) from public, anon, authenticated;

-- ── Проценты: где они не предлагаются ───────────────────────────────

/*
 * Можно ли в стране продавца назначать проценты на остаток цены.
 *
 * СПИСОК ПОВТОРЯЕТ РЕЕСТР В КОДЕ: src/lib/installments/countries.ts
 * (страны с interestOffered: false). Расхождение ловит тест
 * src/lib/installments/countryOpen.test.mjs.
 *
 * 23.11.2026: нельзя только в Швеции — до ответа бухгалтера о НДС на
 * проценты. Неизвестная страна — можно: открыта ли страна, проверяется
 * отдельно (app.installment_country_open).
 */
create or replace function app.installment_interest_allowed(p_country text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select upper(coalesce(p_country, '')) not in ('SE')
$$;

revoke all on function app.installment_interest_allowed(text) from public, anon, authenticated;

/*
 * Объявление и сделка: ставка процентов больше нуля — только там, где
 * проценты предлагаются. Одна функция на обе таблицы: у обеих есть
 * seller_company_id и annual_rate_bps. Триггером, а не правкой функций
 * сохранения: условия пишут три функции (объявление, первое предложение,
 * встречное предложение), и правило должно действовать на любую запись.
 */
create or replace function app.installment_interest_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.annual_rate_bps <> 0 and not app.installment_interest_allowed(
       (select c.country::text from public.companies c where c.id = new.seller_company_id)
     ) then
    raise exception 'В стране продавца проценты по рассрочке не предлагаются: ставка должна быть 0.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function app.installment_interest_guard() from public, anon, authenticated;

drop trigger if exists equipment_listing_interest on public.equipment_listings;
create trigger equipment_listing_interest
  before insert or update of annual_rate_bps, seller_company_id on public.equipment_listings
  for each row execute function app.installment_interest_guard();

drop trigger if exists installment_deal_interest on public.installment_deals;
create trigger installment_deal_interest
  before insert or update of annual_rate_bps, seller_company_id on public.installment_deals
  for each row execute function app.installment_interest_guard();
