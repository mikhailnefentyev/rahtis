-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассрочка техники открыта в Литве и Германии (23.11.2026)
--
--   · Раздел открыт компаниям Финляндии, Эстонии, Латвии, Швеции, Дании,
--     Литвы и Германии. Для двух новых стран готовы правила о просрочке,
--     договор на языке страны, тексты документов и кабинета
--     (src/lib/installments: rules.ts, contractText/lt.ts и de.ts,
--     invoiceTexts.ts, countryTexts/lt.ts и de.ts). Сделка по-прежнему только
--     внутри одной страны.
--   · Валюта — евро (app.country_currency), ставки НДС 21 % и 19 % уже есть
--     в app.country_vat_standard_bps (20261129100000), пояса Вильнюса и
--     Берлина — в app.stop_timezone. Здесь для них ничего не нужно.
--   · Проценты в обеих странах предлагаются (app.installment_interest_allowed
--     не меняется): в Литве как освобождённый кредит (PVMĮ 28 str. 1 d.), в
--     Германии — только отдельным соглашением с годовой ставкой (договор
--     п. 4.4, § 4 Nr. 8 Buchst. a UStG). Что это не подтверждено налоговыми
--     органами, сторонам сказано в кабинете.
--   · Литва: НДС со всей цены возникает при передаче машины, а аванс до неё
--     не облагается (PVMĮ 14 str. 4–5 d.). Поэтому до передачи выставляется
--     предварительный счёт (išankstinio mokėjimo sąskaita) — он, как и
--     раньше, лежит в first_invoice_id, и передача по-прежнему ждёт его
--     оплаты. Счёт с НДС на всю цену (PVM sąskaita faktūra) сервер выставляет
--     в день передачи и записывает в новый столбец vat_invoice_id; бронь от
--     двойного выставления — vat_invoice_started_at, как у кредит-ноты.
--   · Пороги просрочки Литвы (больше 30 дней и не меньше 1/10 или 1/20 цены
--     с НДС) и Германии (два взноса подряд и 10 % или 5 % цены с НДС) —
--     договорные и считаются в коде (rules.ts) по строкам
--     installment_payments; база порогов не знает и машин не изымает.
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
 * 23.11.2026: добавлены Литва и Германия (до этого — Финляндия, Эстония,
 * Латвия, Швеция и Дания).
 */
create or replace function app.installment_country_open(p_country text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select upper(coalesce(p_country, '')) in ('FI', 'EE', 'LV', 'SE', 'DK', 'LT', 'DE')
$$;

revoke all on function app.installment_country_open(text) from public, anon, authenticated;

-- ── Литва: счёт с НДС при передаче ──────────────────────────────────

/*
 * vat_invoice_id — счёт с НДС на всю цену, выставленный в день передачи
 * (пока только Литва). Пишет только сервер (секретный ключ); стороны видят
 * столбец вместе со сделкой по прежней политике installment_deals_parties.
 * vat_invoice_started_at — бронь на время выставления: параллельный запуск
 * не выставит второй счёт; бронь старше 10 минут считается сорвавшейся.
 */
alter table public.installment_deals
  add column if not exists vat_invoice_id uuid references public.carrier_invoices (id) on delete set null,
  add column if not exists vat_invoice_started_at timestamptz;

comment on column public.installment_deals.vat_invoice_id is
  'Счёт с НДС на всю цену, выставленный в день передачи (Литва, PVMĮ 14 str. 5 d.). До передачи — предварительный счёт в first_invoice_id.';
comment on column public.installment_deals.vat_invoice_started_at is
  'Бронь выставления счёта с НДС при передаче: старше 10 минут — сорвавшаяся.';
