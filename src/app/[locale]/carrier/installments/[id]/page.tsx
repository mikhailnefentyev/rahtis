import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TruckPhoto } from '@/components/domain/TruckPhoto';
import { Badge, Button, Card, CardBody, buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { cancelDealAction, retryFirstInvoiceAction } from '@/lib/installments/actions';
import { buildSchedule, thresholds, type VatMode } from '@/lib/installments/calc';
import { dealVehicle, helsinkiDay, loadDeal } from '@/lib/installments/contract';
import { fill, installmentUiCopy } from '@/lib/installments/copy';
import { isLocale } from '@/lib/i18n';
import { installmentCopy } from '@/lib/landing/installment';
import { DealResponse } from '../DealForms';

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
        <Badge tone={deal.status === 'AGREED' ? 'ok' : deal.status === 'NEGOTIATING' ? 'warn' : 'neutral'}>{ui.status[deal.status]}</Badge>
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
            {/* После выставленного счёта отмена — через кредит-ноту (этап 3), не кнопкой. */}
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

      <Link href={`/${locale}/carrier/installments?tab=deals`} className="text-[13px] text-accent hover:underline">
        ‹ {ui.tabs.deals}
      </Link>
    </div>
  );
}
