'use client';

import { useMemo, useState } from 'react';
import { Field, Input, Select } from '@/components/ui';
import { eurosToCents } from '@/lib/economics/money';
import { addMonths, buildSchedule, thresholds, type VatMode } from '@/lib/installments/calc';
import { fill, type InstallmentUiCopy } from '@/lib/installments/copy';
import type { InstallmentCopy } from '@/lib/landing/installment';

/**
 * Поля условий рассрочки с живым расчётом (22.11.2026): первый счёт
 * (взнос + весь НДС), взнос в месяц и пороги закона о рассрочке (2 §).
 * Расчёт — тем же модулем installments/calc, что проверяет сервер.
 */
export type TermsDefaults = {
  price: string;
  vatMode: VatMode;
  vatBps: number;
  down: string;
  months: string;
  final: string;
  rate: string;
  handover?: string;
  firstDue?: string;
};

export function TermsFields({
  ui,
  calc,
  defaults,
  vatEditable,
  withDates,
  locale,
}: {
  ui: InstallmentUiCopy;
  calc: InstallmentCopy;
  defaults: TermsDefaults;
  vatEditable: boolean;
  withDates: boolean;
  locale: string;
}) {
  const [price, setPrice] = useState(defaults.price);
  const [vatMode, setVatMode] = useState<VatMode>(defaults.vatMode);
  const [down, setDown] = useState(defaults.down);
  const [months, setMonths] = useState(defaults.months);
  const [final, setFinal] = useState(defaults.final);
  const [rate, setRate] = useState(defaults.rate);
  const [handover, setHandover] = useState(defaults.handover ?? '');
  const [firstDue, setFirstDue] = useState(defaults.firstDue ?? '');

  const money = useMemo(
    () => new Intl.NumberFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
    [locale],
  );
  const eur = (cents: number) => money.format(cents / 100);

  const result = useMemo(() => {
    const p = eurosToCents(price);
    const d = down.trim() ? eurosToCents(down) : 0;
    const fin = final.trim() ? eurosToCents(final) : null;
    const r = rate.replace(/\s|%/g, '').replace(',', '.');
    const rateBps = r ? (/^\d+(\.\d{1,2})?$/.test(r) ? Math.round(Number(r) * 100) : -1) : 0;
    const h = withDates && handover ? handover : '2099-01-01';
    const s = buildSchedule({
      priceCents: p ?? 0,
      vatMode,
      vatBps: defaults.vatBps,
      downPaymentCents: d ?? -1,
      months: Number(months),
      finalCents: fin === undefined ? -1 : fin,
      annualRateBps: rateBps,
      handoverDate: h,
      firstDueDate: withDates && firstDue ? firstDue : addMonths(h, 1),
    });
    return 'error' in s ? { error: s.error } : { s, t: thresholds(s) };
  }, [price, vatMode, down, months, final, rate, handover, firstDue, withDates, defaults.vatBps]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="vat_bps" value={defaults.vatBps} />
        <Field label={ui.listing.price}>
          {(p) => <Input {...p} name="price" inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} />}
        </Field>
        <Field label={ui.listing.vatMode}>
          {(p) =>
            vatEditable ? (
              <Select {...p} name="vat_mode" value={vatMode} onChange={(e) => setVatMode(e.target.value as VatMode)}>
                {(Object.keys(calc.f.vatModes) as VatMode[]).map((k) => (
                  <option key={k} value={k}>
                    {calc.f.vatModes[k]}
                  </option>
                ))}
              </Select>
            ) : (
              <>
                <input type="hidden" name="vat_mode" value={vatMode} />
                <Input {...p} readOnly value={calc.f.vatModes[vatMode]} />
              </>
            )
          }
        </Field>
        <Field label={ui.listing.down} hint={calc.f.downHint}>
          {(p) => <Input {...p} name="down" inputMode="decimal" value={down} onChange={(e) => setDown(e.target.value)} />}
        </Field>
        <Field label={ui.listing.months}>
          {(p) => <Input {...p} name="months" inputMode="numeric" required value={months} onChange={(e) => setMonths(e.target.value)} />}
        </Field>
        <Field label={ui.listing.final}>
          {(p) => <Input {...p} name="final" inputMode="decimal" value={final} onChange={(e) => setFinal(e.target.value)} />}
        </Field>
        <Field label={ui.listing.rate} hint={calc.f.rateHint}>
          {(p) => <Input {...p} name="rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />}
        </Field>
        {withDates && (
          <>
            <Field label={ui.deal.handover}>
              {(p) => <Input {...p} type="date" name="handover" required value={handover} onChange={(e) => setHandover(e.target.value)} />}
            </Field>
            <Field label={ui.deal.firstDue}>
              {(p) => <Input {...p} type="date" name="first_due" required value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />}
            </Field>
          </>
        )}
      </div>

      <div className="rounded-card border border-line bg-sunken p-4 text-[14px]" aria-live="polite">
        <p className="label-micro mb-3">{ui.deal.calc}</p>
        {'error' in result ? (
          <p className="text-danger">{calc.errors[result.error as keyof typeof calc.errors]}</p>
        ) : (
          <dl className="grid gap-2">
            <Row label={calc.r.firstInvoice} value={eur(result.s.firstInvoiceCents)} strong />
            <Row label={calc.r.monthly} value={eur(result.s.installments[0].principalCents)} />
            <Row label={calc.r.finalPayment} value={eur(result.s.installments[result.s.installments.length - 1].principalCents)} />
            {result.s.interestTotalCents > 0 && <Row label={calc.r.interestTotal} value={eur(result.s.interestTotalCents)} />}
            <Row label={calc.r.priceWithVat} value={eur(result.s.installmentPriceCents)} />
            <p className="mt-2 text-[13px] text-ink-muted">
              {fill(calc.r.thresholdsText, {
                tenth: eur(result.t.tenthCents),
                twentieth: eur(result.t.twentiethCents),
                needed: String(result.t.installmentsNeeded),
              })}
            </p>
          </dl>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`font-mono ${strong ? 'font-bold' : ''}`}>{value}</dd>
    </div>
  );
}
