import 'server-only';

import { renderToBuffer } from '@react-pdf/renderer';
import { sendEmail } from '@/lib/email';
import { createFormat } from '@/lib/format';
import { asCurrency } from '@/lib/money/currency';
import { notify } from '@/lib/notify';
import { paymentReference } from '@/lib/sites/invoice';
import { SiteInvoicePdf } from '@/lib/sites/SiteInvoicePdf';
import { createAdminClient } from '@/lib/supabase/admin';
import { ibanHoldActive } from '@/lib/trust/changes';
import { lastIbanChange } from '@/lib/trust/sensitive';
import { dealBilled, installmentDealLink } from './access';
import { buildSchedule, daysBetween, effectiveHandover, overduePayments, type VatMode } from './calc';
import { fill, installmentUiCopy } from './copy';
import { installmentDay, installmentToday } from './countries';
import { countryEventCode, countryNoticeLocale } from './countryTexts';
import { documentKind, documentLabels, invoiceTexts } from './invoiceTexts';
import { installmentRules } from './rules';

/**
 * Рассрочка, этап 3 (23.11.2026): график взносов, счета взносов,
 * кредит-нота, ежедневное задание с просрочками.
 *
 * Счета — от имени продавца, деньги идут продавцу. Взнос без НДС: весь
 * НДС был в первом счёте (пометка на каждом счёте взноса); проценты —
 * отдельной строкой, освобождённая финансовая услуга (AVL 41 §).
 * Счёт выставляется в два шага: строка с номером (сразу закреплена за
 * взносом или сделкой), потом PDF и письмо; не дошедшее — досылается.
 * Свежий IBAN продавца (48 часов) — счёт не выставляется, как у фрахта.
 *
 * Просрочка — только по взносам с отправленным счётом и от большего из
 * двух дней: срока и дня отправки счёта (calc.ts overduePayments — то же
 * правило у страницы сделки): напоминание покупателю на 1-й и 7-й день,
 * продавцу — один сигнал, когда выполнен порог OskL 2 §. Машину задание
 * не изымает и запуск не блокирует.
 *
 * Прекращённую сделку (TERMINATED, 22.11.2026: продавец забрал машину или
 * стороны договорились) задание не ведёт: ни новых счетов, ни
 * напоминаний, ни сигнала о пороге. Неоплаченные и не выставленные взносы
 * остаются как есть — взаиморасчёт стороны проводят сами.
 *
 * 23.11.2026, Эстония и Латвия: тексты счетов и писем, подписи, ссылка
 * платежа (RF) и «сегодня» — по стране продавца (invoiceTexts.ts,
 * countries.ts); страна записывается в счёт (meta.country), у счетов до
 * этой даты её нет — они финские. Сигнал продавцу о пороге говорит о
 * правиле его страны: в Эстонии — порог договора и дополнительный срок, в
 * Латвии — два пропущенных срока и предупреждение; о том, что машину можно
 * забрать самому, там не говорится (rules.ts, countryTexts/).
 */

const BUCKET = 'reports';
/** За сколько дней до срока выставлять счёт взноса. */
export const INVOICE_LEAD_DAYS = 14;

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

type Party = { name: string; business_id: string | null; vat_id: string | null; iban?: string; address: string; email: string };
type Mail = { template: string; subject: string; text: string };
type Meta = {
  job: string;
  period: string;
  periodLabel: [string, string];
  note: string;
  mail: Mail;
  /* Кредит-нота: свой заголовок и сумма возврата вместо «к оплате» (итог документа — минус весь счёт). */
  title?: string;
  payNow?: { label: [string, string]; cents: number };
  amountLabel?: [string, string];
  /* Страна продавца (23.11.2026): по ней тексты, подписи и вид чисел при печати. Нет — счёт финский. */
  country?: string | null;
  /* Название документа в свойствах PDF, если это платёжное уведомление (Латвия с 2028 года). */
  docName?: string;
};

/** Страна продавца сделки — для пояса («сегодня», день передачи) и текстов. */
async function sellerCountryOf(sellerId: string): Promise<string | null> {
  const { data } = await createAdminClient().from('companies').select('country').eq('id', sellerId).maybeSingle();
  return data?.country ?? null;
}

/**
 * График из согласованных условий — один раз. Если машину передали позже
 * согласованной даты, график сдвигается на ту же задержку: проценты и
 * сроки — с фактической передачи (ревью 23.11.2026).
 */
export async function ensureSchedule(dealId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: deal } = await admin.from('installment_deals').select('*').eq('id', dealId).maybeSingle();
  if (!deal || (deal.status !== 'ACTIVE' && deal.status !== 'PAID_OFF') || !deal.handed_over_at) return 0;
  const { count } = await admin.from('installment_payments').select('id', { count: 'exact', head: true }).eq('deal_id', dealId);
  if ((count ?? 0) > 0) return count ?? 0;
  /* День передачи — по времени страны продавца (у Финляндии — Хельсинки, как было). */
  const start = effectiveHandover(deal.handover_date, installmentDay(await sellerCountryOf(deal.seller_company_id), deal.handed_over_at));
  const delay = Math.max(0, daysBetween(deal.handover_date, start));
  const schedule = buildSchedule({
    priceCents: deal.price_cents,
    vatMode: deal.vat_mode as VatMode,
    vatBps: deal.vat_bps,
    downPaymentCents: deal.down_payment_cents,
    months: deal.months,
    finalCents: deal.final_cents,
    annualRateBps: deal.annual_rate_bps,
    handoverDate: start,
    firstDueDate: delay > 0 ? addDays(deal.first_due_date, delay) : deal.first_due_date,
  });
  if ('error' in schedule) throw new Error(`график: ${schedule.error}`);
  const { error } = await admin.from('installment_payments').upsert(
    schedule.installments.map((x) => ({
      deal_id: dealId,
      n: x.n,
      due_date: x.dueDate,
      principal_cents: x.principalCents,
      interest_cents: x.interestCents,
    })),
    { onConflict: 'deal_id,n', ignoreDuplicates: true },
  );
  if (error) throw new Error(`график: ${error.message}`);
  return schedule.installments.length;
}

async function parties(sellerId: string, buyerId: string) {
  const admin = createAdminClient();
  const [{ data: seller }, { data: buyer }] = await Promise.all([
    admin
      .from('companies')
      .select('id, name, country, legal_name, business_id, vat_number, iban, legal_street, legal_postal_code, legal_city, billing_email, contact_email')
      .eq('id', sellerId)
      .maybeSingle(),
    admin
      .from('companies')
      .select('id, name, legal_name, business_id, vat_number, legal_street, legal_postal_code, legal_city, billing_street, billing_postal_code, billing_city, billing_email, contact_email')
      .eq('id', buyerId)
      .maybeSingle(),
  ]);
  if (!seller || !buyer) return null;
  const sellerParty: Party = {
    name: seller.legal_name || seller.name,
    business_id: seller.business_id,
    vat_id: seller.vat_number,
    iban: seller.iban ?? '',
    address: [seller.legal_street, [seller.legal_postal_code, seller.legal_city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    email: seller.billing_email || seller.contact_email,
  };
  const buyerParty: Party = {
    name: buyer.legal_name || buyer.name,
    business_id: buyer.business_id,
    vat_id: buyer.vat_number,
    address: [
      buyer.billing_street ?? buyer.legal_street,
      [buyer.billing_postal_code ?? buyer.legal_postal_code, buyer.billing_city ?? buyer.legal_city].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(', '),
    email: (buyer.billing_email || buyer.contact_email || '').trim().toLowerCase(),
  };
  return { seller: sellerParty, buyer: buyerParty, sellerId: seller.id, iban: seller.iban, country: seller.country as string | null };
}

/**
 * IBAN есть и не менялся последние 48 часов — иначе автоматический счёт не
 * выставляется. 'IBAN' — счёта у продавца нет совсем (сам не появится,
 * продавцу нужен сигнал), 'IBAN_HOLD' — свежая смена, пройдёт сама.
 */
async function ibanBlock(sellerId: string, iban: string | null): Promise<'IBAN' | 'IBAN_HOLD' | null> {
  if (!iban) return 'IBAN';
  const changedAt = await lastIbanChange(sellerId);
  return changedAt && ibanHoldActive(changedAt) ? 'IBAN_HOLD' : null;
}

/** Шаг 1: строка счёта с номером из серии продавца. Текст PDF и письма хранится со счётом. */
async function createInvoiceRow(input: {
  sellerId: string;
  buyerId: string;
  seller: Party;
  buyer: Party;
  issuedOn: string;
  dueOn: string;
  lines: { date: string; text: string; unitCents: number; amountCents: number }[];
  vatBps: number;
  vatCents: number;
  /** Валюта сделки (страны продавца): счёт выставляется в ней, без пересчёта (23.11.2026). */
  currency: string | null | undefined;
  meta: Meta;
}): Promise<string> {
  const admin = createAdminClient();
  const netCents = input.lines.reduce((s, l) => s + l.amountCents, 0);
  const { data: number, error: numberError } = await admin.rpc('next_carrier_invoice_number', {
    p_company_id: input.sellerId,
    p_year: Number(input.issuedOn.slice(0, 4)),
  });
  if (numberError || !number) throw new Error(`номер счёта: ${numberError?.message}`);
  const { data: inv, error } = await admin
    .from('carrier_invoices')
    .insert({
      company_id: input.sellerId,
      kind: 'INSTALLMENT',
      customer_company_id: input.buyerId,
      job_id: null,
      number,
      /* Ссылка платежа: финскому продавцу — viitenumero, остальным — международная RF (ISO 11649). */
      reference: paymentReference(number, input.meta.country),
      issued_on: input.issuedOn,
      due_on: input.dueOn,
      period_from: input.issuedOn,
      period_to: input.dueOn,
      seller: { ...input.seller, meta: input.meta },
      customer: input.buyer,
      lines: input.lines.map((l) => ({ ...l, quantity: 1, unit: invoiceTexts(input.meta.country).unit })),
      net_cents: netCents,
      vat_bps: input.vatBps,
      vat_cents: input.vatCents,
      total_cents: netCents + input.vatCents,
      currency: asCurrency(input.currency),
    })
    .select('id')
    .single();
  if (error || !inv) throw new Error(`счёт: ${error?.message}`);
  return inv.id;
}

/** Шаг 2: PDF и письмо по записанному счёту; повтор безопасен. true — письмо отправлено. */
export async function deliverInvoice(invoiceId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: inv } = await admin.from('carrier_invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (!inv) return false;
  if (inv.sent_at && inv.file_path) return true;
  const seller = inv.seller as Party & { meta?: Meta };
  const meta = seller.meta;
  if (!meta) return false;
  /* Подписи, вид чисел и дат — по стране продавца из счёта; у старых счетов её нет — финские. */
  const tx = invoiceTexts(meta.country);
  const f = createFormat(tx.intl);
  const fiDate = tx.date;
  const buyer = inv.customer as Party;
  const lines = inv.lines as { date: string; text: string; unitCents: number; amountCents: number }[];
  /* Суммы — в валюте самого счёта. */
  const currency = asCurrency(inv.currency);

  let path = inv.file_path;
  if (!path) {
    const buffer = await renderToBuffer(
      SiteInvoicePdf({
        number: inv.number,
        issuedOn: fiDate(inv.issued_on),
        dueOn: fiDate(inv.due_on),
        reference: inv.reference,
        seller: { name: seller.name, businessId: seller.business_id ?? '', vatId: seller.vat_id, address: seller.address, iban: seller.iban ?? '', email: seller.email },
        customer: { name: buyer.name, businessId: buyer.business_id, vatId: buyer.vat_id, address: buyer.address },
        job: meta.job,
        jobLabel: tx.payment.jobLabel,
        period: meta.period,
        periodLabel: meta.periodLabel,
        lines: lines.map((l) => ({
          date: fiDate(l.date),
          text: l.text,
          quantity: '1',
          unit: tx.unit,
          unitPrice: f.money(l.unitCents, currency),
          amount: f.money(l.amountCents, currency),
        })),
        net: f.money(inv.net_cents, currency),
        vatLabel: tx.vatLabel(inv.vat_bps > 0 ? (inv.vat_bps / 100).toLocaleString(tx.intl, { maximumFractionDigits: 1 }) : null),
        vat: f.money(inv.vat_cents, currency),
        total: f.money(inv.total_cents, currency),
        note: meta.note,
        title: meta.title,
        payNow: meta.payNow ? { label: meta.payNow.label, amount: f.money(meta.payNow.cents, currency) } : undefined,
        amountLabel: meta.amountLabel,
        /* docName записан только у платёжного уведомления. */
        labels: documentLabels(tx, Boolean(meta.docName)),
        docName: meta.docName,
      }),
    );
    path = `installment-invoices/${inv.company_id}/${inv.number}.pdf`;
    const { error: upload } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: 'application/pdf', upsert: true });
    if (upload) throw new Error(`загрузка счёта: ${upload.message}`);
    await admin.from('carrier_invoices').update({ file_path: path }).eq('id', inv.id);
  }
  if (!buyer.email) return false;
  const mail = await sendEmail({
    template: meta.mail.template,
    to: buyer.email,
    toName: buyer.name,
    replyTo: seller.email,
    subject: `${meta.mail.subject} · ${inv.number}`,
    text: `${meta.mail.text}\n\n${tx.payment.mailFooter({ number: inv.number, reference: inv.reference })}`,
    attachments: [{ bucket: BUCKET, path, filename: `${tx.filePrefix}-${inv.number}.pdf` }],
    companyId: inv.company_id,
  });
  if (mail.sent) {
    await admin.from('carrier_invoices').update({ sent_to: buyer.email, sent_at: new Date().toISOString() }).eq('id', inv.id);
  }
  return mail.sent;
}

export type IssueStatus = 'SENT' | 'CREATED' | 'EXISTS' | 'IBAN' | 'IBAN_HOLD' | 'NOT_FOUND';

/** Счёт взноса n (без НДС: весь НДС был в первом счёте). */
export async function issuePaymentInvoice(paymentId: string): Promise<IssueStatus> {
  const admin = createAdminClient();
  const { data: pay } = await admin.from('installment_payments').select('*').eq('id', paymentId).maybeSingle();
  if (!pay) return 'NOT_FOUND';
  if (pay.invoice_id) return (await deliverInvoice(pay.invoice_id)) ? 'EXISTS' : 'CREATED';
  const { data: deal } = await admin.from('installment_deals').select('*').eq('id', pay.deal_id).maybeSingle();
  /* Счёт взноса — только пока сделка в рассрочке: прекращённой и выплаченной счета не выставляются. */
  if (!deal || !dealBilled(deal.status) || !deal.contract_number) return 'NOT_FOUND';
  const p = await parties(deal.seller_company_id, deal.buyer_company_id);
  if (!p) return 'NOT_FOUND';
  const blocked = await ibanBlock(p.sellerId, p.iban);
  if (blocked) return blocked;

  /* Бронь строки графика: параллельный запуск не выставит второй счёт (бронь старше 10 минут — сорвавшаяся). */
  const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: claimed } = await admin
    .from('installment_payments')
    .update({ invoicing_started_at: new Date().toISOString() })
    .eq('id', pay.id)
    .is('invoice_id', null)
    .or(`invoicing_started_at.is.null,invoicing_started_at.lt.${staleBefore}`)
    .select('id');
  if ((claimed ?? []).length !== 1) return 'EXISTS';

  const { data: first } = deal.first_invoice_id
    ? await admin.from('carrier_invoices').select('number').eq('id', deal.first_invoice_id).maybeSingle()
    : { data: null };
  const snapshot = (deal.vehicle_snapshot ?? {}) as { make?: string; plate?: string };
  const what = [snapshot.make, snapshot.plate].filter(Boolean).join(' ');
  const tx = invoiceTexts(p.country);
  const f = createFormat(tx.intl);
  const total = f.money(pay.principal_cents + pay.interest_cents, asCurrency(deal.currency));
  const contract = deal.contract_number;
  const issuedOn = installmentToday(p.country);
  /* Латвия с 2028 года: документ платформы — платёжное уведомление, счёт продавец выписывает сам (invoiceTexts.ts). */
  const notice = documentKind(p.country, issuedOn) === 'NOTICE' ? tx.notice : null;
  const lines = [
    {
      date: pay.due_date,
      text: tx.payment.line({ n: pay.n, months: deal.months, contract, what }),
      unitCents: pay.principal_cents,
      amountCents: pay.principal_cents,
    },
    /* Проценты — всегда отдельной строкой: только так они остаются вне налоговой базы цены. */
    ...(pay.interest_cents > 0
      ? [
          {
            date: pay.due_date,
            text: tx.payment.interestLine,
            unitCents: pay.interest_cents,
            amountCents: pay.interest_cents,
          },
        ]
      : []),
  ];

  const invoiceId = await createInvoiceRow({
    sellerId: deal.seller_company_id,
    buyerId: deal.buyer_company_id,
    seller: p.seller,
    buyer: p.buyer,
    issuedOn,
    dueOn: pay.due_date,
    lines,
    vatBps: 0,
    vatCents: 0,
    currency: deal.currency,
    meta: {
      country: p.country,
      job: `${contract} · ${what}`,
      period: `${pay.n} / ${deal.months}`,
      periodLabel: tx.payment.periodLabel,
      note: [notice?.note, tx.payment.note({ firstNumber: first?.number ?? '—' })].filter(Boolean).join('\n'),
      title: notice?.title,
      docName: notice?.docName,
      mail: {
        template: 'installment_payment_invoice',
        subject: tx.payment.mailSubject({ seller: p.seller.name, n: pay.n, months: deal.months, contract }),
        text: tx.payment.mailText({
          contract,
          n: pay.n,
          months: deal.months,
          what,
          total,
          due: tx.date(pay.due_date),
          iban: p.seller.iban ?? '',
        }),
      },
    },
  });
  await admin.from('installment_payments').update({ invoice_id: invoiceId }).eq('id', pay.id);
  return (await deliverInvoice(invoiceId)) ? 'SENT' : 'CREATED';
}

/** Кредит-нота на первый счёт при отмене до передачи. Бронь — credit_note_started_at. */
export async function createCreditNote(dealId: string): Promise<IssueStatus> {
  const admin = createAdminClient();
  const { data: deal } = await admin.from('installment_deals').select('*').eq('id', dealId).maybeSingle();
  if (!deal || deal.status !== 'CANCELLED' || !deal.first_invoice_id) return 'NOT_FOUND';
  if (deal.credit_note_id) return (await deliverInvoice(deal.credit_note_id)) ? 'EXISTS' : 'CREATED';
  const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: claimed } = await admin
    .from('installment_deals')
    .update({ credit_note_started_at: new Date().toISOString() })
    .eq('id', dealId)
    .is('credit_note_id', null)
    .or(`credit_note_started_at.is.null,credit_note_started_at.lt.${staleBefore}`)
    .select('id');
  if ((claimed ?? []).length !== 1) return 'EXISTS';

  const { data: original } = await admin.from('carrier_invoices').select('*').eq('id', deal.first_invoice_id).maybeSingle();
  if (!original) return 'NOT_FOUND';
  const p = await parties(deal.seller_company_id, deal.buyer_company_id);
  if (!p) return 'NOT_FOUND';
  const originalLines = original.lines as { date: string; text: string; unitCents: number; amountCents: number }[];
  const tx = invoiceTexts(p.country);
  const issuedOn = installmentToday(p.country);
  /* Возвращается только уплаченное по первому счёту: взнос и весь НДС; не оплачен — возврата нет. */
  const f = createFormat(tx.intl);
  const refundCents = deal.first_invoice_paid_at ? deal.down_payment_cents + original.vat_cents : 0;
  const contract = deal.contract_number ?? '';

  const invoiceId = await createInvoiceRow({
    sellerId: deal.seller_company_id,
    buyerId: deal.buyer_company_id,
    seller: p.seller,
    buyer: p.buyer,
    issuedOn,
    dueOn: issuedOn,
    lines: originalLines.map((l) => ({ date: issuedOn, text: `${tx.credit.linePrefix}${l.text}`, unitCents: -l.unitCents, amountCents: -l.amountCents })),
    vatBps: original.vat_bps,
    vatCents: -original.vat_cents,
    currency: original.currency,
    meta: {
      country: p.country,
      job: tx.credit.job({ contract }),
      period: original.number,
      periodLabel: tx.credit.periodLabel,
      title: tx.credit.title,
      payNow: { label: tx.credit.payNowLabel, cents: refundCents },
      amountLabel: tx.credit.amountLabel,
      note: tx.credit.note({
        original: original.number,
        originalDate: tx.date(original.issued_on),
        contract,
        refund: refundCents > 0 ? f.money(refundCents, asCurrency(original.currency)) : null,
      }),
      mail: {
        template: 'installment_credit_note',
        subject: tx.credit.mailSubject({ seller: p.seller.name, original: original.number }),
        text: tx.credit.mailText({ original: original.number, contract }),
      },
    },
  });
  await admin.from('installment_deals').update({ credit_note_id: invoiceId }).eq('id', dealId);
  return (await deliverInvoice(invoiceId)) ? 'SENT' : 'CREATED';
}

export type RunResult = { deals: number; invoices: number; reminders: number; thresholds: number; errors: string[] };

/** Каждое утро (или по одной сделке после передачи): график, счета взносов, просрочки. */
export async function runInstallments(options: { dealId?: string; today?: string } = {}): Promise<RunResult> {
  const admin = createAdminClient();
  const result: RunResult = { deals: 0, invoices: 0, reminders: 0, thresholds: 0, errors: [] };
  let query = admin.from('installment_deals').select('*').eq('status', 'ACTIVE');
  if (options.dealId) query = query.eq('id', options.dealId);
  const { data: deals, error } = await query;
  if (error) {
    result.errors.push(error.message);
    return result;
  }

  for (const deal of deals ?? []) {
    /* Прекращённые (TERMINATED), выплаченные и отменённые сделки задание не трогает — явно, а не только отбором выше (22.11.2026). */
    if (!dealBilled(deal.status)) continue;
    result.deals += 1;
    try {
      /* Стороны — сразу: «сегодня» сделки, тексты и правило порога зависят от страны продавца. */
      const [{ data: buyer }, { data: seller }] = await Promise.all([
        admin.from('companies').select('language, kind').eq('id', deal.buyer_company_id).maybeSingle(),
        admin.from('companies').select('language, kind, country').eq('id', deal.seller_company_id).maybeSingle(),
      ]);
      const country = seller?.country ?? null;
      const today = options.today ?? installmentToday(country);
      await ensureSchedule(deal.id);
      const { data: rows } = await admin.from('installment_payments').select('*').eq('deal_id', deal.id).order('n');
      let ibanMissing: number | null = null;

      for (const row of rows ?? []) {
        if (row.paid_at) continue;
        if (!row.invoice_id && row.due_date <= addDays(today, INVOICE_LEAD_DAYS)) {
          const status = await issuePaymentInvoice(row.id);
          if (status === 'SENT' || status === 'CREATED') result.invoices += 1;
          /*
           * Счёт не вышел из-за IBAN продавца — раньше задание молчало, и
           * взнос оставался без счёта (22.11.2026). В итог задания — всегда;
           * продавцу сигнал, когда счёта нет совсем (свежая смена пройдёт сама).
           */
          if (status === 'IBAN' || status === 'IBAN_HOLD') {
            result.errors.push(`${deal.id}: взнос ${row.n} без счёта — ${status === 'IBAN' ? 'у продавца нет IBAN' : 'IBAN продавца изменён менее 48 часов назад'}`);
            if (status === 'IBAN') ibanMissing ??= row.n;
          }
        } else if (row.invoice_id) {
          /* Не дошедший счёт — дослать. */
          await deliverInvoice(row.invoice_id);
        }
      }

      /* Сделку могли прекратить, пока выставлялись счета: напоминаний и сигнала о пороге по ней уже не будет (22.11.2026). */
      const { data: current } = await admin.from('installment_deals').select('status').eq('id', deal.id).maybeSingle();
      if (!dealBilled(current?.status)) continue;

      /* Просрочка — только по взносам, счёт которых отправлен покупателю, от срока или дня отправки (что позже). */
      const { data: fresh } = await admin.from('installment_payments').select('*').eq('deal_id', deal.id).order('n');
      const invoiceIds = (fresh ?? []).map((r) => r.invoice_id).filter((v): v is string => Boolean(v));
      const { data: invs } = invoiceIds.length
        ? await admin.from('carrier_invoices').select('id, sent_at').in('id', invoiceIds)
        : { data: [] as { id: string; sent_at: string | null }[] };
      const sentDay = new Map((invs ?? []).filter((i) => i.sent_at).map((i) => [i.id, installmentDay(country, i.sent_at!)]));
      const overdue = overduePayments(
        (fresh ?? []).map((r) => ({
          ...r,
          dueDate: r.due_date,
          paid: Boolean(r.paid_at),
          invoiceSentDay: r.invoice_id ? (sentDay.get(r.invoice_id) ?? null) : null,
        })),
        today,
      );

      const plate = ((deal.vehicle_snapshot ?? {}) as { plate?: string }).plate ?? '';
      /* Тексты — про право страны сделки; язык записанного текста — см. countryNoticeLocale. */
      const cb = installmentUiCopy(countryNoticeLocale(buyer?.language ?? 'fi', country), country);
      const cs = installmentUiCopy(countryNoticeLocale(seller?.language ?? 'fi', country), country);
      /* Сделку каждая сторона открывает в своём кабинете: продавец может быть компанией без парка (23.11.2026). Покупатель — всегда перевозчик. */
      const sellerLink = installmentDealLink(seller?.kind ?? 'CARRIER', deal.id);
      const buyerLink = installmentDealLink(buyer?.kind ?? 'CARRIER', deal.id);

      /* Продавцу без IBAN — сигнал не чаще раза в неделю по сделке: задание идёт каждый день. */
      if (ibanMissing != null) {
        const link = sellerLink;
        const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
        const { count: recent } = await admin
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', deal.seller_company_id)
          .eq('code', 'installment.no_iban')
          .eq('link', link)
          .gte('created_at', weekAgo);
        if ((recent ?? 0) === 0) {
          await notify({
            companyId: deal.seller_company_id,
            kind: 'BILLING',
            code: 'installment.no_iban',
            params: { plate, n: ibanMissing },
            title: fill(cs.notify.noIbanTitle, { plate, n: String(ibanMissing) }),
            body: cs.notify.noIbanBody,
            link,
          });
        }
      }

      for (const row of overdue) {
        const late = row.lateDays;
        const column = late >= 7 && !row.reminded_7_at ? 'reminded_7_at' : late >= 1 && !row.reminded_1_at ? 'reminded_1_at' : null;
        if (!column) continue;
        /* Отметка до уведомления и «где пусто»: параллельный запуск не задвоит напоминание. */
        const at = new Date().toISOString();
        const { data: won } =
          column === 'reminded_7_at'
            ? await admin
                .from('installment_payments')
                .update({ reminded_7_at: at, reminded_1_at: row.reminded_1_at ?? at })
                .eq('id', row.id)
                .is('reminded_7_at', null)
                .select('id')
            : await admin.from('installment_payments').update({ reminded_1_at: at }).eq('id', row.id).is('reminded_1_at', null).select('id');
        if ((won ?? []).length !== 1) continue;
        await notify({
          companyId: deal.buyer_company_id,
          kind: 'BILLING',
          code: 'installment.overdue',
          params: { plate, n: row.n, date: row.due_date, days: late },
          title: fill(cb.notify.overdueTitle, { plate, n: String(row.n) }),
          body: fill(cb.notify.overdueBody, { days: String(late), date: invoiceTexts(country).date(row.due_date) }),
          link: buyerLink,
        });
        result.reminders += 1;
      }

      const priceGross =
        deal.price_cents + (deal.vat_mode === 'STANDARD' ? Math.round((deal.price_cents * deal.vat_bps) / 10_000) : 0);
      const remaining = (fresh ?? []).filter((r) => !r.paid_at).reduce((s, r) => s + r.principal_cents, 0);
      /*
       * Порог — по правилам страны сделки (23.11.2026); правил у страны нет —
       * сигнала продавцу нет. Что порог даёт, говорит текст страны: в Финляндии
       * — право требовать остаток или изымать, в Эстонии и Латвии — только
       * следующий шаг (дополнительный срок, предупреждение).
       */
      const rules = installmentRules(country);
      const allowed =
        rules !== null &&
        rules.remedyAllowed(
          overdue.map((r) => ({ dueDate: r.lateFrom, unpaidCents: r.principal_cents })),
          today,
          priceGross,
          remaining,
        );
      const newest = overdue[overdue.length - 1];
      if (allowed && newest && !newest.threshold_notified_at) {
        const { data: won } = await admin
          .from('installment_payments')
          .update({ threshold_notified_at: new Date().toISOString() })
          .eq('id', newest.id)
          .is('threshold_notified_at', null)
          .select('id');
        if ((won ?? []).length === 1) {
          await notify({
            companyId: deal.seller_company_id,
            kind: 'BILLING',
            code: countryEventCode('threshold', country),
            params: { plate },
            title: fill(cs.notify.thresholdTitle, { plate }),
            body: cs.notify.thresholdBody,
            link: sellerLink,
          });
          result.thresholds += 1;
        }
      }
    } catch (cause) {
      result.errors.push(`${deal.id}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
  return result;
}
