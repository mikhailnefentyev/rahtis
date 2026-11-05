/**
 * Доходность машин: доходы, расходы и прибыль каждой машины и парка по
 * месяцам.
 *
 * Доходы:
 *  · рейсы с площадки — выплата перевозчику (ставка минус комиссия) и
 *    оплата простоя;
 *  · свои рейсы и прямые заказы по договору перевозчика — полная цена;
 *  · работа на объектах (самосвалы) — строки счёта по дням машины.
 *
 * Расходы:
 *  · топливо — сумма заправок;
 *  · водитель — ориентировочная зарплата по сменам на этой машине плюс
 *    налоги и взносы работодателя (процент компании, по умолчанию 25 %);
 *  · машина — платёж по кредиту, рассрочке или лизингу в месяцы платежей;
 *    купленная сразу — (цена − остаточная) ÷ срок службы в месяцы срока;
 *  · страховка, каско, налог — годовые суммы ÷ 12; прочее постоянное в
 *    месяц;
 *  · журнал — разовые расходы месяца;
 *  · RAHTIS — абонемент за машину, если компания на подписке и машина в
 *    месяце работала: лесенкой, на машину — средняя цена месяца.
 *
 * Всё без ALV, в центах одной валюты — рабочей валюты компании: строки
 * доходов и расходов приходят уже пересчитанными (load.ts, курс ЕЦБ дня
 * строки). Карточка машины хранит суммы в своей валюте — её переводит
 * множитель financeRate на месяц. Это оценка для решений, а не бухгалтерия.
 *
 * Без зависимостей: модуль читают тесты (node --test).
 */

export type Financing = 'CASH' | 'LOAN' | 'INSTALLMENT' | 'LEASING';

export type VehicleFinance = {
  purchase_price_cents: number | null;
  purchased_on: string | null;
  financing: Financing;
  monthly_payment_cents: number | null;
  payments_until: string | null;
  useful_life_months: number;
  residual_cents: number | null;
  insurance_cents_year: number | null;
  kasko_cents_year: number | null;
  tax_cents_year: number | null;
  other_fixed_cents_month: number | null;
  /** Валюта сумм карточки (EUR, PLN…); пересчёт — financeRate. */
  currency?: string;
};

export type RevenueKind = 'PLATFORM' | 'OWN' | 'SITE';

export type EconomicsInput = {
  months: string[];
  vehicles: { id: string; plate: string }[];
  revenue: { vehicleId: string; month: string; cents: number; kind: RevenueKind }[];
  fuel: { vehicleId: string; month: string; cents: number }[];
  /** Ориентировочная зарплата без налогов работодателя. */
  pay: { vehicleId: string; month: string; cents: number }[];
  journal: { vehicleId: string; month: string; cents: number }[];
  finance: Map<string, VehicleFinance>;
  employerCostBps: number;
  /**
   * Абонемент за работавшую машину по месяцам, если компания на подписке
   * (лесенка: средняя цена месяца по числу работавших машин); null — не на
   * подписке. Число — та же цена на все месяцы.
   */
  subscriptionUnitCents: number | Record<string, number> | null;
  /**
   * Множитель «валюта карточки → валюта компании» на месяц (курс первого
   * числа). Нет — суммы карточки уже в валюте компании; null из функции —
   * курса нет: постоянные расходы месяца не считаются, чем сложить злотые
   * с евро как равные.
   */
  financeRate?: (vehicleId: string, month: string) => number | null;
};

export type MonthEconomics = {
  month: string;
  revenue: { platform: number; own: number; site: number; total: number };
  costs: {
    fuel: number;
    driver: number;
    financing: number;
    depreciation: number;
    insurance: number;
    tax: number;
    fixed: number;
    journal: number;
    rahtis: number;
    total: number;
  };
  profit: number;
  /** Прибыль ÷ доход, %; null — дохода не было. */
  marginPct: number | null;
};

export type VehicleEconomics = {
  vehicleId: string;
  plate: string;
  months: MonthEconomics[];
  /** Купленная сразу: сколько цены уже заработано (прибыль до износа с покупки), %. */
  paybackPct: number | null;
};

const monthOfDate = (date: string) => date.slice(0, 7);

/** Месяц m в промежутке [from, to] (YYYY-MM); пустые границы — открыты. */
function within(month: string, from: string | null, to: string | null): boolean {
  if (from && month < monthOfDate(from)) return false;
  if (to && month > monthOfDate(to)) return false;
  return true;
}

/** Месяцев от from до to включительно (YYYY-MM). */
function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

const empty = (month: string): MonthEconomics => ({
  month,
  revenue: { platform: 0, own: 0, site: 0, total: 0 },
  costs: { fuel: 0, driver: 0, financing: 0, depreciation: 0, insurance: 0, tax: 0, fixed: 0, journal: 0, rahtis: 0, total: 0 },
  profit: 0,
  marginPct: null,
});

function finish(m: MonthEconomics): MonthEconomics {
  m.revenue.total = m.revenue.platform + m.revenue.own + m.revenue.site;
  const c = m.costs;
  c.total = c.fuel + c.driver + c.financing + c.depreciation + c.insurance + c.tax + c.fixed + c.journal + c.rahtis;
  m.profit = m.revenue.total - c.total;
  m.marginPct = m.revenue.total > 0 ? Math.round((m.profit / m.revenue.total) * 1000) / 10 : null;
  return m;
}

/** Постоянные расходы машины за месяц из карточки. */
export function fixedCosts(finance: VehicleFinance | undefined, month: string) {
  const out = { financing: 0, depreciation: 0, insurance: 0, tax: 0, fixed: 0 };
  if (!finance) return out;
  /* Машины ещё не было — постоянных расходов нет. */
  if (finance.purchased_on && month < monthOfDate(finance.purchased_on)) return out;

  if (finance.financing === 'CASH') {
    const base = Math.max(0, (finance.purchase_price_cents ?? 0) - (finance.residual_cents ?? 0));
    const life = Math.max(1, finance.useful_life_months);
    const inLife = !finance.purchased_on || monthsBetween(monthOfDate(finance.purchased_on), month) <= life;
    if (base > 0 && inLife) out.depreciation = Math.round(base / life);
  } else if (finance.monthly_payment_cents && within(month, finance.purchased_on, finance.payments_until)) {
    out.financing = finance.monthly_payment_cents;
  }

  out.insurance = Math.round(((finance.insurance_cents_year ?? 0) + (finance.kasko_cents_year ?? 0)) / 12);
  out.tax = Math.round((finance.tax_cents_year ?? 0) / 12);
  out.fixed = finance.other_fixed_cents_month ?? 0;
  return out;
}

/** Постоянные расходы карточки → в валюту компании (множитель курса). */
export function scaleCosts<T extends Record<string, number>>(costs: T, rate: number): T {
  if (rate === 1) return costs;
  const out = { ...costs };
  for (const k of Object.keys(out) as (keyof T)[]) out[k] = Math.round(out[k] * rate) as T[keyof T];
  return out;
}

export function vehicleEconomics(input: EconomicsInput): { vehicles: VehicleEconomics[]; fleet: MonthEconomics[] } {
  const key = (v: string, m: string) => `${v}|${m}`;
  const sums = <T extends { vehicleId: string; month: string; cents: number }>(rows: T[]) => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(key(r.vehicleId, r.month), (map.get(key(r.vehicleId, r.month)) ?? 0) + r.cents);
    return map;
  };
  const fuel = sums(input.fuel);
  const pay = sums(input.pay);
  const journal = sums(input.journal);
  const revenue = new Map<string, { platform: number; own: number; site: number }>();
  for (const r of input.revenue) {
    const k = key(r.vehicleId, r.month);
    const acc = revenue.get(k) ?? { platform: 0, own: 0, site: 0 };
    if (r.kind === 'PLATFORM') acc.platform += r.cents;
    else if (r.kind === 'OWN') acc.own += r.cents;
    else acc.site += r.cents;
    revenue.set(k, acc);
  }

  const vehicles: VehicleEconomics[] = input.vehicles.map((v) => {
    const finance = input.finance.get(v.id);
    const months = input.months.map((month) => {
      const k = key(v.id, month);
      const m = empty(month);
      const r = revenue.get(k);
      if (r) Object.assign(m.revenue, r);
      m.costs.fuel = fuel.get(k) ?? 0;
      m.costs.driver = Math.round((pay.get(k) ?? 0) * (1 + input.employerCostBps / 10_000));
      const rate = input.financeRate ? input.financeRate(v.id, month) : 1;
      if (rate !== null) Object.assign(m.costs, scaleCosts(fixedCosts(finance, month), rate));
      m.costs.journal = journal.get(k) ?? 0;
      const worked = (r?.platform ?? 0) + (r?.own ?? 0) + (r?.site ?? 0) > 0;
      const unit = input.subscriptionUnitCents;
      m.costs.rahtis = unit != null && worked ? (typeof unit === 'number' ? unit : (unit[month] ?? 0)) : 0;
      return finish(m);
    });

    /* Окупаемость купленной сразу: прибыль до износа с месяца покупки против цены без остаточной. */
    let paybackPct: number | null = null;
    if (finance?.financing === 'CASH' && finance.purchase_price_cents) {
      /* Цена — в валюте карточки: по курсу месяца покупки (или первого показанного). */
      const priceMonth = finance.purchased_on ? monthOfDate(finance.purchased_on) : input.months[0];
      const rate = input.financeRate ? input.financeRate(v.id, priceMonth ?? '') : 1;
      const base = rate === null ? 0 : Math.round((finance.purchase_price_cents - (finance.residual_cents ?? 0)) * rate);
      if (base > 0) {
        const earned = months
          .filter((m) => !finance.purchased_on || m.month >= monthOfDate(finance.purchased_on))
          .reduce((s, m) => s + m.profit + m.costs.depreciation, 0);
        paybackPct = Math.round((earned / base) * 1000) / 10;
      }
    }

    return { vehicleId: v.id, plate: v.plate, months, paybackPct };
  });

  const fleet = input.months.map((month) => {
    const m = empty(month);
    for (const v of vehicles) {
      const vm = v.months.find((x) => x.month === month)!;
      for (const k of ['platform', 'own', 'site'] as const) m.revenue[k] += vm.revenue[k];
      for (const k of Object.keys(m.costs) as (keyof MonthEconomics['costs'])[]) if (k !== 'total') m.costs[k] += vm.costs[k];
    }
    return finish(m);
  });

  return { vehicles, fleet };
}
