/**
 * Расходы на обслуживание за период: по месяцам, по машинам, евро на
 * километр и повторяющиеся поломки.
 *
 * Суммы уже переведены в валюту компании (строка без курса приходит
 * null и в итог не входит). Плановое — всё, что не разовый ремонт
 * (ТО, katsastus, тахограф, шины…); ремонт — вид REPAIR.
 *
 * Без зависимостей — модуль читают страница и тесты.
 */

export type CostRecord = {
  assetId: string;
  kind: string;
  doneOn: string;
  /** В валюте компании; null — суммы нет или нет курса. */
  cents: number | null;
};

export type CostDefect = { assetId: string; area: string; reportedOn: string };

export type KmSpan = { km_start: number | null; km_end: number | null };

export type MonthCost = { month: string; planned: number; repairs: number };

export type AssetCost = {
  assetId: string;
  total: number;
  planned: number;
  repairs: number;
  /** Записей книжки за период (с суммой и без). */
  visits: number;
  /** Пробег за период по показаниям; null — показаний нет. */
  km: number | null;
  /** Центов на километр; null — пробег меньше MIN_KM (иначе цифра врёт). */
  perKm: number | null;
  defects: number;
  /** Узлы, по которым за период больше одного дефекта. */
  repeatAreas: { area: string; count: number }[];
};

export type CostSummary = {
  total: number;
  planned: number;
  repairs: number;
  months: MonthCost[];
  assets: AssetCost[];
  /** Центов на км по машинам с известным пробегом; null — таких нет. */
  fleetPerKm: number | null;
  /** Повторяющиеся поломки по всему парку: машина × узел, больше одного раза. */
  repeats: { assetId: string; area: string; count: number }[];
};

/** Ниже этого пробега «евро на км» не показываем: две заправки дадут абсурдную цифру. */
export const MIN_KM = 1000;

export const isRepair = (kind: string) => kind === 'REPAIR';

export function summarizeCosts(input: {
  months: string[];
  records: CostRecord[];
  defects: CostDefect[];
  km: Map<string, KmSpan>;
  assetIds: string[];
}): CostSummary {
  const from = `${input.months[0]}-01`;
  const inPeriod = (day: string) => day >= from && input.months.includes(day.slice(0, 7));

  const months = new Map<string, MonthCost>(input.months.map((m) => [m, { month: m, planned: 0, repairs: 0 }]));
  const assets = new Map<string, AssetCost>(
    input.assetIds.map((id) => [id, { assetId: id, total: 0, planned: 0, repairs: 0, visits: 0, km: null, perKm: null, defects: 0, repeatAreas: [] }]),
  );

  for (const r of input.records) {
    if (!inPeriod(r.doneOn)) continue;
    const asset = assets.get(r.assetId);
    if (!asset) continue;
    asset.visits += 1;
    const cents = r.cents ?? 0;
    if (cents <= 0) continue;
    const month = months.get(r.doneOn.slice(0, 7))!;
    if (isRepair(r.kind)) {
      month.repairs += cents;
      asset.repairs += cents;
    } else {
      month.planned += cents;
      asset.planned += cents;
    }
    asset.total += cents;
  }

  const areaCount = new Map<string, number>();
  for (const d of input.defects) {
    if (!inPeriod(d.reportedOn)) continue;
    const asset = assets.get(d.assetId);
    if (!asset) continue;
    asset.defects += 1;
    const key = `${d.assetId}|${d.area}`;
    areaCount.set(key, (areaCount.get(key) ?? 0) + 1);
  }
  const repeats: CostSummary['repeats'] = [];
  for (const [key, count] of areaCount) {
    if (count < 2) continue;
    const [assetId, area] = key.split('|');
    repeats.push({ assetId, area, count });
    assets.get(assetId)!.repeatAreas.push({ area, count });
  }
  repeats.sort((a, b) => b.count - a.count);
  for (const a of assets.values()) a.repeatAreas.sort((x, y) => y.count - x.count);

  let kmCosts = 0;
  let kmSum = 0;
  for (const a of assets.values()) {
    const span = input.km.get(a.assetId);
    if (!span || span.km_start == null || span.km_end == null) continue;
    a.km = Math.max(0, span.km_end - span.km_start);
    if (a.km >= MIN_KM) {
      a.perKm = a.total / a.km;
      kmCosts += a.total;
      kmSum += a.km;
    }
  }

  const list = [...assets.values()].sort((a, b) => b.total - a.total || b.defects - a.defects);
  const total = list.reduce((s, a) => s + a.total, 0);
  return {
    total,
    planned: list.reduce((s, a) => s + a.planned, 0),
    repairs: list.reduce((s, a) => s + a.repairs, 0),
    months: [...months.values()],
    assets: list,
    fleetPerKm: kmSum >= MIN_KM ? kmCosts / kmSum : null,
    repeats,
  };
}
