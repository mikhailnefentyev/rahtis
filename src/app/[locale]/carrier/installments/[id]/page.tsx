import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TruckPhoto } from '@/components/domain/TruckPhoto';
import { Badge, Button, Card, CardBody, buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import {
  cancelDealAction,
  cancelWithCreditAction,
  markFirstPaidAction,
  markPaidAction,
  retryCreditNoteAction,
  retryFirstInvoiceAction,
} from '@/lib/installments/actions';
import { buildSchedule, daysBetween, payoffCents, remedyAllowed, thresholds, type VatMode } from '@/lib/installments/calc';
import { dealVehicle, helsinkiDay, loadDeal } from '@/lib/installments/contract';
import { fill, installmentUiCopy } from '@/lib/installments/copy';
import { todayInHelsinki } from '@/lib/dates';
import { isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { installmentCopy } from '@/lib/landing/installment';
import { DealResponse } from '../DealForms';
import { HandoverForm } from '../HandoverForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: installmentUiCopy(locale).deal.title };
}

const euros = (cents: number | null) => (cents == null ? '' : String(cents / 100));
const fiDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
};

/**
 * Сделка рассрочки (22.11.2026): текущие условия и расчёт, ответ второй
 * стороне (принять увиденную версию или предложить свои), после согласия
 * — договор, первый счёт и что сделать до передачи машины.
 */
export default async function DealPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, 'CARRIER');
  const me = viewer.company!.id;
  const loaded = await loadDeal(id);
  if (!loaded) notFound();
  const { deal, seller, buyer, invoice } = loaded;
  const vehicle = dealVehicle(loaded);
  const ui = installmentUiCopy(locale);
  const calc = installmentCopy(locale);
  const isSeller = deal.seller_company_id === me;
  const owner = viewer.status === 'ready' && viewer.profile.member_kind !== 'DISPATCHER';

  const schedule = buildSchedule({
    priceCents: deal.price_cents,
    vatMode: deal.vat_mode as VatMode,
    vatBps: deal.vat_bps,
    downPaymentCents: deal.down_payment_cents,
    months: deal.months,
    finalCents: deal.final_cents,
    annualRateBps: deal.annual_rate_bps,
    handoverDate: deal.handover_date,
    firstDueDate: deal.first_due_date,
  });
  const money = new Intl.NumberFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const eur = (cents: number) => money.format(cents / 100);
  const limits = 'error' in schedule ? null : thresholds(schedule);

  const rows: [string, string][] = [
    [ui.listing.price, eur(deal.price_cents)],
    [ui.listing.vatMode, calc.f.vatModes[deal.vat_mode as VatMode]],
    [ui.listing.down, eur(deal.down_payment_cents)],
    [ui.listing.months, String(deal.months)],
    [ui.listing.final, deal.final_cents != null ? eur(deal.final_cents) : '—'],
    [ui.listing.rate, `${(deal.annual_rate_bps / 100).toLocaleString(locale === 'fi' ? 'fi-FI' : 'en-GB')} %`],
    [ui.deal.handover, fiDate(deal.handover_date)],
    [ui.deal.firstDue, fiDate(deal.first_due_date)],
  ];
  if (!('error' in schedule)) {
    rows.push([calc.r.firstInvoice, eur(schedule.firstInvoiceCents)], [calc.r.priceWithVat, eur(schedule.installmentPriceCents)]);
  }

  /* Этап 3: график, сводка по машине, кредит-нота. */
  const supabase = await createClient();
  const today = todayInHelsinki();
  const [{ data: payments }, { data: vehicleStatus }, { data: credit }] = await Promise.all([
    supabase.from('installment_payments').select('*').eq('deal_id', deal.id).order('n'),
    deal.buyer_vehicle_id ? supabase.rpc('installment_vehicle_status', { p_deal_id: deal.id }) : Promise.resolve({ data: null }),
    deal.credit_note_id
      ? supabase.from('carrier_invoices').select('id, number, file_path').eq('id', deal.credit_note_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const { data: payInvoices } = (payments ?? []).some((p) => p.invoice_id)
    ? await supabase
        .from('carrier_invoices')
        .select('id, number, file_path')
        .in('id', (payments ?? []).map((p) => p.invoice_id).filter((v): v is string => Boolean(v)))
    : { data: [] as { id: string; number: string; file_path: string | null }[] };
  const invoiceById = new Map((payInvoices ?? []).map((i) => [i.id, i]));
  const unpaid = (payments ?? []).filter((p) => !p.paid_at);
  const overdue = unpaid.filter((p) => p.due_date < today);
  const priceGross = 'error' in schedule ? deal.price_cents : schedule.installmentPriceCents;
  const remedy =
    deal.status === 'ACTIVE' &&
    remedyAllowed(
      overdue.map((p) => ({ dueDate: p.due_date, unpaidCents: p.principal_cents })),
      today,
      priceGross,
      unpaid.reduce((sum, p) => sum + p.principal_cents, 0),
    );
  const lastPaid = (payments ?? []).filter((p) => p.paid_at).map((p) => p.due_date).sort().pop() ?? deal.handover_date;
  const payoff = payoffCents(unpaid.reduce((sum, p) => sum + p.principal_cents, 0), lastPaid < today ? lastPaid : today, today, deal.annual_rate_bps);
  const vs = vehicleStatus?.[0];
  const dateOf = (iso: string | null) => (iso ? fiDate(helsinkiDay(iso)) : '');

  /* Почему счёта нет или он не дошёл — те же проверки, что у создания (firstInvoice.ts). */
  const invoiceReady = Boolean(invoice?.file_path);
  const invoiceReason = invoice
    ? ui.invoiceReasons.UNSENT
    : !seller.iban
      ? ui.invoiceReasons.NO_IBAN
      : !(buyer.billing_email || buyer.contact_email)
        ? ui.invoiceReasons.NO_EMAIL
        : ui.invoiceReasons.IBAN_RECENT;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {ui.deal.title} · {vehicle.plate}
          </h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            {ui.deal.seller}: {seller.legal_name || seller.name} · {ui.deal.buyer}: {buyer.legal_name || buyer.name}
          </p>
        </div>
        <Badge tone={deal.status === 'AGREED' || deal.status === 'ACTIVE' ? 'ok' : deal.status === 'NEGOTIATING' ? 'warn' : deal.status === 'PAID_OFF' ? 'info' : 'neutral'}>
          {ui.status[deal.status]}
        </Badge>
      </header>

      <Card>
        <CardBody className="grid gap-5 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <TruckPhoto make={vehicle.make} vehicleClass={vehicle.vehicleClass} plate={vehicle.plate} country={seller.country} sizes="(min-width: 768px) 360px, 100vw" />
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[17px] font-semibold">{ui.deal.terms}</h2>
              <span className="font-mono text-[12px] text-ink-faint">{fill(ui.deal.version, { n: String(deal.version) })}</span>
            </div>
            <dl className="mt-3 grid gap-1.5 text-[14px]">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line pb-1">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="font-mono">{v}</dd>
                </div>
              ))}
            </dl>
            {limits && (
              <p className="mt-3 text-[13px] text-ink-muted">
                {fill(calc.r.thresholdsText, {
                  tenth: eur(limits.tenthCents),
                  twentieth: eur(limits.twentiethCents),
                  needed: String(limits.installmentsNeeded),
                })}
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      {deal.status === 'NEGOTIATING' && owner && (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <p className="text-[14px]">{deal.proposed_by === me ? ui.deal.proposedByMe : ui.deal.proposedByThem}</p>
            <DealResponse
              locale={locale}
              ui={ui}
              calc={calc}
              dealId={deal.id}
              version={deal.version}
              canAccept={deal.proposed_by !== me}
              defaults={{
                price: euros(deal.price_cents),
                vatMode: deal.vat_mode as VatMode,
                vatBps: deal.vat_bps,
                down: euros(deal.down_payment_cents),
                months: String(deal.months),
                final: euros(deal.final_cents),
                rate: String(deal.annual_rate_bps / 100),
                handover: deal.handover_date,
                firstDue: deal.first_due_date,
              }}
            />
            <form action={cancelDealAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="deal_id" value={deal.id} />
              <Button type="submit" size="sm" variant="danger">
                {ui.deal.cancelConfirm}
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {deal.status === 'AGREED' && (
        <Card>
          <CardBody className="flex flex-col gap-3 text-[14px]">
            <p className="font-semibold">
              {fill(ui.deal.agreed, { date: deal.agreed_at ? fiDate(helsinkiDay(deal.agreed_at)) : '', number: deal.contract_number ?? '' })}
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={`/${locale}/carrier/installments/${deal.id}/contract`} className={buttonClass({ variant: 'primary', size: 'sm' })}>
                {ui.deal.contract}
              </a>
              {invoice?.file_path && (
                <a href={`/${locale}/carrier/installments/${deal.id}/invoice`} className={buttonClass({ size: 'sm' })}>
                  {ui.deal.invoice} · {invoice.number}
                </a>
              )}
            </div>
            <p className="text-ink-muted">{ui.deal.contractHint}</p>
            {!invoiceReady && (
              <div className="rounded-card border border-warn/35 bg-warn/10 px-3 py-2 text-warn">
                <p>{fill(ui.deal.invoiceMissing, { reason: invoiceReason })}</p>
                {isSeller && owner && (
                  <form action={retryFirstInvoiceAction} className="mt-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="deal_id" value={deal.id} />
                    <Button type="submit" size="sm">
                      {ui.deal.invoice}
                    </Button>
                  </form>
                )}
              </div>
            )}
            <p>{ui.deal.nextSteps}</p>
            {invoice && (
              <div className="flex flex-wrap items-center gap-3">
                <p className={deal.first_invoice_paid_at ? 'text-ok' : 'text-warn'}>
                  {deal.first_invoice_paid_at ? fill(ui.stage3.firstPaid, { date: dateOf(deal.first_invoice_paid_at) }) : ui.stage3.firstUnpaid}
                </p>
                {!deal.first_invoice_paid_at && isSeller && owner && (
                  <form action={markFirstPaidAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="deal_id" value={deal.id} />
                    <Button type="submit" size="sm" variant="primary">
                      {ui.stage3.markFirstPaid}
                    </Button>
                  </form>
                )}
              </div>
            )}
            {/* После выставленного счёта отмена — только с кредит-нотой продавца. */}
            {owner && invoice && !deal.handover_seller_at && !deal.handover_buyer_at && (isSeller || !deal.first_invoice_paid_at) && (
              <form action={cancelWithCreditAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="deal_id" value={deal.id} />
                <Button type="submit" size="sm" variant="danger">
                  {ui.stage3.cancelCredit}
                </Button>
              </form>
            )}
            {owner && !invoice && (
              <form action={cancelDealAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="deal_id" value={deal.id} />
                <Button type="submit" size="sm" variant="danger">
                  {ui.deal.cancel}
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      )}

      {deal.status === 'AGREED' && deal.first_invoice_paid_at && (
        <Card>
          <CardBody className="flex flex-col gap-3 text-[14px]">
            <h2 className="text-[17px] font-semibold">{ui.stage3.handoverTitle}</h2>
            <p className="text-ink-muted">{ui.stage3.handoverHint}</p>
            {deal.handover_seller_at && <p className="text-ok">{fill(ui.stage3.confirmedSeller, { date: dateOf(deal.handover_seller_at) })}</p>}
            {deal.handover_buyer_at && <p className="text-ok">{fill(ui.stage3.confirmedBuyer, { date: dateOf(deal.handover_buyer_at) })}</p>}
            {owner && !(isSeller ? deal.handover_seller_at : deal.handover_buyer_at) ? (
              <HandoverForm
                locale={locale}
                ui={ui}
                dealId={deal.id}
                odometer={deal.handover_odometer_km != null ? String(deal.handover_odometer_km) : ''}
                notes={deal.handover_notes ?? ''}
              />
            ) : (
              <p>{ui.stage3.waitingOther}</p>
            )}
          </CardBody>
        </Card>
      )}

      {deal.status === 'CANCELLED' && invoice && (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-3 text-[14px]">
            {credit?.file_path ? (
              <a href={`/${locale}/carrier/installments/${deal.id}/invoice?inv=${credit.id}`} className={buttonClass({ size: 'sm' })}>
                {ui.stage3.creditNote} · {credit.number}
              </a>
            ) : (
              <>
                <p className="text-warn">{ui.stage3.creditMissing}</p>
                {isSeller && owner && (
                  <form action={retryCreditNoteAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="deal_id" value={deal.id} />
                    <Button type="submit" size="sm">
                      {ui.stage3.makeCredit}
                    </Button>
                  </form>
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}

      {(deal.status === 'ACTIVE' || deal.status === 'PAID_OFF') && (
        <>
          {deal.status === 'PAID_OFF' && (
            <Card>
              <CardBody className="text-[14px] font-semibold text-ok">{fill(ui.stage3.paidOff, { date: dateOf(deal.paid_off_at) })}</CardBody>
            </Card>
          )}
          {remedy && isSeller && (
            <p className="rounded-card border border-danger/35 bg-danger/10 px-4 py-3 text-[14px] text-danger">{ui.stage3.remedy}</p>
          )}
          {deal.status === 'ACTIVE' && (
          <Card>
            <CardBody className="text-[14px]">
              <h2 className="text-[17px] font-semibold">{ui.stage3.vehicleTitle}</h2>
              {vs?.vehicle_access === 'DRAFT' || vs?.vehicle_access === 'PENDING' ? <p className="mt-1 text-warn">{ui.stage3.vehicleDraft}</p> : null}
              <dl className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {[
                  [ui.stage3.vehicleOdometer, (vs?.odometer_km ?? deal.handover_odometer_km) != null ? `${(vs?.odometer_km ?? deal.handover_odometer_km)!.toLocaleString('fi-FI')} km` : ui.stage3.none],
                  [ui.stage3.vehicleDefects, vs ? `${vs.open_defects}${vs.unsafe_defects ? ` (${ui.stage3.vehicleUnsafe} ${vs.unsafe_defects})` : ''}` : ui.stage3.none],
                  [ui.stage3.vehicleMaintenance, vs ? `${vs.maintenance_overdue} / ${vs.maintenance_soon}` : ui.stage3.none],
                  [ui.stage3.vehicleInspection, vs?.last_inspection_at ? dateOf(vs.last_inspection_at) : ui.stage3.none],
                  [ui.stage3.vehicleDowntime, vs?.downtime_reason ? (ui.stage3.downtime[vs.downtime_reason] ?? vs.downtime_reason) : ui.stage3.none],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line pb-1">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
          )}
          <Card>
            <CardBody className="text-[14px]">
              <h2 className="text-[17px] font-semibold">{ui.stage3.scheduleTitle}</h2>
              {deal.status === 'ACTIVE' && !isSeller && unpaid.length > 0 && (
                <p className="mt-1 text-ink-muted">{fill(ui.stage3.payoff, { sum: eur(payoff) })}</p>
              )}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="text-left text-[13px] text-ink-faint">
                      <th className="py-1.5 pr-3 font-normal">{ui.stage3.colN}</th>
                      <th className="py-1.5 pr-3 font-normal">{ui.stage3.colDue}</th>
                      <th className="py-1.5 pr-3 text-right font-normal">{ui.stage3.colAmount}</th>
                      <th className="py-1.5 pr-3 text-right font-normal">{ui.stage3.colInterest}</th>
                      <th className="py-1.5 pr-3 font-normal">{ui.stage3.colInvoice}</th>
                      <th className="py-1.5 font-normal">{ui.stage3.colStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payments ?? []).map((p) => {
                      const inv = p.invoice_id ? invoiceById.get(p.invoice_id) : null;
                      const late = !p.paid_at && p.due_date < today ? daysBetween(p.due_date, today) : 0;
                      return (
                        <tr key={p.id} className="border-t border-line">
                          <td className="py-1.5 pr-3 font-mono">{p.n}</td>
                          <td className="py-1.5 pr-3 font-mono">{fiDate(p.due_date)}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">{money.format(p.principal_cents / 100)}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">{p.interest_cents > 0 ? money.format(p.interest_cents / 100) : ui.stage3.none}</td>
                          <td className="py-1.5 pr-3">
                            {inv?.file_path ? (
                              <a href={`/${locale}/carrier/installments/${deal.id}/invoice?inv=${inv.id}`} className="font-mono text-accent hover:underline">
                                {inv.number}
                              </a>
                            ) : (
                              ui.stage3.none
                            )}
                          </td>
                          <td className="py-1.5">
                            {p.paid_at ? (
                              <span className="text-ok">{ui.stage3.paid}</span>
                            ) : (
                              <span className="flex flex-wrap items-center gap-2">
                                <span className={late > 0 ? 'text-danger' : 'text-ink-muted'}>
                                  {late > 0 ? fill(ui.stage3.overdue, { days: String(late) }) : ui.stage3.unpaid}
                                </span>
                                {isSeller && owner && deal.status === 'ACTIVE' && (
                                  <form action={markPaidAction}>
                                    <input type="hidden" name="locale" value={locale} />
                                    <input type="hidden" name="deal_id" value={deal.id} />
                                    <input type="hidden" name="n" value={p.n} />
                                    <Button type="submit" size="sm">
                                      {ui.stage3.markPaid}
                                    </Button>
                                  </form>
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      <Link href={`/${locale}/carrier/installments?tab=deals`} className="text-[13px] text-accent hover:underline">
        ‹ {ui.tabs.deals}
      </Link>
    </div>
  );
}
