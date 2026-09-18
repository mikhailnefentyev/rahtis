/**
 * Быстрые периоды отчёта: неделя, месяц, квартал — текущие и прошлые.
 *
 * Без 'server-only': кнопки считает и страница, и адресная строка. Даты
 * по Хельсинки, а не по часам браузера: у диспетчера в Таллине и у
 * бухгалтера в Стокгольме «этот месяц» должен начинаться в тот же день,
 * что у отчёта, который по Хельсинки и собирается.
 */

export type QuickPeriod =
  'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter';

export const QUICK_PERIODS: QuickPeriod[] = [
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'thisQuarter',
  'lastQuarter',
];

/** Сегодня по Хельсинки, YYYY-MM-DD. */
export function helsinkiToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
  }).format(now);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

export function quickRange(
  period: QuickPeriod,
  now: Date = new Date(),
): { from: string; to: string } {
  const today = new Date(`${helsinkiToday(now)}T00:00:00Z`);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();

  switch (period) {
    case 'thisWeek':
    case 'lastWeek': {
      const monday = new Date(today);
      monday.setUTCDate(
        today.getUTCDate() - ((today.getUTCDay() + 6) % 7) - (period === 'lastWeek' ? 7 : 0),
      );
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      return { from: iso(monday), to: iso(sunday) };
    }
    case 'thisMonth':
      return { from: iso(utc(y, m, 1)), to: iso(utc(y, m + 1, 0)) };
    case 'lastMonth':
      return { from: iso(utc(y, m - 1, 1)), to: iso(utc(y, m, 0)) };
    case 'thisQuarter': {
      const q = Math.floor(m / 3) * 3;
      return { from: iso(utc(y, q, 1)), to: iso(utc(y, q + 3, 0)) };
    }
    case 'lastQuarter': {
      const q = Math.floor(m / 3) * 3 - 3;
      return { from: iso(utc(y, q, 1)), to: iso(utc(y, q + 3, 0)) };
    }
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Период из адресной строки. Неверный — null: страница скажет об этом,
 * а не построит отчёт за «какой получилось».
 */
export function parseRange(
  from: string | undefined,
  to: string | undefined,
): { from: string; to: string } | null {
  if (!from || !to || !DATE.test(from) || !DATE.test(to)) return null;
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  if (iso(a) !== from || iso(b) !== to) return null;
  const days = (b.getTime() - a.getTime()) / 86_400_000;
  if (days < 0 || days > 366) return null;
  return { from, to };
}
