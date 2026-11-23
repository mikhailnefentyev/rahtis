import 'server-only';

import { createFormat } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { buildSchedule, type VatMode } from './calc';
import { installmentCurrency, installmentDay } from './countries';
import { installmentRules } from './rules';
import type { ContractPdfInput } from './ContractPdf';

/**
 * Сделка для своей стороны (22.11.2026). Доступ проверяет база: сделку
 * видят только продавец и покупатель (политика installment_deals_parties);
 * остальное — карточки компаний, объявление и машина — читается с правами
 * сервера уже после этой проверки.
 */
export async function loadDeal(dealId: string) {
  const supabase = await createClient();
  const { data: deal } = await supabase.from('installment_deals').select('*').eq('id', dealId).maybeSingle();
  if (!deal) return null;

  const admin = createAdminClient();
  /* kind — вид компании: страница сделки подбирает тексты для продавца без парка (23.11.2026). */
  const companyCols = 'id, name, kind, legal_name, business_id, vat_number, legal_street, legal_postal_code, legal_city, contact_email, billing_email, country, iban';
  const [{ data: listing }, { data: seller }, { data: buyer }, { data: invoice }] = await Promise.all([
    admin.from('equipment_listings').select('*').eq('id', deal.listing_id).maybeSingle(),
    admin.from('companies').select(companyCols).eq('id', deal.seller_company_id).maybeSingle(),
    admin.from('companies').select(companyCols).eq('id', deal.buyer_company_id).maybeSingle(),
    deal.first_invoice_id
      ? admin.from('carrier_invoices').select('id, number, file_path, total_cents, due_on').eq('id', deal.first_invoice_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!listing || !seller || !buyer) return null;
  /*
   * Машина — из парка продавца или, у продавца без парка, из его карточки
   * на продажу (23.11.2026): у объявления ровно одна из двух ссылок.
   */
  const vehicleCols = 'id, make, plate, vehicle_class, euro_class, axles';
  const { data: vehicle } = listing.vehicle_id
    ? await admin.from('vehicles').select(vehicleCols).eq('id', listing.vehicle_id).maybeSingle()
    : listing.sale_vehicle_id
      ? await admin.from('equipment_sale_vehicles').select(vehicleCols).eq('id', listing.sale_vehicle_id).maybeSingle()
      : { data: null };
  if (!vehicle) return null;
  return { deal, listing, seller, buyer, vehicle, invoice };
}

export type LoadedDeal = NonNullable<Awaited<ReturnType<typeof loadDeal>>>;

/**
 * Прекращение сделки в рассрочке (22.11.2026, миграция 20261126100000):
 * когда, почему и пояснение продавца. Столбцов ещё нет в
 * src/types/database.ts, поэтому читаются из строки сделки отдельно.
 */
export type DealTermination = { at: string | null; reason: string | null; note: string | null };

export function dealTermination(deal: LoadedDeal['deal']): DealTermination {
  const row = deal as unknown as { terminated_at?: string | null; terminated_reason?: string | null; terminated_note?: string | null };
  return { at: row.terminated_at ?? null, reason: row.terminated_reason ?? null, note: row.terminated_note ?? null };
}

/** День по Хельсинки из метки времени (договор датируется по финскому календарю). */
export const helsinkiDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(new Date(iso));

const fiDateShort = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
};

type Snapshot = { name: string; business_id: string; address: string; vat_registered: boolean; email: string | null };

/* Стороны — из снимка на момент согласия: правки карточек потом договор не меняют. */
function party(s: Snapshot | undefined) {
  return {
    name: s?.name ?? '',
    businessId: s?.business_id ?? '',
    address: s?.address ?? '',
    vatRegistered: Boolean(s?.vat_registered),
    email: s?.email ?? '',
    phone: '',
  };
}

/** Машина сделки — из снимка на момент предложения. */
export function dealVehicle(d: LoadedDeal) {
  const v = (d.deal.vehicle_snapshot ?? {}) as { make?: string; plate?: string; vehicle_class?: string; odometer_km?: number | null };
  return {
    make: v.make ?? d.vehicle.make,
    plate: v.plate ?? d.vehicle.plate,
    vehicleClass: v.vehicle_class ?? d.vehicle.vehicle_class,
    odometerKm: v.odometer_km ?? null,
  };
}

/**
 * Как печатать договор страны (23.11.2026): язык чисел и вид даты. По
 * умолчанию — финский договор, как было: числа fi-FI, дата «5.1.2027».
 * Договоры Эстонии и Латвии — числа своего языка, дата «05.01.2027».
 * День согласия — по часовому поясу страны продавца (у Финляндии — Хельсинки).
 */
export type ContractPrint = { intl: string; paddedDates: boolean };

const FI_PRINT: ContractPrint = { intl: 'fi-FI', paddedDates: false };

const paddedDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

export function contractInput(d: LoadedDeal, print: ContractPrint = FI_PRINT): ContractPdfInput | null {
  const { deal } = d;
  const fiDate = print.paddedDates ? paddedDate : fiDateShort;
  if (!deal.contract_number || !deal.agreed_at || !deal.parties_snapshot) return null;
  const parties = deal.parties_snapshot as { seller?: Snapshot; buyer?: Snapshot };
  const vehicle = dealVehicle(d);
  const schedule = buildSchedule({
    priceCents: deal.price_cents,
    vatMode: deal.vat_mode as VatMode,
    vatBps: deal.vat_bps,
    downPaymentCents: deal.down_payment_cents,
    months: deal.months,
    finalCents: deal.final_cents,
    annualRateBps: deal.annual_rate_bps,
    handoverDate: deal.handover_date,
    firstDueDate: deal.first_due_date,
  });
  if ('error' in schedule) return null;
  /*
   * Пороги — по правилам страны сделки (23.11.2026). Этот договор — финский
   * шаблон (FI_OSAMAKSU): пороги 2 § в нём обязательны, поэтому без правил
   * страны договора нет. Суммы — в валюте сделки, без пересчёта.
   */
  const rules = installmentRules(d.seller.country);
  if (!rules) return null;
  const limits = rules.thresholds(schedule);
  const f = createFormat(print.intl);
  const currency = deal.currency ?? installmentCurrency(d.seller.country);
  const eur = (cents: number) => f.money(cents, currency);
  const vatPercent = (deal.vat_bps / 100).toLocaleString(print.intl, { maximumFractionDigits: 1 });
  /* Остаток цены после каждого взноса — для графика в приложении 1 договоров других стран. */
  let balance = deal.price_cents - deal.down_payment_cents;
  const plan = schedule.installments.map((x) => {
    balance -= x.principalCents;
    return {
      n: x.n,
      due: fiDate(x.dueDate),
      principal: eur(x.principalCents),
      interest: x.interestCents > 0 ? eur(x.interestCents) : '–',
      total: eur(x.principalCents + x.interestCents),
      balance: eur(Math.max(0, balance)),
    };
  });
  const principalTotal = schedule.installments.reduce((sum, x) => sum + x.principalCents, 0);
  /* Номер-заглушка (DRAFT-…) — счёт ещё без номера: в договоре остаётся прочерк. */
  const firstInvoiceNumber = d.invoice?.number && !d.invoice.number.startsWith('DRAFT-') ? d.invoice.number : null;

  return {
    number: deal.contract_number,
    date: fiDate(installmentDay(d.seller.country, deal.agreed_at)),
    seller: party(parties.seller),
    buyer: party(parties.buyer),
    vehicle: {
      make: vehicle.make,
      plate: vehicle.plate,
      odometer: vehicle.odometerKm != null ? `${vehicle.odometerKm.toLocaleString(print.intl)} km` : '______________ km',
    },
    price: {
      net: eur(deal.price_cents),
      vatLabel: deal.vat_mode === 'STANDARD' ? `Arvonlisävero ${vatPercent} %` : 'Arvonlisävero',
      vat: eur(schedule.vatCents),
      gross: eur(schedule.installmentPriceCents),
      downGross: eur(schedule.firstInvoiceCents),
      rest: eur(deal.price_cents - deal.down_payment_cents),
      interestTotal: schedule.interestTotalCents > 0 ? eur(schedule.interestTotalCents) : null,
      installmentPrice: eur(schedule.installmentPriceCents),
      tenth: eur(limits.tenthCents),
      twentieth: eur(limits.twentiethCents),
    },
    vatMode: deal.vat_mode as ContractPdfInput['vatMode'],
    months: deal.months,
    ratePercent: deal.annual_rate_bps > 0 ? (deal.annual_rate_bps / 100).toLocaleString(print.intl, { maximumFractionDigits: 2 }) : null,
    handover: fiDate(deal.handover_date),
    schedule: schedule.installments.map((x) => ({
      n: x.n,
      due: fiDate(x.dueDate),
      principal: eur(x.principalCents),
      interest: x.interestCents > 0 ? eur(x.interestCents) : '–',
    })),
    vatPercent,
    down: eur(deal.down_payment_cents),
    firstInvoiceNumber,
    plan,
    planTotals: {
      principal: eur(principalTotal),
      interest: schedule.interestTotalCents > 0 ? eur(schedule.interestTotalCents) : '–',
      all: eur(schedule.firstInvoiceCents + principalTotal + schedule.interestTotalCents),
    },
    dueDay: Number(deal.first_due_date.slice(8, 10)),
  };
}
