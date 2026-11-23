-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассрочка техники открыта в Польше и Румынии (23.11.2026)
--
--   · Раздел открыт компаниям Финляндии, Эстонии, Латвии, Швеции, Дании,
--     Литвы, Германии, Польши и Румынии (Норвегия по-прежнему закрыта). Для
--     двух новых стран готовы правила о просрочке, договор на языке страны,
--     тексты документов и кабинета (src/lib/installments: rules.ts,
--     contractText/pl.ts и ro.ts, invoiceTexts.ts, countryTexts/pl.ts и
--     ro.ts). Сделка по-прежнему только внутри одной страны.
--   · Валюта (PLN, RON — app.country_currency), ставки НДС 23 % и 21 %
--     (app.country_vat_standard_bps) и пояса Варшавы и Бухареста
--     (app.stop_timezone) уже есть — здесь для них ничего не нужно.
--   · Счета. В Польше счёт между компаниями — только faktura ustrukturyzowana
--     в KSeF (обязателен для всех с 01.04.2026), в Румынии — только XML через
--     RO e-Factura (PDF вне системы не счёт, штраф 15 % обеим сторонам).
--     RAHTIS к этим системам не подключён: в этих странах он не выставляет
--     счетов вообще, только платёжные уведомления со своей нумерацией (серию
--     счетов продавца они не занимают), а каждый счёт продавец выставляет в
--     системе сам (app.installment_seller_invoices).
--   · Передача. Раньше её ждали «оплаченного первого счёта», а отметить
--     оплату можно было только при выставленном счёте платформы
--     (first_invoice_id). В Польше и Румынии первый документ платформы — лишь
--     уведомление, и его может не быть (например, у продавца ещё нет IBAN),
--     а платёж до передачи продавец документирует своим счётом в системе.
--     Поэтому здесь продавец подтверждает, что платёж до передачи получен,
--     и без документа платформы (mark_installment_first_paid). Отметка
--     пишется в тот же столбец first_invoice_paid_at, и правило передачи
--     (confirm_installment_handover: «first_invoice_paid_at не пусто») не
--     меняется. Чтобы правила оставались согласованными, отменить сделку
--     одной кнопкой после такого подтверждения может только продавец
--     (cancel_installment_deal): деньги уже у него, возврат и корректировка
--     счёта в системе — его дело. У остальных стран first_invoice_paid_at без
--     first_invoice_id не бывает, и для них ничего не меняется.
--   · Справка о передаче (Польша, Румыния) — тоже уведомление, не счёт; она
--     лежит в прежнем столбце vat_invoice_id (у Литвы там счёт с НДС).
--   · Проценты в Польше: по договору не выше odsetki maksymalne —
--     2 × (ставка NBP + 3,5 п.п.) годовых (KC art. 359 § 2¹). Ставку NBP база
--     не отслеживает и в коде она не зашита: допускается не больше 7 %
--     (2 × 3,5) — ниже этого предел не опустится, пока ставка NBP не
--     отрицательна (app.installment_max_rate_bps). У остальных стран — прежний
--     предел 50 %. Румыния: проценты разрешены (освобождённый кредит).
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
 * 23.11.2026: добавлены Польша и Румыния (до этого — Финляндия, Эстония,
 * Латвия, Швеция, Дания, Литва и Германия).
 */
create or replace function app.installment_country_open(p_country text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select upper(coalesce(p_country, '')) in ('FI', 'EE', 'LV', 'SE', 'DK', 'LT', 'DE', 'PL', 'RO')
$$;

revoke all on function app.installment_country_open(text) from public, anon, authenticated;

-- ── Счета только у продавца в государственной системе ──────────────

/*
 * Выставляет ли продавец все счета сам в государственной системе (KSeF,
 * RO e-Factura), а платформа — только платёжные уведомления.
 *
 * СПИСОК ПОВТОРЯЕТ РЕЕСТР В КОДЕ: src/lib/installments/countries.ts
 * (sellerInvoices: true). Расхождение ловит тест countryOpen.test.mjs.
 */
create or replace function app.installment_seller_invoices(p_country text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select upper(coalesce(p_country, '')) in ('PL', 'RO')
$$;

revoke all on function app.installment_seller_invoices(text) from public, anon, authenticated;

-- ── Платёж до передачи получен ──────────────────────────────────────

/*
 * Продавец отмечает, что первый платёж получен. Как в 20261125110000; для
 * страны, где счета выставляет только продавец (Польша, Румыния), — и без
 * документа платформы: продавец подтверждает получение платежа до передачи,
 * который сам документирует счётом в KSeF / RO e-Factura. Если уведомление
 * платформы есть, оно помечается оплаченным, как счёт у других стран.
 */
create or replace function public.mark_installment_first_paid(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
  v_deal public.installment_deals;
  v_country text;
begin
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_deal.seller_company_id <> v_me then
    raise exception 'Оплату отмечает продавец.' using errcode = '42501';
  end if;
  select c.country::text into v_country from public.companies c where c.id = v_deal.seller_company_id;
  if v_deal.status <> 'AGREED'
     or (v_deal.first_invoice_id is null and not app.installment_seller_invoices(v_country)) then
    raise exception 'Нет выставленного первого счёта.' using errcode = '55000';
  end if;
  update public.installment_deals set first_invoice_paid_at = coalesce(first_invoice_paid_at, now()) where id = p_deal_id;
  /* paid_at у документа — дата: день по Хельсинки, а не по UTC (22.11.2026). Документа нет — нечего помечать. */
  if v_deal.first_invoice_id is not null then
    update public.carrier_invoices set paid_at = coalesce(paid_at, app.helsinki_today()) where id = v_deal.first_invoice_id;
  end if;
end;
$$;

revoke all on function public.mark_installment_first_paid(uuid) from public, anon;
grant execute on function public.mark_installment_first_paid(uuid) to authenticated;

comment on column public.installment_deals.first_invoice_paid_at is
  'Продавец подтвердил, что платёж до передачи получен (у Польши и Румынии — и без документа платформы: счёт продавец выставляет в KSeF / RO e-Factura сам). Передача ждёт этой отметки.';

comment on column public.installment_deals.vat_invoice_id is
  'Документ в день передачи: у Литвы — счёт с НДС на всю цену (PVMĮ 14 str. 5 d.); у Польши и Румынии — справка о передаче (не счёт, счёт продавец выставляет в KSeF / RO e-Factura).';

-- ── Отмена до первого документа ─────────────────────────────────────

/*
 * Как в 20261127100000. Добавлено (23.11.2026): если продавец уже
 * подтвердил получение платежа до передачи без документа платформы (Польша,
 * Румыния), отменить сделку одной кнопкой может только он — деньги у него,
 * возврат и корректировку счёта в KSeF / RO e-Factura делает он сам.
 */
create or replace function public.cancel_installment_deal(p_deal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
  v_deal public.installment_deals;
begin
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_me not in (v_deal.seller_company_id, v_deal.buyer_company_id) then
    raise exception 'Нет сделки.' using errcode = '42501';
  end if;
  if not app.installment_side_ok(v_me, v_deal.seller_company_id) then
    raise exception 'Продаёт проверенная компания из Финляндии, покупает действующий перевозчик с выпиской из реестра и страховкой.' using errcode = '42501';
  end if;
  if v_deal.status = 'CANCELLED' then
    return false;
  end if;
  /* Счёт уже выставлен — отмена только с кредит-нотой (этап 3), не одной кнопкой. */
  if v_deal.first_invoice_id is not null then
    raise exception 'Первый счёт уже выставлен — отмена через кредит-ноту.' using errcode = '55000';
  end if;
  /* Платёж до передачи подтверждён продавцом без документа платформы — отменяет только продавец. */
  if v_deal.first_invoice_paid_at is not null and v_me <> v_deal.seller_company_id then
    raise exception 'Продавец подтвердил получение платежа — отмену оформляет продавец.' using errcode = '42501';
  end if;

  update public.installment_deals
  set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_me
  where id = p_deal_id;

  if v_deal.status = 'AGREED' then
    update public.equipment_listings set status = 'PUBLISHED', updated_at = now()
    where id = v_deal.listing_id and status = 'RESERVED';
  end if;
  return true;
end;
$$;

revoke all on function public.cancel_installment_deal(uuid) from public, anon;
grant execute on function public.cancel_installment_deal(uuid) to authenticated;

-- ── Проценты: предел ставки по стране ───────────────────────────────

/*
 * Наибольшая ставка процентов в стране продавца, б. п.
 *
 * ТО ЖЕ ПРАВИЛО В КОДЕ: src/lib/installments/countries.ts
 * (installmentMaxRateBps, maxRateBps). Расхождение ловит тест
 * countryOpen.test.mjs.
 *
 * 23.11.2026: Польша — 700 (odsetki maksymalne не ниже 2 × 3,5 % при
 * неотрицательной ставке NBP); остальные — общий предел калькулятора 50 %.
 */
create or replace function app.installment_max_rate_bps(p_country text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when upper(coalesce(p_country, '')) = 'PL' then 700 else 5000 end
$$;

revoke all on function app.installment_max_rate_bps(text) from public, anon, authenticated;

/*
 * Объявление и сделка: ставка больше нуля — только там, где проценты
 * предлагаются (как в 20261130100000), и не выше предела страны (Польша,
 * 23.11.2026). Триггеры на обеих таблицах уже стоят и не меняются.
 */
create or replace function app.installment_interest_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country text := (select c.country::text from public.companies c where c.id = new.seller_company_id);
begin
  if new.annual_rate_bps <> 0 and not app.installment_interest_allowed(v_country) then
    raise exception 'В стране продавца проценты по рассрочке не предлагаются: ставка должна быть 0.' using errcode = '22023';
  end if;
  if new.annual_rate_bps > app.installment_max_rate_bps(v_country) then
    raise exception 'Ставка выше предела страны продавца.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function app.installment_interest_guard() from public, anon, authenticated;
