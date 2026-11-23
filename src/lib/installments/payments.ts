import 'server-only';

import { renderToBuffer } from '@react-pdf/renderer';
import { sendEmail } from '@/lib/email';
import { createFormat } from '@/lib/format';
import { asCurrency } from '@/lib/money/currency';
import { notify } from '@/lib/notify';
import { paymentReference } from '@/lib/sites/invoice';
import { SiteInvoicePdf, type SiteInvoicePdfInput } from '@/lib/sites/SiteInvoicePdf';
import { createAdminClient } from '@/lib/supabase/admin';
import { ibanHoldActive } from '@/lib/trust/changes';
import { lastIbanChange } from '@/lib/trust/sensitive';
import { dealBilled, installmentDealLink } from './access';
import { buildSchedule, daysBetween, effectiveHandover, overduePayments, vatOf, type VatMode } from './calc';
import { fill, installmentUiCopy } from './copy';
import { installmentCountryEntry, installmentDay, installmentToday } from './countries';
import { countryEventCode, countryNoticeLocale } from './countryTexts';
import { firstDocOf } from './firstInvoice';
import { documentKind, documentLabels, invoiceTexts, plainDoc, plainDocLabels, type PlainDocKind } from './invoiceTexts';
import { installmentRules } from './rules';
import { withdrawalDeclared } from './defaultSteps';

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
 *
 * 23.11.2026, Литва и Германия: ежемесячный документ — платёжное требование
 * (mokėjimo pranešimas, Zahlungsaufforderung), не счёт: без строк НДС и с
 * номером от номера договора, серию счетов он не занимает. Литва: в день
 * передачи выставляется счёт с НДС на всю цену с зачётом аванса
 * (issueHandoverVatInvoice), до этого был только предварительный счёт.
 * Отмена до передачи документа без НДС (предварительного счёта, немецкой
 * платёжной информации) — не кредит-нота, а отмена без НДС (tx.cancel).
 *
 * 23.11.2026, Польша и Румыния: платформа счетов не выставляет вовсе — счета
 * только в KSeF / RO e-Factura у продавца. Все документы — уведомления со
 * своей нумерацией от договора: первое (firstInvoice.ts), справка о передаче
 * (issueHandoverVatInvoice, столбец vat_invoice_id), ежемесячное (paymentDoc)
 * и отмена (cancel). Серию счетов продавца они не занимают.
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
  /* Вид документа, который не счёт (23.11.2026): по нему подписи и имя файла; нет — счёт, как было. */
  doc?: PlainDocKind;
  /* Документ без строк НДС (23.11.2026). */
  noVat?: boolean;
  /* Подпись поля «предмет» вместо подписи счёта взноса (счёт с НДС при передаче, Литва). */
  jobLabel?: [string, string];
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
  /**
   * Номер документа, который не счёт (23.11.2026): от номера договора, серию
   * счетов продавца не занимает. Нет — номер из серии, как было.
   */
  number?: string;
}): Promise<string> {
  const admin = createAdminClient();
  const netCents = input.lines.reduce((s, l) => s + l.amountCents, 0);
  const { data: number, error: numberError } = input.number
    ? { data: input.number, error: null }
    : await admin.rpc('next_carrier_invoice_number', {
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
  /*
   * Номер от договора уже есть — прошлый запуск записал документ, но не успел
   * его привязать (бронь потом истекла): берём записанный, второй не создаём.
   */
  if (error?.code === '23505' && input.number) {
    const { data: same } = await admin.from('carrier_invoices').select('id').eq('company_id', input.sellerId).eq('number', input.number).maybeSingle();
    if (same) return same.id;
  }
  if (error || !inv) throw new Error(`счёт: ${error?.message}`);
  return inv.id;
}

/** Строка счёта, как она записана в carrier_invoices (для печати). */
export type InvoiceRow = {
  number: string;
  issued_on: string;
  due_on: string;
  reference: string;
  seller: unknown;
  customer: unknown;
  lines: unknown;
  net_cents: number;
  vat_bps: number;
  vat_cents: number;
  total_cents: number;
  currency: string | null;
};

/**
 * Что печатается и что уходит письмом по счёту с записанным meta (23.11.2026):
 * чистая функция без базы — её же вызывает проверка печати. Для счетов всех
 * стран до 23.11.2026 — то же, что печаталось раньше. null — у счёта нет meta.
 */
export function invoicePdf(inv: InvoiceRow): { pdf: SiteInvoicePdfInput; subject: string; text: string; filename: string; email: string } | null {
  const seller = inv.seller as Party & { meta?: Meta };
  const meta = seller.meta;
  if (!meta) return null;
  /* Подписи, вид чисел и дат — по стране продавца из счёта; у старых счетов её нет — финские. */
  const tx = invoiceTexts(meta.country);
  const f = createFormat(tx.intl);
  const fiDate = tx.date;
  const buyer = inv.customer as Party;
  const lines = inv.lines as { date: string; text: string; unitCents: number; amountCents: number }[];
  /* Суммы — в валюте самого счёта. */
  const currency = asCurrency(inv.currency);
  const plain = plainDoc(tx, meta.doc);
  const pdf: SiteInvoicePdfInput = {
    number: inv.number,
    issuedOn: fiDate(inv.issued_on),
    dueOn: fiDate(inv.due_on),
    reference: inv.reference,
    seller: { name: seller.name, businessId: seller.business_id ?? '', vatId: seller.vat_id, address: seller.address, iban: seller.iban ?? '', email: seller.email },
    customer: { name: buyer.name, businessId: buyer.business_id, vatId: buyer.vat_id, address: buyer.address },
    job: meta.job,
    jobLabel: meta.jobLabel ?? tx.payment.jobLabel,
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
    /* docName записан только у платёжного уведомления; вид документа (doc) — у документов без НДС (23.11.2026). */
    labels: meta.doc ? plainDocLabels(tx, meta.doc) : documentLabels(tx, Boolean(meta.docName)),
    docName: meta.docName,
    ...(meta.noVat ? { noVat: true } : {}),
  };
  return {
    pdf,
    subject: `${meta.mail.subject} · ${inv.number}`,
    text: `${meta.mail.text}\n\n${tx.payment.mailFooter({ number: inv.number, reference: inv.reference })}`,
    filename: `${plain?.filePrefix ?? tx.filePrefix}-${inv.number}.pdf`,
    email: buyer.email,
  };
}

/** Шаг 2: PDF и письмо по записанному счёту; повтор безопасен. true — письмо отправлено. */
export async function deliverInvoice(invoiceId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: inv } = await admin.from('carrier_invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (!inv) return false;
  if (inv.sent_at && inv.file_path) return true;
  const built = invoicePdf(inv);
  if (!built) return false;
  const seller = inv.seller as Party & { meta: Meta };
  const buyer = inv.customer as Party;

  let path = inv.file_path;
  if (!path) {
    const buffer = await renderToBuffer(SiteInvoicePdf(built.pdf));
    path = `installment-invoices/${inv.company_id}/${inv.number}.pdf`;
    const { error: upload } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: 'application/pdf', upsert: true });
    if (upload) throw new Error(`загрузка счёта: ${upload.message}`);
    await admin.from('carrier_invoices').update({ file_path: path }).eq('id', inv.id);
  }
  if (!buyer.email) return false;
  const mail = await sendEmail({
    template: seller.meta.mail.template,
    to: buyer.email,
    toName: buyer.name,
    replyTo: seller.email,
    subject: built.subject,
    text: built.text,
    attachments: [{ bucket: BUCKET, path, filename: built.filename }],
    companyId: inv.company_id,
  });
  if (mail.sent) {
    await admin.from('carrier_invoices').update({ sent_to: buyer.email, sent_at: new Date().toISOString() }).eq('id', inv.id);
  }
  return mail.sent;
}

export type IssueStatus = 'SENT' | 'CREATED' | 'EXISTS' | 'IBAN' | 'IBAN_HOLD' | 'NOT_FOUND';

/* Столбцы сделки из миграции 20261201100000 (счёт с НДС при передаче, Литва): в src/types/database.ts их ещё нет. */
type DealExtra = { vat_invoice_id?: string | null; vat_invoice_started_at?: string | null };

/* Запись этих столбцов — с собственной подписью запроса (как terminate_installment_deal в actions.ts). */
type UntypedChain = PromiseLike<{ data: { id: string }[] | null; error: { message: string } | null }> & {
  eq(column: string, value: string): UntypedChain;
  is(column: string, value: null): UntypedChain;
  or(filter: string): UntypedChain;
  select(columns: string): UntypedChain;
};
type UntypedDeals = { update(values: Record<string, unknown>): UntypedChain };

/**
 * Документ взноса n — тексты и вид (23.11.2026). Чистая функция: её же
 * вызывает проверка печати. Литва и Германия — платёжное требование без НДС
 * с номером от договора; Латвия с 2028 года — платёжное уведомление; иначе
 * счёт, как было.
 */
export function paymentDocument(a: {
  country: string | null;
  issuedOn: string;
  contract: string;
  what: string;
  n: number;
  months: number;
  firstNumber: string;
  total: string;
  dueIso: string;
  iban: string;
  sellerName: string;
  /** В документе есть строка процентов (23.11.2026): тексты Польши и Румынии говорят, кто и как их фактурирует. */
  hasInterest?: boolean;
}): { meta: Meta; number?: string } {
  const tx = invoiceTexts(a.country);
  const plain = tx.paymentDoc;
  /* Латвия с 2028 года: документ платформы — платёжное уведомление, счёт продавец выписывает сам (invoiceTexts.ts). */
  const notice = !plain && documentKind(a.country, a.issuedOn) === 'NOTICE' ? tx.notice : null;
  return {
    number: plain?.number({ contract: a.contract, n: a.n }),
    meta: {
      country: a.country,
      job: `${a.contract} · ${a.what}`,
      period: `${a.n} / ${a.months}`,
      periodLabel: tx.payment.periodLabel,
      note: [notice?.note, tx.payment.note({ firstNumber: a.firstNumber, hasInterest: a.hasInterest })].filter(Boolean).join('\n'),
      title: plain?.title ?? notice?.title,
      docName: plain?.docName ?? notice?.docName,
      ...(plain ? { doc: 'PAYMENT' as const, noVat: Boolean(plain.noVat) } : {}),
      mail: {
        template: 'installment_payment_invoice',
        subject: tx.payment.mailSubject({ seller: a.sellerName, n: a.n, months: a.months, contract: a.contract }),
        text: tx.payment.mailText({
          contract: a.contract,
          n: a.n,
          months: a.months,
          what: a.what,
          total: a.total,
          due: tx.date(a.dueIso),
          iban: a.iban,
        }),
      },
    },
  };
}

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
    ? await admin.from('carrier_invoices').select('number, seller').eq('id', deal.first_invoice_id).maybeSingle()
    : { data: null };
  /*
   * Номер счёта, в котором весь НДС (23.11.2026): обычно первый счёт; у Литвы
   * — счёт с НДС, выписанный при передаче; у немецкой платёжной информации
   * (не счёт) номера счёта RAHTIS нет — текст говорит о счёте продавца.
   */
  const firstDoc = first ? firstDocOf(first.seller) : null;
  const vatInvoiceId = (deal as DealExtra).vat_invoice_id ?? null;
  const { data: vatInvoice } = vatInvoiceId
    ? await admin.from('carrier_invoices').select('number').eq('id', vatInvoiceId).maybeSingle()
    : { data: null };
  const firstNumber = firstDoc === 'PROFORMA' ? (vatInvoice?.number ?? '—') : firstDoc === 'NOTICE' ? '' : (first?.number ?? '—');
  const snapshot = (deal.vehicle_snapshot ?? {}) as { make?: string; plate?: string };
  const what = [snapshot.make, snapshot.plate].filter(Boolean).join(' ');
  const tx = invoiceTexts(p.country);
  const f = createFormat(tx.intl);
  const total = f.money(pay.principal_cents + pay.interest_cents, asCurrency(deal.currency));
  const contract = deal.contract_number;
  const issuedOn = installmentToday(p.country);
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

  const doc = paymentDocument({
    country: p.country,
    issuedOn,
    contract,
    what,
    n: pay.n,
    months: deal.months,
    firstNumber,
    total,
    dueIso: pay.due_date,
    iban: p.seller.iban ?? '',
    sellerName: p.seller.name,
    hasInterest: pay.interest_cents > 0,
  });

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
    meta: doc.meta,
    number: doc.number,
  });
  await admin.from('installment_payments').update({ invoice_id: invoiceId }).eq('id', pay.id);
  return (await deliverInvoice(invoiceId)) ? 'SENT' : 'CREATED';
}

/**
 * Документ отмены первого документа (23.11.2026). Чистая функция: её же
 * вызывает проверка печати. Первый документ — счёт: кредит-нота на всю цену
 * и весь НДС, как было. Первый документ без НДС (литовский предварительный
 * счёт, немецкая платёжная информация): отмена без НДС, номер от номера
 * документа, к возврату — уплаченный итог документа.
 */
export function creditDocument(a: {
  country: string | null;
  issuedOn: string;
  contract: string;
  original: { number: string; issued_on: string; seller: unknown; lines: unknown; vat_bps: number; vat_cents: number; total_cents: number; currency: string | null };
  paid: boolean;
  downPaymentCents: number;
  sellerName: string;
}): { lines: { date: string; text: string; unitCents: number; amountCents: number }[]; vatBps: number; vatCents: number; meta: Meta; number?: string } {
  const { original, issuedOn, contract } = a;
  const originalLines = original.lines as { date: string; text: string; unitCents: number; amountCents: number }[];
  const tx = invoiceTexts(a.country);
  const plainOriginal = firstDocOf(original.seller) !== null;
  const ct = plainOriginal && tx.cancel ? tx.cancel : tx.credit;
  /* Возвращается только уплаченное по первому документу: взнос и весь НДС (у документа без НДС — его итог); не оплачен — возврата нет. */
  const f = createFormat(tx.intl);
  const refundCents = a.paid ? (plainOriginal ? original.total_cents : a.downPaymentCents + original.vat_cents) : 0;
  return {
    lines: originalLines.map((l) => ({ date: issuedOn, text: `${ct.linePrefix}${l.text}`, unitCents: -l.unitCents, amountCents: -l.amountCents })),
    vatBps: plainOriginal ? 0 : original.vat_bps,
    vatCents: plainOriginal ? 0 : -original.vat_cents,
    number: plainOriginal && tx.cancel ? tx.cancel.number({ contract, original: original.number }) : undefined,
    meta: {
      country: a.country,
      job: ct.job({ contract }),
      period: original.number,
      periodLabel: ct.periodLabel,
      title: ct.title,
      payNow: { label: ct.payNowLabel, cents: refundCents },
      amountLabel: ct.amountLabel,
      note: ct.note({
        original: original.number,
        originalDate: tx.date(original.issued_on),
        contract,
        refund: refundCents > 0 ? f.money(refundCents, asCurrency(original.currency)) : null,
      }),
      ...(plainOriginal && tx.cancel ? { doc: 'CANCEL' as const, noVat: true, docName: tx.cancel.docName } : {}),
      mail: {
        template: 'installment_credit_note',
        subject: ct.mailSubject({ seller: a.sellerName, original: original.number }),
        text: ct.mailText({ original: original.number, contract }),
      },
    },
  };
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
  const issuedOn = installmentToday(p.country);
  const credit = creditDocument({
    country: p.country,
    issuedOn,
    contract: deal.contract_number ?? '',
    original,
    paid: Boolean(deal.first_invoice_paid_at),
    downPaymentCents: deal.down_payment_cents,
    sellerName: p.seller.name,
  });

  const invoiceId = await createInvoiceRow({
    sellerId: deal.seller_company_id,
    buyerId: deal.buyer_company_id,
    seller: p.seller,
    buyer: p.buyer,
    issuedOn,
    dueOn: issuedOn,
    lines: credit.lines,
    vatBps: credit.vatBps,
    vatCents: credit.vatCents,
    currency: original.currency,
    meta: credit.meta,
    number: credit.number,
  });
  await admin.from('installment_deals').update({ credit_note_id: invoiceId }).eq('id', dealId);
  return (await deliverInvoice(invoiceId)) ? 'SENT' : 'CREATED';
}

/**
 * Счёт с НДС при передаче — тексты (23.11.2026, Литва). Чистая функция: её
 * же вызывает проверка печати. Вся цена и весь НДС, дата — день передачи,
 * зачтён аванс по предварительному счёту; платить по счёту нечего.
 */
export function handoverInvoiceDocument(a: {
  country: string | null;
  handoverDay: string;
  contract: string;
  what: string;
  priceCents: number;
  vatCents: number;
  downPaymentCents: number;
  months: number;
  proformaNumber: string;
  currency: string | null;
  sellerName: string;
  /** Ставка НДС сделки, б. п. (23.11.2026): справке Польши и Румынии — «что должен содержать счёт продавца». */
  vatBps?: number;
}): { lines: { date: string; text: string; unitCents: number; amountCents: number }[]; meta: Meta; number?: string } | null {
  const tx = invoiceTexts(a.country);
  const h = tx.handover;
  if (!h) return null;
  const f = createFormat(tx.intl);
  const cur = asCurrency(a.currency);
  /*
   * Польша и Румыния (23.11.2026): при передаче — справка без НДС со своим
   * номером, не счёт. Строка — цена с НДС (налог отдельно не выделяется),
   * платить по ней нечего; что должен содержать счёт продавца — в примечании.
   */
  const doc = tx.handoverDoc;
  const advanceCents = a.downPaymentCents + a.vatCents;
  const grossCents = a.priceCents + a.vatCents;
  const bps = a.vatBps ?? 0;
  const lineCents = doc ? grossCents : a.priceCents;
  return {
    number: doc?.number({ contract: a.contract }),
    lines: [{ date: a.handoverDay, text: h.line({ what: a.what, contract: a.contract }), unitCents: lineCents, amountCents: lineCents }],
    meta: {
      ...(doc ? { doc: 'HANDOVER' as const, noVat: true, title: doc.title, docName: doc.docName } : {}),
      country: a.country,
      job: `${a.what} · ${a.contract}`,
      jobLabel: tx.first.jobLabel,
      period: tx.date(a.handoverDay),
      periodLabel: tx.first.periodLabel,
      payNow: { label: h.payNowLabel, cents: 0 },
      amountLabel: h.amountLabel,
      note: h.note({
        proforma: a.proformaNumber,
        advance: f.money(advanceCents, cur),
        vat: f.money(a.vatCents, cur),
        rest: f.money(a.priceCents - a.downPaymentCents, cur),
        months: a.months,
        contract: a.contract,
        /* Поля ниже читают только тексты Польши и Румынии. */
        price: f.money(a.priceCents, cur),
        gross: f.money(grossCents, cur),
        vatPercent: (bps / 100).toLocaleString(tx.intl, { maximumFractionDigits: 1 }),
        advanceVat: f.money(bps > 0 ? Math.round((advanceCents * bps) / (10_000 + bps)) : 0, cur),
        handover: tx.date(a.handoverDay),
      }),
      mail: {
        template: 'installment_payment_invoice',
        subject: h.mailSubject({ seller: a.sellerName, contract: a.contract }),
        text: h.mailText({ contract: a.contract, what: a.what, seller: a.sellerName }),
      },
    },
  };
}

/**
 * Литва (23.11.2026): PVM sąskaita faktūra на всю цену в день передачи.
 * Выставляется, когда обе стороны подтвердили передачу (confirmHandoverAction
 * → runInstallments), и досылается ежедневным заданием, если сорвалась. Дата
 * счёта — день передачи по времени страны, даже если счёт вышел позже.
 * IBAN не проверяется: платить по счёту нечего, а счёт с НДС нужен в день
 * поставки (PVMĮ 79 str. 2 d. 1 p.). Бронь — vat_invoice_started_at.
 */
export async function issueHandoverVatInvoice(dealId: string): Promise<IssueStatus> {
  const admin = createAdminClient();
  const { data: row } = await admin.from('installment_deals').select('*').eq('id', dealId).maybeSingle();
  const deal = row as (typeof row & DealExtra) | null;
  if (!deal || (deal.status !== 'ACTIVE' && deal.status !== 'PAID_OFF') || !deal.handed_over_at || !deal.contract_number) return 'NOT_FOUND';
  if (deal.vat_invoice_id) return (await deliverInvoice(deal.vat_invoice_id)) ? 'EXISTS' : 'CREATED';
  const p = await parties(deal.seller_company_id, deal.buyer_company_id);
  const entry = p ? installmentCountryEntry(p.country) : null;
  /* Литва — счёт с НДС; Польша и Румыния (23.11.2026) — справка о передаче, не счёт. */
  if (!p || (entry?.vatInvoiceAtHandover !== true && entry?.sellerInvoices !== true)) return 'NOT_FOUND';

  const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
  const deals = admin.from('installment_deals') as unknown as UntypedDeals;
  const { data: claimed } = await deals
    .update({ vat_invoice_started_at: new Date().toISOString() })
    .eq('id', dealId)
    .is('vat_invoice_id', null)
    .or(`vat_invoice_started_at.is.null,vat_invoice_started_at.lt.${staleBefore}`)
    .select('id');
  if ((claimed ?? []).length !== 1) return 'EXISTS';

  const { data: proforma } = deal.first_invoice_id
    ? await admin.from('carrier_invoices').select('number').eq('id', deal.first_invoice_id).maybeSingle()
    : { data: null };
  const snapshot = (deal.vehicle_snapshot ?? {}) as { make?: string; plate?: string };
  const what = [snapshot.make, snapshot.plate].filter(Boolean).join(' ');
  const handoverDay = installmentDay(p.country, deal.handed_over_at);
  const vatCents = vatOf(deal.price_cents, deal.vat_mode as VatMode, deal.vat_bps);
  const built = handoverInvoiceDocument({
    country: p.country,
    handoverDay,
    contract: deal.contract_number,
    what,
    priceCents: deal.price_cents,
    vatCents,
    downPaymentCents: deal.down_payment_cents,
    months: deal.months,
    proformaNumber: proforma?.number ?? '—',
    currency: deal.currency,
    sellerName: p.seller.name,
    vatBps: deal.vat_mode === 'STANDARD' ? deal.vat_bps : 0,
  });
  if (!built) return 'NOT_FOUND';
  /* Справка — не счёт: без строк НДС и с номером от договора, серию счетов продавца она не занимает. */
  const plain = Boolean(built.meta.noVat);

  const invoiceId = await createInvoiceRow({
    sellerId: deal.seller_company_id,
    buyerId: deal.buyer_company_id,
    seller: p.seller,
    buyer: p.buyer,
    issuedOn: handoverDay,
    dueOn: handoverDay,
    lines: built.lines,
    vatBps: !plain && deal.vat_mode === 'STANDARD' ? deal.vat_bps : 0,
    vatCents: plain ? 0 : vatCents,
    currency: deal.currency,
    meta: built.meta,
    number: built.number,
  });
  const { error: linked } = await deals.update({ vat_invoice_id: invoiceId }).eq('id', dealId).is('vat_invoice_id', null);
  if (linked) throw new Error(`счёт с НДС при передаче: ${linked.message}`);
  /* Платить по счёту нечего: аванс уже зачтён — счёт сразу оплачен. */
  await admin.from('carrier_invoices').update({ paid_at: handoverDay }).eq('id', invoiceId).is('paid_at', null);
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
      /* Литва: счёт с НДС на всю цену — в день передачи, до первого платёжного требования (23.11.2026). */
      /* Польша и Румыния: справка о передаче (не счёт) — тем же путём (23.11.2026). */
      const handoverEntry = installmentCountryEntry(country);
      if (handoverEntry?.vatInvoiceAtHandover === true || handoverEntry?.sellerInvoices === true) {
        /* Сорвался — в итог задания и повтор завтра; взносы и напоминания по сделке всё равно идут. */
        try {
          const status = await issueHandoverVatInvoice(deal.id);
          if (status === 'SENT' || status === 'CREATED') result.invoices += 1;
        } catch (cause) {
          result.errors.push(`${deal.id}: счёт с НДС при передаче — ${cause instanceof Error ? cause.message : String(cause)}`);
        }
      }
      await ensureSchedule(deal.id);
      const { data: rows } = await admin.from('installment_payments').select('*').eq('deal_id', deal.id).order('n');
      let ibanMissing: number | null = null;
      /*
       * Продавец записал отказ от договора (расторжение, уведомление об изъятии;
       * 24.11.2026, installment_default_steps): дальше по сделке — только её
       * прекращение. Обычных напоминаний покупателю, новых документов на взносы
       * и сигналов о пороге задание больше не шлёт; график и записи остаются.
       */
      const { data: withdrawn } = await admin
        .from('installment_default_steps')
        .select('id')
        .eq('deal_id', deal.id)
        .eq('step', 'WITHDRAWAL')
        .limit(1);
      if (withdrawalDeclared((withdrawn ?? []).map(() => ({ step: 'WITHDRAWAL' })))) continue;

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
      /*
       * От чего считается доля просрочки — по правилам страны (23.11.2026):
       * в Финляндии и Эстонии цена с НДС, как было; в Швеции — kreditfordran,
       * в Дании — вся сумма к уплате. База — из согласованных условий, тем же
       * расчётом, что у договора и страницы сделки (rules.ts, base).
       */
      const agreed = buildSchedule({
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
          overdue.map((r) => ({ dueDate: r.lateFrom, unpaidCents: r.principal_cents, n: r.n })),
          today,
          'error' in agreed ? priceGross : rules.base(agreed),
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
