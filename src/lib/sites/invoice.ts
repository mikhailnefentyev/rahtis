/**
 * Счёт перевозчика клиенту за работу на объекте: строки, ALV, номер для
 * платежа (viitenumero). Чистые функции — без базы, их проверяют тесты.
 */
import type { Pricing } from './work';

/**
 * Финский номер для платежа (kotimainen viitenumero): цифры основы и
 * контрольная цифра по весам 7-3-1 справа налево. Основа — цифры номера
 * счёта («2026-0007» → 20260007).
 */
export function finnishReference(base: string): string {
  const digits = base.replace(/\D/g, '').replace(/^0+/, '') || '1';
  const padded = digits.length < 3 ? digits.padStart(3, '1') : digits;
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < padded.length; i++) {
    sum += Number(padded[padded.length - 1 - i]) * weights[i % 3];
  }
  const check = (10 - (sum % 10)) % 10;
  return `${padded}${check}`;
}

/**
 * Международная ссылка платежа RF (ISO 11649) из финской: «RF» + две
 * контрольные цифры (mod 97, как у IBAN) + сама ссылка. Её понимают банки
 * всех стран SEPA; финский viitenumero — только финские (аудит 21.11.2026).
 */
export function rfReference(base: string): string {
  const ref = finnishReference(base);
  /* «RF00» в конец, буквы → числа (R = 27, F = 15), остаток от деления на 97. */
  let rest = 0;
  for (const ch of `${ref}271500`) rest = (rest * 10 + Number(ch)) % 97;
  return `RF${String(98 - rest).padStart(2, '0')}${ref}`;
}

/** Ссылка платежа по стране продавца: финскому — viitenumero, остальным — RF. */
export function paymentReference(base: string, sellerCountry: string | null | undefined): string {
  return (sellerCountry ?? 'FI').toUpperCase() === 'FI' ? finnishReference(base) : rfReference(base);
}

export type InvoiceDay = {
  day: string;
  driver: string;
  plate: string;
  minutes: number;
  loads: number;
  netKg: number;
};

export type InvoiceLine = {
  date: string;
  text: string;
  /** Количество: часы (две цифры после запятой), рейсы или тонны. */
  quantity: number;
  unit: 'h' | 'kuorma' | 't';
  unitCents: number;
  amountCents: number;
};

/** Одна строка на день водителя — так прораб и бухгалтерия сверяют с подтверждёнными днями. */
export function invoiceLines(pricing: Pricing, rateCents: number, days: readonly InvoiceDay[]): InvoiceLine[] {
  return days.map((d) => {
    const text = [d.driver, d.plate].filter(Boolean).join(' · ');
    switch (pricing) {
      case 'HOUR':
        return {
          date: d.day,
          text,
          quantity: Math.round((d.minutes / 60) * 100) / 100,
          unit: 'h',
          unitCents: rateCents,
          amountCents: Math.round((d.minutes * rateCents) / 60),
        };
      case 'LOAD':
        return { date: d.day, text, quantity: d.loads, unit: 'kuorma', unitCents: rateCents, amountCents: d.loads * rateCents };
      case 'TONNE':
        return {
          date: d.day,
          text,
          quantity: Math.round(d.netKg / 10) / 100,
          unit: 't',
          unitCents: rateCents,
          amountCents: Math.round((d.netKg * rateCents) / 1000),
        };
    }
  });
}

export type InvoiceTotals = { netCents: number; vatBps: number; vatCents: number; totalCents: number };

/**
 * Общая ставка НДС страны перевозчика, в базисных пунктах. Перевозчик и
 * клиент на объекте из одной страны (финская фирма — финской), поэтому
 * счёт всегда с обычным НДС продавца, без обратного начисления.
 */
export const STANDARD_VAT_BPS: Readonly<Record<string, number>> = {
  FI: 2550,
  SE: 2500,
  NO: 2500,
  DK: 2500,
  EE: 2400,
  LV: 2100,
  LT: 2100,
  PL: 2300,
  DE: 1900,
  RO: 2100,
};

export function standardVatBps(country: string | null | undefined): number | null {
  return country ? (STANDARD_VAT_BPS[country] ?? null) : null;
}

/** Итог: сумма строк и НДС по ставке страны перевозчика. */
export function invoiceTotals(lines: readonly InvoiceLine[], vatBps: number): InvoiceTotals {
  const netCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const vatCents = Math.round((netCents * vatBps) / 10_000);
  return { netCents, vatBps, vatCents, totalCents: netCents + vatCents };
}

/**
 * Пора ли выставлять по расписанию. Понедельник: WEEKLY — каждый,
 * BIWEEKLY — по чётным неделям ISO. MANUAL — только кнопкой.
 */
export function invoiceDue(schedule: string, mondayIso: string): boolean {
  if (schedule === 'WEEKLY') return true;
  if (schedule !== 'BIWEEKLY') return false;
  return isoWeek(mondayIso) % 2 === 0;
}

export function isoWeek(dateIso: string): number {
  const d = new Date(`${dateIso}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}
