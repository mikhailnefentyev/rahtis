import 'server-only';

import { createFormat } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { buildSchedule, thresholds, type VatMode } from './calc';
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
  const companyCols = 'id, name, legal_name, business_id, vat_number, legal_street, legal_postal_code, legal_city, contact_email, billing_email, country, iban';
  const [{ data: listing }, { data: seller }, { data: buyer }, { data: invoice }] = await Promise.all([
    admin.from('equipment_listings').select('*').eq('id', deal.listing_id).maybeSingle(),
    admin.from('companies').select(companyCols).eq('id', deal.seller_company_id).maybeSingle(),
    admin.from('companies').select(companyCols).eq('id', deal.buyer_company_id).maybeSingle(),
    deal.first_invoice_id
      ? admin.from('carrier_invoices').select('id, number, file_path, total_cents, due_on').eq('id', deal.first_invoice_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!listing || !seller || !buyer) return null;
  const { data: vehicle } = await admin
    .from('vehicles')
    .select('id, make, plate, vehicle_class, euro_class, axles, base_city')
    .eq('id', listing.vehicle_id)
    .maybeSingle();
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

const fiDate = (iso: string) => {
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

export function contractInput(d: LoadedDeal): ContractPdfInput | null {
  const { deal } = d;
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
  const limits = thresholds(schedule);
  const f = createFormat('fi-FI');
  const eur = (cents: number) => f.money(cents, 'EUR');
  const vatPercent = (deal.vat_bps / 100).toLocaleString('fi-FI', { maximumFractionDigits: 1 });

  return {
    number: deal.contract_number,
    date: fiDate(helsinkiDay(deal.agreed_at)),
    seller: party(parties.seller),
    buyer: party(parties.buyer),
    vehicle: {
      make: vehicle.make,
      plate: vehicle.plate,
      odometer: vehicle.odometerKm != null ? `${vehicle.odometerKm.toLocaleString('fi-FI')} km` : '______________ km',
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
    ratePercent: deal.annual_rate_bps > 0 ? (deal.annual_rate_bps / 100).toLocaleString('fi-FI', { maximumFractionDigits: 2 }) : null,
    handover: fiDate(deal.handover_date),
    schedule: schedule.installments.map((x) => ({
      n: x.n,
      due: fiDate(x.dueDate),
      principal: eur(x.principalCents),
      interest: x.interestCents > 0 ? eur(x.interestCents) : '–',
    })),
  };
}
