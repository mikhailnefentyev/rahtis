import { APP } from './config';

/**
 * Форматирование денег, дат и чисел.
 *
 * Два правила, которые тут закреплены:
 *
 *  1. Деньги приходят в центах. Функции принимают целое число центов и сами
 *     решают, показывать ли копейки: ставки в грузоперевозках почти всегда
 *     круглые, и «€480» читается быстрее, чем «€480,00».
 *
 *  2. Время всегда показывается в часовом поясе операций (Europe/Helsinki),
 *     независимо от того, где находится пользователь и на каком он языке.
 *     Диспетчер в Хельсинки и водитель в дороге должны видеть одно и то же
 *     время загрузки.
 */

/** Intl-форматтеры дороги в создании — кешируем по ключу. */
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat>(key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit as T;
  const made = make();
  cache.set(key, made);
  return made;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Создаёт набор форматтеров под конкретную локаль.
 * Тег берётся из словаря: `createFormat(t.meta.intl)`.
 */
export function createFormat(intlLocale: string) {
  return {
    /** Сумма из центов: 48000 → «480 €» (ru-RU) / «480 €» (fi-FI). */
    eur(cents: number): string {
      const whole = cents % 100 === 0;
      const nf = cached(`eur:${intlLocale}:${whole}`, () =>
        new Intl.NumberFormat(intlLocale, {
          style: 'currency',
          currency: APP.currency,
          currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: whole ? 0 : 2,
          maximumFractionDigits: whole ? 0 : 2,
        }),
      );
      return nf.format(cents / 100);
    },

    /** Ставка за километр: «€3.69/км». Всегда с двумя знаками. */
    eurPerKm(cents: number, km: number): string | null {
      if (!km || km <= 0) return null;
      const nf = cached(`perkm:${intlLocale}`, () =>
        new Intl.NumberFormat(intlLocale, {
          style: 'currency',
          currency: APP.currency,
          currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      );
      return nf.format(cents / 100 / km);
    },

    /** Целое число с разделителями разрядов: 3240 → «3 240». */
    number(value: number): string {
      const nf = cached(`num:${intlLocale}`, () => new Intl.NumberFormat(intlLocale));
      return nf.format(value);
    },

    /** Дата: «12.11.2026». */
    date(value: Date | string | number): string {
      const df = cached(`date:${intlLocale}`, () =>
        new Intl.DateTimeFormat(intlLocale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: APP.timeZone,
        }),
      );
      return df.format(toDate(value));
    },

    /** Время: «08:00». */
    time(value: Date | string | number): string {
      const df = cached(`time:${intlLocale}`, () =>
        new Intl.DateTimeFormat(intlLocale, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: APP.timeZone,
        }),
      );
      return df.format(toDate(value));
    },

    /** Дата и время: «12.11.2026 08:00». */
    dateTime(value: Date | string | number): string {
      return `${this.date(value)} ${this.time(value)}`;
    },
  };
}

export type Format = ReturnType<typeof createFormat>;

/**
 * Обратный отсчёт до дедлайна: «12:41».
 * Считается от серверного deadline_at — клиент только рисует остаток.
 */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Y-tunnus — финский бизнес-ID: семь цифр, дефис, контрольная цифра.
 * Здесь только формат; фактическое существование компании оператор
 * проверяет вручную по реестру PRH/YTJ (ТЗ §3).
 */
export const BUSINESS_ID_PATTERN = /^\d{7}-\d$/;

export function isValidBusinessId(value: string): boolean {
  return BUSINESS_ID_PATTERN.test(value.trim());
}
