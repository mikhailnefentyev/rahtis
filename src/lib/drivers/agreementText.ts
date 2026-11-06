import type { Format } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n';
import type { ReportAgreement } from './report';

/**
 * Договорённость против законной схемы → строки «подпись: сумма» для
 * экрана и PDF. Одна функция, чтобы экран и файл не разошлись.
 */
export function agreementLines(
  a: ReportAgreement,
  i18n: { t: Dictionary; f: Pick<Format, 'money' | 'decimal'> },
): Array<{ label: string; value: string; strong?: boolean }> {
  const { t, f } = i18n;
  const g = t.agreed;
  const cur = a.result.currency;
  const money = (cents: number) => f.money(cents, cur);
  const agreed =
    a.model === 'MONTHLY_NET'
      ? `${money(a.result.agreedNetCents)} (${money(a.agreement.monthlyCents ?? 0)} × ${f.decimal(a.months, 2)} ${g.perMonth})`
      : money(a.result.agreedNetCents);
  const lines: Array<{ label: string; value: string; strong?: boolean }> = [{ label: g.agreedNet, value: agreed, strong: true }];
  const legal = a.result.legal;
  if (!legal) return lines;
  lines.push(
    { label: g.baseGross, value: money(legal.baseGrossCents) },
    { label: g.baseNet, value: money(legal.baseNetCents) },
    { label: g.taxFree, value: money(legal.taxFreeCents) },
    { label: g.gapNet, value: money(legal.gapNetCents) },
    { label: g.gapGross, value: money(legal.gapGrossCents) },
    { label: g.gapEmployer, value: money(legal.gapEmployerCents) },
    { label: g.employerTotal, value: money(legal.employerTotalCents), strong: true },
  );
  return lines;
}

/** Заголовок отрезка: модель и даты. */
export function agreementTitle(
  a: ReportAgreement,
  i18n: { t: Dictionary; f: Pick<Format, 'date'> },
): string {
  const { t, f } = i18n;
  return `${t.payModel[a.model]} · ${f.date(`${a.from}T12:00:00Z`)}–${f.date(`${a.to}T12:00:00Z`)}`;
}
