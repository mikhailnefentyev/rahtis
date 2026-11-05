import type { Currency, FxHistory } from '@/lib/money/currency';

/**
 * Пересчёт строк доходности в рабочую валюту компании по курсу ЕЦБ дня
 * строки (рейс — день закрытия, расход — день траты, заправка — день
 * заправки, карточка машины — первое число месяца).
 *
 * Курса нет — строка не входит в итог (null) и считается в missing:
 * лучше недосчитать, чем сложить злотые с евро как равные.
 *
 * Без зависимостей во время выполнения: модуль читают тесты.
 */
export type CompanyConverter = {
  /** Центы строки → центы в валюте компании; курса нет — null. */
  cents(cents: number, from: string | null | undefined, day: string): number | null;
  /** Множитель «валюта → валюта компании» на день; курса нет — null. */
  rate(from: string | null | undefined, day: string): number | null;
  /** Сколько строк пропущено без курса. */
  readonly missing: number;
};

const norm = (cur: string | null | undefined): Currency => ((cur ?? '').trim().toUpperCase() || 'EUR') as Currency;

export function companyConverter(fx: Pick<FxHistory, 'convert' | 'perEur'>, to: Currency): CompanyConverter {
  let missing = 0;
  return {
    cents(cents, from, day) {
      if (!cents) return 0;
      const out = fx.convert(cents, norm(from), to, day);
      if (out === null) missing += 1;
      return out;
    },
    rate(from, day) {
      const src = norm(from);
      if (src === to) return 1;
      const a = fx.perEur(src, day);
      const b = fx.perEur(to, day);
      if (a === null || b === null) {
        missing += 1;
        return null;
      }
      return b / a;
    },
    get missing() {
      return missing;
    },
  };
}
