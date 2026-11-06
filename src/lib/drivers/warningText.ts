import type { Format } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n';
import type { MessageFn } from '@/lib/i18n/message';
import type { ReportWarning } from './report';

/**
 * Предупреждение отчёта по водителям → текст для экрана и PDF.
 * Суммы — в валюте предупреждения, месяц — словами на языке кабинета.
 */
export function warningText(w: ReportWarning, i18n: { t: Dictionary; m: MessageFn; f: Pick<Format, 'money'> }): string {
  const { t, m, f } = i18n;
  const month = (value: string) =>
    new Intl.DateTimeFormat(t.meta.intl, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}-01T12:00:00Z`));
  const set = w.set ?? '';
  switch (w.code) {
    case 'NO_COUNTRY':
      return m('dayPay.warn.NO_COUNTRY', { days: w.days });
    case 'NO_RATE':
      return m('dayPay.warn.NO_RATE', {
        set,
        countries: w.countries.join(', '),
      });
    case 'PL_INTL_IS_WAGE':
      return m('dayPay.warn.PL_INTL_IS_WAGE');
    case 'PL_ZUS_RELIEF':
      return m('dayPay.warn.PL_ZUS_RELIEF', {
        days: w.days,
        amount: f.money(w.eurCents, 'EUR'),
      });
    case 'EE_LATER_RATE':
      return m('dayPay.warn.EE_LATER_RATE', { days: w.days });
    case 'LV_CAP':
      return m('dayPay.warn.LV_CAP', {
        month: month(w.month),
        amount: f.money(w.excessCents, w.currency),
      });
    case 'LT_TAXABLE':
      return m('dayPay.warn.LT_TAXABLE', {
        month: month(w.month),
        amount: f.money(w.taxableCents, w.currency),
      });
    case 'OUTPUT_PAY':
      return m('dayPay.warn.OUTPUT_PAY');
    case 'BELOW_MINIMUM':
      return m('dayPay.warn.BELOW_MINIMUM', {
        month: month(w.month),
        wage: f.money(w.wageCents, w.currency),
        min: f.money(w.minCents, w.currency),
      });
    case 'LEGALITY':
      return m(w.level === 'GREY' ? 'dayPay.warn.LEGALITY_GREY' : 'dayPay.warn.LEGALITY_NON_COMPLIANT', { set });
  }
}

/** Тон: незаконный набор, оплата только за км и ниже минимума — красным, остальное — жёлтым. */
export function warningTone(w: ReportWarning): 'danger' | 'warn' {
  return w.code === 'OUTPUT_PAY' || w.code === 'BELOW_MINIMUM' || (w.code === 'LEGALITY' && w.level === 'NON_COMPLIANT')
    ? 'danger'
    : 'warn';
}
