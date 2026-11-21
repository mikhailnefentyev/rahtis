'use client';

import { useMemo, useState } from 'react';
import { Card, CardBody, Field, Input, Select, Stat } from '@/components/ui';
import { eurosToCents } from '@/lib/economics/money';
import {
  addMonths,
  adviseDownPayment,
  buildSchedule,
  buyerCheck,
  defaultScenario,
  sellerTax,
  thresholds,
  type DealInput,
  type VatMode,
} from '@/lib/installments/calc';
import type { InstallmentCopy } from '@/lib/landing/installment';

/**
 * Калькулятор рассрочки на открытой странице. Всё считается в браузере
 * модулем installments/calc — тем же, что будет в кабинете. Ничего не
 * сохраняется и никуда не отправляется.
 *
 * Значения по умолчанию — пример из документов (DAF 24 000 €). Падение
 * стоимости, расходы на изъятие и порог «малый запас» (15 %) — оценки,
 * которые пользователь меняет сам; поля так и подписаны.
 */

const VAT_BPS = 2550;
const TAX_BPS = 2000;
const THIN_BPS = 1500;

function percentToBps(value: string): number | null {
  const s = value.replace(/\s|%/g, '').replace(',', '.');
  if (!s) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

function firstOfNextMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

export function InstallmentCalculator({ copy, locale }: { copy: InstallmentCopy; locale: string }) {
  const c = copy;
  const money = useMemo(
    () => new Intl.NumberFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
    [locale],
  );
  const eur = (cents: number) => money.format(cents / 100);

  const [price, setPrice] = useState('24000');
  const [vatMode, setVatMode] = useState<VatMode>('STANDARD');
  const [down, setDown] = useState('4800');
  const [months, setMonths] = useState('24');
  const [final, setFinal] = useState('');
  const [rate, setRate] = useState('0');
  const [depreciation, setDepreciation] = useState('15');
  const [costs, setCosts] = useState('1000');
  const [taxMethod, setTaxMethod] = useState<'NONE' | 'POOL' | 'ITEM'>('NONE');
  const [pool, setPool] = useState('');
  const [residual, setResidual] = useState('');
  const [revenue, setRevenue] = useState('');
  const [buyerCosts, setBuyerCosts] = useState('');
  const [handover] = useState(firstOfNextMonth);

  const result = useMemo(() => {
    const priceCents = eurosToCents(price);
    const downCents = eurosToCents(down);
    const finalCents = final.trim() ? eurosToCents(final) : null;
    const rateBps = percentToBps(rate);
    const input: DealInput = {
      priceCents: priceCents ?? 0,
      vatMode,
      vatBps: VAT_BPS,
      downPaymentCents: downCents ?? -1,
      months: Number(months),
      finalCents: finalCents === undefined ? -1 : finalCents,
      annualRateBps: rateBps ?? -1,
      handoverDate: handover,
      firstDueDate: addMonths(handover, 1),
    };
    const schedule = buildSchedule(input);
    if ('error' in schedule) return { error: schedule.error };

    const depBps = percentToBps(depreciation) ?? 0;
    const costsCents = eurosToCents(costs) ?? 0;
    const tax =
      taxMethod === 'POOL' && eurosToCents(pool) != null
        ? sellerTax({ method: 'POOL', poolStartCents: eurosToCents(pool)!, purchasesThisYearCents: 0, priceCents: input.priceCents, rateBps: TAX_BPS })
        : taxMethod === 'ITEM' && eurosToCents(residual) != null
          ? sellerTax({ method: 'ITEM', residualCents: eurosToCents(residual)!, priceCents: input.priceCents, rateBps: TAX_BPS })
          : null;
    /* Взносы, полученные до уплаты налога: грубо — за первые 12 месяцев. */
    const beforeTax = schedule.installments.slice(0, 12).reduce((s, x) => s + x.principalCents, 0);
    const advice = adviseDownPayment({
      priceCents: input.priceCents,
      depreciationBps: depBps,
      repossessionCostsCents: costsCents,
      sellerTaxCents: tax?.taxCents ?? 0,
      installmentsBeforeTaxCents: beforeTax,
    });
    const stops = [3, 6, 12, 18].filter((m) => m < input.months);
    const scenarios = stops.map((m) => defaultScenario(input, schedule, m, depBps, costsCents));

    const rev = eurosToCents(revenue);
    const bc = eurosToCents(buyerCosts);
    const first = schedule.installments[0];
    const buyer =
      rev != null && bc != null && rev > 0
        ? buyerCheck({ revenueCents: rev, costsCents: bc, paymentCents: first.principalCents + first.interestCents, thinBps: THIN_BPS })
        : null;

    return { input, schedule, limits: thresholds(schedule), tax, advice, scenarios, buyer };
  }, [price, vatMode, down, months, final, rate, depreciation, costs, taxMethod, pool, residual, revenue, buyerCosts, handover]);

  const fill = (text: string, values: Record<string, string>) =>
    text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');

  const group = 'label-micro mb-3 text-ink-muted';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card>
        <CardBody className="flex flex-col gap-6">
          <div>
            <p className={group}>{c.groups.deal}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.f.price} hint={c.f.priceHint}>
                {(p) => <Input {...p} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />}
              </Field>
              <Field label={c.f.vatMode}>
                {(p) => (
                  <Select {...p} value={vatMode} onChange={(e) => setVatMode(e.target.value as VatMode)}>
                    {(Object.keys(c.f.vatModes) as VatMode[]).map((k) => (
                      <option key={k} value={k}>
                        {c.f.vatModes[k]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={c.f.down} hint={c.f.downHint}>
                {(p) => <Input {...p} inputMode="decimal" value={down} onChange={(e) => setDown(e.target.value)} />}
              </Field>
              <Field label={c.f.months}>
                {(p) => <Input {...p} inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />}
              </Field>
              <Field label={c.f.final} hint={c.f.finalHint}>
                {(p) => <Input {...p} inputMode="decimal" value={final} onChange={(e) => setFinal(e.target.value)} />}
              </Field>
              <Field label={c.f.rate} hint={c.f.rateHint}>
                {(p) => <Input {...p} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />}
              </Field>
            </div>
          </div>

          <div>
            <p className={group}>{c.groups.assumptions}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.f.depreciation} hint={c.f.depreciationHint}>
                {(p) => <Input {...p} inputMode="decimal" value={depreciation} onChange={(e) => setDepreciation(e.target.value)} />}
              </Field>
              <Field label={c.f.costs} hint={c.f.costsHint}>
                {(p) => <Input {...p} inputMode="decimal" value={costs} onChange={(e) => setCosts(e.target.value)} />}
              </Field>
            </div>
          </div>

          <div>
            <p className={group}>{c.groups.seller}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.f.taxMethod}>
                {(p) => (
                  <Select {...p} value={taxMethod} onChange={(e) => setTaxMethod(e.target.value as 'NONE' | 'POOL' | 'ITEM')}>
                    {(['NONE', 'POOL', 'ITEM'] as const).map((k) => (
                      <option key={k} value={k}>
                        {c.f.taxMethods[k]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {taxMethod === 'POOL' && (
                <Field label={c.f.pool} hint={c.f.poolHint}>
                  {(p) => <Input {...p} inputMode="decimal" value={pool} onChange={(e) => setPool(e.target.value)} />}
                </Field>
              )}
              {taxMethod === 'ITEM' && (
                <Field label={c.f.residual} hint={c.f.residualHint}>
                  {(p) => <Input {...p} inputMode="decimal" value={residual} onChange={(e) => setResidual(e.target.value)} />}
                </Field>
              )}
            </div>
          </div>

          <div>
            <p className={group}>{c.groups.buyer}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.f.revenue}>
                {(p) => <Input {...p} inputMode="decimal" value={revenue} onChange={(e) => setRevenue(e.target.value)} />}
              </Field>
              <Field label={c.f.buyerCosts} hint={c.f.buyerCostsHint}>
                {(p) => <Input {...p} inputMode="decimal" value={buyerCosts} onChange={(e) => setBuyerCosts(e.target.value)} />}
              </Field>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-4" aria-live="polite">
        {'error' in result ? (
          <Card>
            <CardBody>
              <p className="text-danger">{c.errors[result.error as keyof typeof c.errors]}</p>
            </CardBody>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label={c.r.firstInvoice}
                value={eur(result.schedule.firstInvoiceCents)}
                hint={fill(c.r.firstInvoiceHint, { down: eur(result.input.downPaymentCents), vat: eur(result.schedule.vatCents) })}
              />
              <Stat
                label={c.r.monthly}
                value={eur(result.schedule.installments[0].principalCents)}
                hint={result.input.annualRateBps > 0 ? fill(c.r.monthlyHint, { interest: eur(result.schedule.installments[0].interestCents) }) : undefined}
              />
              <Stat
                label={c.r.finalPayment}
                value={eur(result.schedule.installments[result.schedule.installments.length - 1].principalCents)}
              />
              <Stat label={c.r.priceWithVat} value={eur(result.schedule.installmentPriceCents)} />
              {result.schedule.interestTotalCents > 0 && <Stat label={c.r.interestTotal} value={eur(result.schedule.interestTotalCents)} />}
            </div>

            <Card>
              <CardBody>
                <h3 className="font-semibold">{c.r.thresholdsTitle}</h3>
                <p className="mt-2 text-[14px] text-ink-muted">
                  {fill(c.r.thresholdsText, {
                    tenth: eur(result.limits.tenthCents),
                    twentieth: eur(result.limits.twentiethCents),
                    needed: String(result.limits.installmentsNeeded),
                  })}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="font-semibold">{c.r.adviceTitle}</h3>
                <dl className="mt-3 grid gap-1.5 text-[14px]">
                  <Row label={c.r.adviceProtection} value={eur(result.advice.protectionCents)} />
                  {result.tax && <Row label={c.r.adviceTax} value={eur(result.advice.taxGapCents)} />}
                  <Row label={c.r.adviceMarket} value={eur(result.advice.marketCents)} />
                  <Row label={c.r.adviceRecommended} value={eur(result.advice.recommendedCents)} strong />
                </dl>
                {result.input.downPaymentCents < result.advice.recommendedCents && (
                  <p className="mt-3 text-[14px] text-warn">{c.r.adviceLow}</p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="font-semibold">{c.r.taxTitle}</h3>
                {!result.tax ? (
                  <p className="mt-2 text-[14px] text-ink-muted">{c.r.taxUnknown}</p>
                ) : result.tax.taxableCents === 0 ? (
                  <p className="mt-2 text-[14px] text-ink-muted">{c.r.taxNone}</p>
                ) : (
                  <dl className="mt-3 grid gap-1.5 text-[14px]">
                    <Row label={c.r.taxIncome} value={eur(result.tax.taxableCents)} />
                    <Row label={c.r.taxAmount} value={eur(result.tax.taxCents)} strong />
                  </dl>
                )}
              </CardBody>
            </Card>

            {result.scenarios.length > 0 && (
              <Card>
                <CardBody>
                  <h3 className="font-semibold">{c.r.scenarioTitle}</h3>
                  <p className="mt-2 text-[14px] text-ink-muted">{c.r.scenarioText}</p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-[14px]">
                      <thead>
                        <tr className="text-left text-ink-faint">
                          <th className="py-1.5 pr-3 font-normal">{c.r.colStop}</th>
                          <th className="py-1.5 pr-3 text-right font-normal">{c.r.colPaid}</th>
                          <th className="py-1.5 pr-3 text-right font-normal">{c.r.colValue}</th>
                          <th className="py-1.5 pr-3 text-right font-normal">{c.r.colSettlement}</th>
                          <th className="py-1.5 text-right font-normal">{c.r.colSeller}</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {result.scenarios.map((s) => (
                          <tr key={s.paidMonths} className="border-t border-line">
                            <td className="py-1.5 pr-3 font-sans">{fill(c.r.afterMonths, { n: String(s.paidMonths) })}</td>
                            <td className="py-1.5 pr-3 text-right">{eur(s.buyerPaidCents)}</td>
                            <td className="py-1.5 pr-3 text-right">{eur(s.valueCents)}</td>
                            <td className="py-1.5 pr-3 text-right font-sans">
                              {s.settlement.sellerPaysCents > 0
                                ? fill(c.r.sellerPays, { sum: eur(s.settlement.sellerPaysCents) })
                                : s.settlement.buyerPaysCents > 0
                                  ? fill(c.r.buyerPays, { sum: eur(s.settlement.buyerPaysCents) })
                                  : c.r.even}
                            </td>
                            <td className="py-1.5 text-right">{eur(s.sellerTotalCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardBody>
                <h3 className="font-semibold">{c.r.buyerTitle}</h3>
                {!result.buyer ? (
                  <p className="mt-2 text-[14px] text-ink-muted">{c.r.buyerEmpty}</p>
                ) : (
                  <>
                    <dl className="mt-3 grid gap-1.5 text-[14px]">
                      <Row label={c.r.buyerMargin} value={eur(result.buyer.marginCents)} strong />
                    </dl>
                    <p
                      className={`mt-2 text-[14px] ${result.buyer.negative ? 'text-danger' : result.buyer.thin ? 'text-warn' : 'text-ok'}`}
                    >
                      {result.buyer.negative ? c.r.buyerNegative : result.buyer.thin ? c.r.buyerThin : c.r.buyerOk}
                    </p>
                  </>
                )}
              </CardBody>
            </Card>
          </>
        )}
        <p className="text-[13px] text-ink-faint">{c.calcNote}</p>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`font-mono ${strong ? 'font-bold' : ''}`}>{value}</dd>
    </div>
  );
}
