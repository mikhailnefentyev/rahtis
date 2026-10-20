import { APP } from './config';
import { zoneOffsetMinutes } from './dates';

/**
 * Форматирование денег, дат и чисел.
 *
 * Два правила, которые тут закреплены:
 *
 *  1. Деньги приходят в центах. Функции принимают целое число центов и сами
 *     решают, показывать ли копейки: ставки в грузоперевозках почти всегда
 *     круглые, и «€480» читается быстрее, чем «€480,00».
 *
 *  2. Время показывается в часовом поясе операций (Europe/Helsinki),
 *     независимо от того, где находится пользователь и на каком он языке.
 *     Диспетчер в Хельсинки и водитель в дороге должны видеть одно и то же
 *     время загрузки.
 *
 *     Исключение — время точки маршрута (прибытие, окончание работ,
 *     оценка прибытия): оно по поясу страны точки, как и её плановое
 *     время, которое записано местным (пакеты стран, 21.10.2026). Там,
 *     где пояс точки расходится с финским, рядом стоит «UTC+1» —
 *     stopZone() ниже.
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

    /**
     * Дробное число с фиксированным числом знаков: рейтинг 4.7 → «4,7»
     * в русском и финском, «4.7» в английском. Разделитель дробной части
     * решает локаль, а не toFixed.
     */
    decimal(value: number, digits = 1): string {
      const nf = cached(`dec:${intlLocale}:${digits}`, () =>
        new Intl.NumberFormat(intlLocale, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }),
      );
      return nf.format(value);
    },

    /** Доля как проценты: 0.03 → «3 %». Знак и отступ ставит локаль. */
    percent(fraction: number, digits = 0): string {
      const nf = cached(`pct:${intlLocale}:${digits}`, () =>
        new Intl.NumberFormat(intlLocale, {
          style: 'percent',
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }),
      );
      return nf.format(fraction);
    },

    /** Дата: «12.11.2026». Пояс — операций, если не передан другой. */
    date(value: Date | string | number, timeZone: string = APP.timeZone): string {
      const df = cached(`date:${intlLocale}:${timeZone}`, () =>
        new Intl.DateTimeFormat(intlLocale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone,
        }),
      );
      return df.format(toDate(value));
    },

    /** Время: «08:00». Пояс — операций, если не передан другой. */
    time(value: Date | string | number, timeZone: string = APP.timeZone): string {
      const df = cached(`time:${intlLocale}:${timeZone}`, () =>
        new Intl.DateTimeFormat(intlLocale, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone,
        }),
      );
      return df.format(toDate(value));
    },

    /** Дата и время: «12.11.2026 08:00». */
    dateTime(value: Date | string | number, timeZone: string = APP.timeZone): string {
      return `${this.date(value, timeZone)} ${this.time(value, timeZone)}`;
    },
  };
}

export type Format = ReturnType<typeof createFormat>;

/**
 * Пометка пояса у времени точки: «UTC+1», если в этот момент пояс точки
 * расходится с финским, иначе пусто. Эстония живёт по финскому времени —
 * у таллинской точки пометки нет; у варшавской зимой «UTC+1».
 */
export function stopZone(value: Date | string | number, timeZone: string): string {
  if (timeZone === APP.timeZone) return '';
  const at = new Date(value);
  const minutes = zoneOffsetMinutes(at, timeZone);
  if (minutes === zoneOffsetMinutes(at, APP.timeZone)) return '';
  const sign = minutes < 0 ? '-' : '+';
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

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
 * Существование компании проверяется отдельно, по реестру PRH/YTJ
 * (ТЗ §3); здесь — формат и контрольная цифра.
 *
 * Контрольная цифра ловит опечатку до того, как заявка уйдёт оператору:
 * раньше «1234567-1» проходил как верный номер (прогон 12.10.2026), и о
 * промахе узнавали только из ответа реестра «не найдено». Правило PRH:
 * цифры умножаются на 7, 9, 10, 5, 8, 4, 2, сумма делится на 11; остаток
 * 0 даёт цифру 0, остаток 1 не бывает, иначе цифра — 11 минус остаток.
 */
export const BUSINESS_ID_PATTERN = /^\d{7}-\d$/;

const BUSINESS_ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2];

export function isValidBusinessId(value: string): boolean {
  const id = value.trim();
  if (!BUSINESS_ID_PATTERN.test(id)) return false;

  const sum = BUSINESS_ID_WEIGHTS.reduce((total, weight, index) => total + weight * Number(id[index]), 0);
  const rest = sum % 11;
  if (rest === 1) return false;

  return Number(id[8]) === (rest === 0 ? 0 : 11 - rest);
}
