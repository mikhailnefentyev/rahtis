import 'server-only';

import type { createClient } from '@/lib/supabase/server';
import { asCurrency, type Currency } from '@/lib/money/currency';
import { loadFxHistory } from '@/lib/money/fx';
import { fuelAmountIn, fuelStats, monthOf, monthsBack, type FuelRow, type FuelStats } from './fuel';

/**
 * Заправки компании за месяц и год до него — для страницы «Топливо» и
 * выгрузки отчёта: обе считают по одним и тем же строкам.
 *
 * Год нужен расходу: интервал полного бака, начатый в прошлом месяце,
 * закрывается в этом, и без предыдущих строк месяц посчитался бы неверно.
 *
 * Сумма строки — в валюте чека (row.currency); итоги и цена километра —
 * в валюте компании, каждая строка по курсу ЕЦБ дня заправки.
 */

export const FUEL_MONTHS = 12;

export type FuelEntry = FuelRow & {
  currency: Currency;
  /** Сумма в валюте компании по курсу дня заправки; null — суммы нет или курса нет. */
  own_amount_cents: number | null;
  driver_id: string | null;
  unit: string | null;
  station: string | null;
  source: string;
  receipt_path: string | null;
  qty_report: number | null;
  qty_driver: number | null;
  qty_telematics: number | null;
};

export type FuelMonth = {
  month: string;
  months: string[];
  /** Валюта компании: в ней итоги. */
  currency: Currency;
  rows: FuelEntry[];
  stats: FuelStats;
  vehicles: { id: string; plate: string }[];
  drivers: { id: string; full_name: string }[];
};

export function currentFuelMonth(): string {
  return monthOf(new Date().toISOString());
}

/** YYYY-MM из адреса; будущее и мусор — текущий месяц. */
export function parseFuelMonth(value: string | null | undefined): string {
  const current = currentFuelMonth();
  return value && /^\d{4}-\d{2}$/.test(value) && value <= current ? value : current;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

const num = (value: number | string | null): number | null => (value == null ? null : Number(value));

export async function loadFuelMonth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  month: string,
  currency: Currency,
): Promise<FuelMonth> {
  const months = monthsBack(month, FUEL_MONTHS);
  /* С запасом в месяц: первый интервал года открывается заправкой месяцем раньше. */
  const since = `${monthsBack(months[0], 2)[0]}-01T00:00:00Z`;
  const until = `${nextMonth(month)}-01T00:00:00Z`;

  const [{ data: entries }, { data: vehicles }, { data: drivers }, fx] = await Promise.all([
    supabase
      .from('fuel_entries')
      .select(
        'id, vehicle_id, driver_id, filled_at, product, quantity, unit, amount_cents, currency, odometer_km, full_tank, station, source, receipt_path, qty_report, qty_driver, qty_telematics',
      )
      .eq('company_id', companyId)
      .gte('filled_at', since)
      .lt('filled_at', until)
      .order('filled_at', { ascending: true })
      .limit(5000),
    supabase.from('vehicles').select('id, plate').eq('company_id', companyId).order('plate'),
    supabase.from('drivers').select('id, full_name').eq('company_id', companyId),
    loadFxHistory(supabase, since, until),
  ]);

  const toOwn = fuelAmountIn(currency, fx);
  const rows: FuelEntry[] = (entries ?? []).map((e) => {
    const row = {
      ...e,
      currency: asCurrency(e.currency, currency),
      quantity: Number(e.quantity),
      qty_report: num(e.qty_report),
      qty_driver: num(e.qty_driver),
      qty_telematics: num(e.qty_telematics),
    };
    return { ...row, own_amount_cents: toOwn(row) };
  });

  return {
    month,
    months,
    currency,
    rows,
    stats: fuelStats(rows, (row) => row.own_amount_cents),
    vehicles: vehicles ?? [],
    drivers: drivers ?? [],
  };
}
