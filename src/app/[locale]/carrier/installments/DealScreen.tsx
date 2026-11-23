import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TruckPhoto } from '@/components/domain/TruckPhoto';
import { Badge, Card, CardBody, buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import {
  cancelDealAction,
  cancelWithCreditAction,
  markFirstPaidAction,
  markPaidAction,
  retryCreditNoteAction,
  retryFirstInvoiceAction,
} from '@/lib/installments/actions';
import { dealBadgeTone, installmentsBase, type InstallmentCabinet } from '@/lib/installments/access';
import {
  buildSchedule,
  effectiveHandover,
  overduePayments,
  payoffCents,
  terminationSummary,
  type VatMode,
} from '@/lib/installments/calc';
import { dealTermination, dealVehicle, loadDeal } from '@/lib/installments/contract';
import { fill, installmentUiCopy } from '@/lib/installments/copy';
import { installmentCurrency, installmentDay, installmentMoney, installmentToday } from '@/lib/installments/countries';
import { installmentRules } from '@/lib/installments/rules';
import { isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { installmentCopy } from '@/lib/landing/installment';
import { ActionForm } from './ActionForm';
import { DealResponse } from './DealForms';
import { HandoverForm } from './HandoverForm';
import { LegalNotice } from './LegalNotice';
import { TerminateForm } from './TerminateForm';

export async function dealMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
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
 *
 * Сделку в рассрочке продавец может прекратить (22.11.2026): забрал машину
 * по закону или стороны договорились. После этого обе стороны видят дату,
 * причину, пояснение и справку о платежах; договор и счета остаются.
 * Взаиморасчёт (tilitys) RAHTIS не считает — только напоминает, чьё это дело.
 *
 * Один экран на два кабинета (23.11.2026): продавцом может быть компания
 * без парка, и сделку она открывает у себя (/shipper/installments), а
 * покупатель-перевозчик — у себя. role — кабинет, из которого открыта
 * страница; ссылки строятся от него.
 */
export async function DealScreen({
  params,
  role,
}: {
  params: Promise<{ locale: string; id: string }>;
  role: InstallmentCabinet;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, role);
  const home = `/${locale}${installmentsBase(role)}`;
  const me = viewer.company!.id;
  const loaded = await loadDeal(id);
  if (!loaded) notFound();
  const { deal, seller, buyer, invoice } = loaded;
  const vehicle = dealVehicle(loaded);
  /*
   * Тексты — про право страны сделки, то есть страны продавца (23.11.2026):
   * у эстонской и латвийской сделки свои пороги, чек-лист передачи, порядок
   * после оплаты и смысл записи о прекращении. У финской — как было.
   */
  const ui = installmentUiCopy(locale, seller.country);
  const calc = installmentCopy(locale);
  /* Дни (согласие, оплата, передача) — по часовому поясу страны сделки; у Финляндии — Хельсинки. */
  const helsinkiDay = (iso: string) => installmentDay(seller.country, iso);
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
  /*
   * Валюта сделки — страны продавца (23.11.2026), без пересчёта; до миграции
   * 20261128100000 столбца нет — валюта страны продавца из её пакета.
   * Целые суммы без копеек, дробные — с копейками (19 000 / 24 = 791,67 €).
   */
  const currency = deal.currency ?? installmentCurrency(seller.country);
  const eur = installmentMoney(locale, currency);
  /* Пороги и право изъятия — по правилам страны сделки (сейчас только финский закон о рассрочке). */
  const rules = installmentRules(seller.country);
  const limits = 'error' in schedule || !rules ? null : rules.thresholds(schedule);

  /* Этап 3: график, сводка по машине, кредит-нота. */
  const supabase = await createClient();
  const today = installmentToday(seller.country);
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
        .select('id, number, file_path, sent_at')
        .in('id', (payments ?? []).map((p) => p.invoice_id).filter((v): v is string => Boolean(v)))
    : { data: [] as { id: string; number: string; file_path: string | null; sent_at: string | null }[] };
  const invoiceById = new Map((payInvoices ?? []).map((i) => [i.id, i]));
  const unpaid = (payments ?? []).filter((p) => !p.paid_at);
  /*
   * Просрочка — тем же правилом, что у ежедневного задания (calc.ts
   * overduePayments, 22.11.2026): только по отправленному счёту и от срока
   * или дня отправки, что позже. Раньше страница считала просроченным
   * любой неоплаченный взнос после срока и показывала порог раньше задания.
   */
  const overdue = overduePayments(
    (payments ?? []).map((p) => {
      const sentAt = p.invoice_id ? invoiceById.get(p.invoice_id)?.sent_at : null;
      return { ...p, dueDate: p.due_date, paid: Boolean(p.paid_at), invoiceSentDay: sentAt ? helsinkiDay(sentAt) : null };
    }),
    today,
  );
  const lateById = new Map(overdue.map((p) => [p.id, p.lateDays]));
  const priceGross = 'error' in schedule ? deal.price_cents : schedule.installmentPriceCents;
  const remedy =
    deal.status === 'ACTIVE' &&
    rules !== null &&
    rules.remedyAllowed(
      overdue.map((p) => ({ dueDate: p.lateFrom, unpaidCents: p.principal_cents })),
      today,
      priceGross,
      unpaid.reduce((sum, p) => sum + p.principal_cents, 0),
    );
  /* Проценты идут с фактической передачи, если она позже согласованной, — как сдвинут график (payments.ts ensureSchedule). */
  const interestFrom = effectiveHandover(deal.handover_date, deal.handed_over_at ? helsinkiDay(deal.handed_over_at) : null);
  const lastPaid = (payments ?? []).filter((p) => p.paid_at).map((p) => p.due_date).sort().pop() ?? interestFrom;
  const payoff = payoffCents(unpaid.reduce((sum, p) => sum + p.principal_cents, 0), lastPaid < today ? lastPaid : today, today, deal.annual_rate_bps);
  const vs = vehicleStatus?.[0];

  /* Прекращённая сделка: что уплачено и что осталось — справка, без стоимости машины (её RAHTIS не знает). */
  const terminated = deal.status === 'TERMINATED';
  const termination = dealTermination(deal);
  const summary = terminationSummary({
    priceCents: deal.price_cents,
    vatMode: deal.vat_mode as VatMode,
    vatBps: deal.vat_bps,
    downPaymentCents: deal.down_payment_cents,
    firstInvoicePaid: Boolean(deal.first_invoice_paid_at),
    payments: (payments ?? []).map((p) => ({
      principalCents: p.principal_cents,
      interestCents: p.interest_cents,
      paid: Boolean(p.paid_at),
      invoiced: Boolean(p.invoice_id),
    })),
  });
  const dateOf = (iso: string | null) => (iso ? fiDate(helsinkiDay(iso)) : '');

  /* Срок первого взноса — фактический, как только график построен: при поздней передаче он сдвинут. */
  const rows: [string, string][] = [
    [ui.listing.price, eur(deal.price_cents)],
    [ui.listing.vatMode, calc.f.vatModes[deal.vat_mode as VatMode]],
    [ui.listing.down, eur(deal.down_payment_cents)],
    [ui.listing.months, String(deal.months)],
    [ui.listing.final, deal.final_cents != null ? eur(deal.final_cents) : '—'],
    [ui.listing.rate, `${(deal.annual_rate_bps / 100).toLocaleString(locale === 'en' ? 'en-GB' : locale)} %`],
    [ui.deal.handover, fiDate(deal.handover_date)],
    [ui.deal.firstDue, fiDate(payments?.[0]?.due_date ?? deal.first_due_date)],
  ];
  if (!('error' in schedule)) {
    rows.push([calc.r.firstInvoice, eur(schedule.firstInvoiceCents)], [calc.r.priceWithVat, eur(schedule.installmentPriceCents)]);
  }
  const hidden = { locale, deal_id: deal.id };

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
    <main className="cab-page flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">
            {ui.deal.title} · {vehicle.plate}
          </h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            {ui.deal.seller}: {seller.legal_name || seller.name} · {ui.deal.buyer}: {buyer.legal_name || buyer.name}
          </p>
        </div>
        <Badge tone={dealBadgeTone(deal.status)}>{ui.status[deal.status] ?? deal.status}</Badge>
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
                {fill(ui.country?.thresholdsText ?? calc.r.thresholdsText, {
                  tenth: eur(limits.tenthCents),
                  twentieth: eur(limits.twentiethCents),
                  needed: String(limits.installmentsNeeded),
                })}
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Оговорка о договоре — пока его не подписали: в переговорах и после согласия. */}
      {(deal.status === 'NEGOTIATING' || deal.status === 'AGREED') && <LegalNotice ui={ui} locale={locale} />}

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
                currency,
                rules: rules?.id ?? null,
                down: euros(deal.down_payment_cents),
                months: String(deal.months),
                final: euros(deal.final_cents),
                rate: String(deal.annual_rate_bps / 100),
                handover: deal.handover_date,
                firstDue: deal.first_due_date,
              }}
            />
            <ActionForm action={cancelDealAction} fields={hidden} label={ui.deal.cancelConfirm} variant="danger" />
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
              <a href={`${home}/${deal.id}/contract`} className={buttonClass({ variant: 'primary', size: 'sm' })}>
                {ui.deal.contract}
              </a>
              {invoice?.file_path && (
                <a href={`${home}/${deal.id}/invoice`} className={buttonClass({ size: 'sm' })}>
                  {ui.deal.invoice} · {invoice.number}
                </a>
              )}
            </div>
            <p className="text-ink-muted">{ui.deal.contractHint}</p>
            {/* Счёт в PDF и электронный счёт страны — оговорка только у сделок не из Финляндии. */}
            {ui.country && <p className="text-ink-muted">{ui.country.invoiceNote}</p>}
            {!invoiceReady && (
              <div className="rounded-card border border-warn/35 bg-warn/10 px-3 py-2 text-warn">
                <p>{fill(ui.deal.invoiceMissing, { reason: invoiceReason })}</p>
                {isSeller && owner && (
                  <ActionForm action={retryFirstInvoiceAction} fields={hidden} label={ui.deal.invoice} className="mt-2" />
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
                  <ActionForm action={markFirstPaidAction} fields={hidden} label={ui.stage3.markFirstPaid} variant="primary" />
                )}
              </div>
            )}
            {/*
              * После выставленного счёта отмена — только с кредит-нотой и только продавцом (22.11.2026):
              * оплату отмечает он, и кредит-нота от его имени не должна выйти «ничего не оплачено»
              * по кнопке покупателя.
              */}
            {owner && isSeller && invoice && !deal.handover_seller_at && !deal.handover_buyer_at && (
              <ActionForm action={cancelWithCreditAction} fields={hidden} label={ui.stage3.cancelCredit} variant="danger" />
            )}
            {owner && !invoice && <ActionForm action={cancelDealAction} fields={hidden} label={ui.deal.cancel} variant="danger" />}
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
                notes={(isSeller ? deal.handover_notes : deal.handover_buyer_notes) ?? ''}
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
            {invoice.file_path && (
              <a href={`${home}/${deal.id}/invoice`} className={buttonClass({ size: 'sm' })}>
                {ui.deal.invoice} · {invoice.number}
              </a>
            )}
            {credit?.file_path ? (
              <a href={`${home}/${deal.id}/invoice?inv=${credit.id}`} className={buttonClass({ size: 'sm' })}>
                {ui.stage3.creditNote} · {credit.number}
              </a>
            ) : (
              <>
                <p className="text-warn">{ui.stage3.creditMissing}</p>
                {isSeller && owner && (
                  <ActionForm action={retryCreditNoteAction} fields={hidden} label={ui.stage3.makeCredit} />
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}

      {(deal.status === 'ACTIVE' || deal.status === 'PAID_OFF' || terminated) && (
        <>
          {terminated && (
            <Card>
              <CardBody className="flex flex-col gap-3 text-[14px]">
                <p className="font-semibold text-danger">{fill(ui.termination.done, { date: dateOf(termination.at) })}</p>
                <dl className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-4 border-b border-line pb-1">
                    <dt className="text-ink-muted">{ui.termination.reason}</dt>
                    <dd>{termination.reason ? (ui.termination.reasons[termination.reason] ?? termination.reason) : ui.stage3.none}</dd>
                  </div>
                </dl>
                {termination.note && (
                  <div>
                    <p className="text-ink-muted">{ui.termination.sellerNote}</p>
                    <p className="whitespace-pre-line">{termination.note}</p>
                  </div>
                )}
                <p>{ui.termination.stopped}</p>
                {/* Продавцу без парка машина возвращается в его машины на продажу, а не в парк (23.11.2026). */}
                <p className="text-ink-muted">
                  {!isSeller
                    ? ui.termination.vehicleBuyer
                    : seller.kind === 'CARRIER'
                      ? ui.termination.vehicleSeller
                      : ui.termination.vehicleSellerOwn}
                </p>
                <h2 className="mt-2 text-[17px] font-semibold">{ui.termination.summaryTitle}</h2>
                <dl className="grid gap-1.5">
                  {(
                    [
                      [ui.termination.paidFirst, summary.firstInvoicePaidCents],
                      [ui.termination.paidInstallments, summary.installmentsPaidCents],
                      [ui.termination.paidInterest, summary.interestPaidCents],
                      [ui.termination.paidTotal, summary.paidTotalCents],
                      [ui.termination.invoicedUnpaid, summary.invoicedUnpaidCents],
                      [ui.termination.notInvoiced, summary.notInvoicedCents],
                    ] as [string, number][]
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line pb-1">
                      <dt className="text-ink-muted">{k}</dt>
                      <dd className="font-mono">{eur(v)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-ink-muted">{ui.termination.valueUnknown}</p>
                <p>{ui.termination.settlement}</p>
              </CardBody>
            </Card>
          )}
          {deal.status === 'PAID_OFF' && (
            <Card>
              <CardBody className="text-[14px] font-semibold text-ok">{fill(ui.stage3.paidOff, { date: dateOf(deal.paid_off_at) })}</CardBody>
            </Card>
          )}
          {/* Договор, первый счёт и протокол передачи остаются доступны весь срок рассрочки. */}
          <Card>
            <CardBody className="flex flex-col gap-3 text-[14px]">
              <p className="font-semibold">
                {fill(ui.deal.agreed, { date: deal.agreed_at ? fiDate(helsinkiDay(deal.agreed_at)) : '', number: deal.contract_number ?? '' })}
              </p>
              <div className="flex flex-wrap gap-2">
                <a href={`${home}/${deal.id}/contract`} className={buttonClass({ size: 'sm' })}>
                  {ui.deal.contract}
                </a>
                {invoice?.file_path && (
                  <a href={`${home}/${deal.id}/invoice`} className={buttonClass({ size: 'sm' })}>
                    {ui.deal.invoice} · {invoice.number}
                  </a>
                )}
              </div>
              {deal.handed_over_at && <p className="text-ok">{fill(ui.stage3.handedOver, { date: dateOf(deal.handed_over_at) })}</p>}
              {deal.handover_notes && (
                <div>
                  <p className="text-ink-muted">{ui.stage3.handoverNotesSeller}</p>
                  <p className="whitespace-pre-line">{deal.handover_notes}</p>
                </div>
              )}
              {deal.handover_buyer_notes && (
                <div>
                  <p className="text-ink-muted">{ui.stage3.handoverNotesBuyer}</p>
                  <p className="whitespace-pre-line">{deal.handover_buyer_notes}</p>
                </div>
              )}
            </CardBody>
          </Card>
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
                  [ui.stage3.vehicleOdometer, (vs?.odometer_km ?? deal.handover_odometer_km) != null ? `${(vs?.odometer_km ?? deal.handover_odometer_km)!.toLocaleString(locale === 'en' ? 'en-GB' : locale)} km` : ui.stage3.none],
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
                      /* Просрочку считаем, только пока сделка в рассрочке: у прекращённой она не растёт. */
                      const late = deal.status === 'ACTIVE' ? (lateById.get(p.id) ?? 0) : 0;
                      return (
                        <tr key={p.id} className="border-t border-line">
                          <td className="py-1.5 pr-3 font-mono">{p.n}</td>
                          <td className="py-1.5 pr-3 font-mono">{fiDate(p.due_date)}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">{eur(p.principal_cents)}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">{p.interest_cents > 0 ? eur(p.interest_cents) : ui.stage3.none}</td>
                          <td className="py-1.5 pr-3">
                            {inv?.file_path ? (
                              <a href={`${home}/${deal.id}/invoice?inv=${inv.id}`} className="font-mono text-accent hover:underline">
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
                                  /* Отметку оплаты не отменить — сначала вопрос, потом отправка (22.11.2026). */
                                  <ActionForm
                                    action={markPaidAction}
                                    fields={{ ...hidden, n: p.n }}
                                    label={ui.stage3.markPaid}
                                    confirm={{ text: fill(ui.stage3.markPaidConfirm, { n: String(p.n) }), cancel: ui.deal.cancel }}
                                  />
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
          {/* Выход из сделки в рассрочке — только продавцу: забрал машину или договорились (22.11.2026). */}
          {deal.status === 'ACTIVE' && isSeller && owner && (
            <Card>
              <CardBody className="flex flex-col gap-3 text-[14px]">
                <h2 className="text-[17px] font-semibold">{ui.termination.title}</h2>
                <p className="text-ink-muted">{ui.termination.hint}</p>
                <p className="text-ink-muted">{ui.termination.settlement}</p>
                <TerminateForm locale={locale} ui={ui} dealId={deal.id} />
              </CardBody>
            </Card>
          )}
        </>
      )}

      <Link href={`${home}?tab=deals`} className="text-[13px] text-accent hover:underline">
        ‹ {ui.tabs.deals}
      </Link>
    </main>
  );
}
