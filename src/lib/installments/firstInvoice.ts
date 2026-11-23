import 'server-only';

import { renderToBuffer } from '@react-pdf/renderer';
import { sendEmail } from '@/lib/email';
import { createFormat } from '@/lib/format';
import { asCurrency } from '@/lib/money/currency';
import { paymentReference } from '@/lib/sites/invoice';
import { SiteInvoicePdf, type SiteInvoicePdfInput } from '@/lib/sites/SiteInvoicePdf';
import { createAdminClient } from '@/lib/supabase/admin';
import { ibanHoldActive } from '@/lib/trust/changes';
import { lastIbanChange } from '@/lib/trust/sensitive';
import { firstInvoiceSettledAtIssue, vatOf, type VatMode } from './calc';
import { installmentCountryEntry, installmentToday } from './countries';
import { documentKind, documentLabels, firstDocumentKind, invoiceTexts, plainDoc, plainDocLabels, type PlainDocKind } from './invoiceTexts';

/**
 * Первый счёт продавца по согласованной сделке (22.11.2026).
 *
 * Весь НДС с цены и первоначальный взнос — одним счётом до передачи
 * машины (AVL 15 § 1 mom 1–2 k; Verohallinto, Opas 11.1, пример 88).
 * В счёте вся цена, НДС и итог; «к оплате сейчас» — взнос + НДС, остаток
 * — взносами по договору без НДС. Режимы без НДС — с пометкой
 * (маржинальная схема только для перепродавца, AVL 79 a §; AVL 61 §).
 *
 * Два шага: строка счёта с номером (один раз — закрепление «где пусто»
 * и только у согласованной сделки), потом PDF и письмо. Если второй шаг
 * сорвался, повтор допечатывает и досылает уже выданный номер. Если
 * сорвалось между закреплением и номером (у счёта остался DRAFT-…),
 * повтор сначала выдаёт номер (22.11.2026).
 *
 * Счёт, по которому сейчас платить нечего (старая сделка без НДС и без
 * взноса), считается оплаченным сразу при выставлении — иначе передача
 * ждала бы отметки об оплате нуля (22.11.2026). У новых сделок НДС есть
 * всегда, и такого счёта не бывает.
 *
 * Счёт от имени продавца, деньги идут продавцу; RAHTIS их не принимает.
 *
 * 23.11.2026: тот же счёт выставляется в Эстонии и Латвии — там НДС тоже
 * возникает со всей цены при передаче, а аванс облагается в оплаченной
 * части (KMS § 11; PVN likums 120. p.). Отличаются тексты и подписи (язык
 * страны с английским, свои ссылки на закон — invoiceTexts.ts), ссылка
 * платежа (RF вместо финского viitenumero) и «сегодня» (пояс страны).
 * Страна продавца записывается в счёт (seller.country): повторная печать
 * берёт её оттуда; у счетов до этой даты её нет — они финские.
 *
 * 23.11.2026, Литва и Германия: первый документ бывает не счётом
 * (firstDocumentKind). Литва — всегда предварительный счёт (išankstinio
 * mokėjimo sąskaita): взнос и сумма, равная НДС всей цены, одной строкой и
 * без строк НДС; номер — от номера договора (IS-…), серию счетов он не
 * занимает; счёт с НДС выписывается в день передачи (payments.ts
 * issueHandoverVatInvoice). Германия с 01.01.2027 — платёжная информация без
 * НДС (номер из серии, как у латвийского уведомления). Вид документа
 * записывается в счёт (seller.document): по нему печать, отмена и сумма «к
 * оплате сейчас» — у такого документа это весь его итог.
 *
 * 23.11.2026, Польша и Румыния: первый документ — всегда уведомление о платеже
 * (NOTICE) без НДС с номером от номера договора (IP-…, NP-…): серию счетов
 * продавца он не занимает, а счёт продавец выставляет сам в KSeF / RO
 * e-Factura. В примечании — что этот счёт должен содержать (цена без НДС, НДС,
 * цена с НДС, НДС внутри аванса). Передача ждёт не оплаты этого документа, а
 * подтверждения продавца, что платёж получен (mark_installment_first_paid —
 * у этих стран и без документа платформы).
 */

const BUCKET = 'reports';
/** Номер-заглушка строки счёта, пока настоящий номер не выдан. */
const DRAFT_PREFIX = 'DRAFT-';

export type FirstInvoiceStatus = 'SENT' | 'CREATED' | 'EXISTS' | 'NO_IBAN' | 'IBAN_RECENT' | 'NO_EMAIL' | 'NOT_FOUND';

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Страна продавца, записанная в счёт; у счетов до 23.11.2026 её нет — они финские. */
const sellerCountry = (seller: unknown) => (seller as { country?: string | null } | null)?.country ?? 'FI';

/** Вид первого документа, записанный в счёт; нет — обычный счёт с НДС (23.11.2026). */
export const firstDocOf = (seller: unknown): PlainDocKind | null => {
  const doc = (seller as { document?: string } | null)?.document;
  return doc === 'PROFORMA' || doc === 'NOTICE' ? doc : null;
};

/**
 * Сколько по первому документу платить до передачи: у счёта — взнос и весь
 * НДС; у документа без НДС (Литва, Германия с 2027 года) — весь его итог, в
 * нём уже взнос и сумма НДС (23.11.2026).
 */
export const firstDueNowCents = (row: { seller: unknown; vat_cents: number; total_cents: number }, downPaymentCents: number) =>
  firstDocOf(row.seller) ? row.total_cents : downPaymentCents + row.vat_cents;

export async function createFirstInvoice(dealId: string): Promise<FirstInvoiceStatus> {
  const admin = createAdminClient();

  const { data: deal } = await admin.from('installment_deals').select('*').eq('id', dealId).maybeSingle();
  if (!deal || deal.status !== 'AGREED' || !deal.contract_number) return 'NOT_FOUND';

  if (deal.first_invoice_id) {
    const { data: existing } = await admin
      .from('carrier_invoices')
      .select('id, company_id, number, issued_on, file_path, sent_at, vat_cents, total_cents, seller')
      .eq('id', deal.first_invoice_id)
      .maybeSingle();
    if (!existing) return 'NOT_FOUND';
    const country = sellerCountry(existing.seller);
    /* К оплате сейчас — по виду документа: у предварительного счёта и уведомления без НДС это весь итог. */
    const dueNow = firstDueNowCents(existing, deal.down_payment_cents);
    if (!existing.number.startsWith(DRAFT_PREFIX)) await settleIfNothingDue(deal.id, existing.id, dueNow, 0, country);
    if (existing.file_path && existing.sent_at) return 'EXISTS';
    /*
     * Процесс оборвался после закрепления счёта, но до номера: раньше
     * повтор навсегда упирался в NOT_FOUND у deliver (22.11.2026).
     */
    if (existing.number.startsWith(DRAFT_PREFIX)) {
      await assignNumber(existing.id, existing.company_id, existing.issued_on, country, fixedNumber(firstDocOf(existing.seller), country, deal.contract_number));
      await settleIfNothingDue(deal.id, existing.id, dueNow, 0, country);
    }
    return deliver(existing.id, deal);
  }

  const [{ data: seller }, { data: buyer }] = await Promise.all([
    admin
      .from('companies')
      .select('id, name, country, business_id, vat_number, iban, legal_name, legal_street, legal_postal_code, legal_city, contact_email, billing_email')
      .eq('id', deal.seller_company_id)
      .maybeSingle(),
    admin
      .from('companies')
      .select('id, name, business_id, vat_number, legal_name, legal_street, legal_postal_code, legal_city, billing_street, billing_postal_code, billing_city, billing_email, billing_reference, contact_email')
      .eq('id', deal.buyer_company_id)
      .maybeSingle(),
  ]);
  if (!seller || !buyer) return 'NOT_FOUND';
  /*
   * Этот счёт — «весь НДС с цены первым счётом» (финское правило). Он
   * выставляется только в стране, у которой так записано в реестре стран
   * раздела (23.11.2026); стране с другим порядком нужен свой первый счёт,
   * и до его появления она закрыта. Литва (23.11.2026): счёт с НДС — при
   * передаче, а первым идёт предварительный счёт (vatInvoiceAtHandover).
   */
  const entry = installmentCountryEntry(seller.country);
  /* Польша и Румыния (23.11.2026): первый документ — уведомление о платеже, счёт выставляет продавец в KSeF / RO e-Factura. */
  if (entry?.vatOnFirstInvoice !== true && entry?.vatInvoiceAtHandover !== true && entry?.sellerInvoices !== true) return 'NOT_FOUND';
  if (!seller.iban) return 'NO_IBAN';
  const changedAt = await lastIbanChange(seller.id);
  if (changedAt && ibanHoldActive(changedAt)) return 'IBAN_RECENT';
  const sendTo = (buyer.billing_email || buyer.contact_email || '').trim().toLowerCase();
  if (!sendTo) return 'NO_EMAIL';

  const snapshot = (deal.vehicle_snapshot ?? {}) as { make?: string; plate?: string };
  const vatMode = deal.vat_mode as VatMode;
  const netCents = deal.price_cents;
  const vatCents = vatOf(netCents, vatMode, deal.vat_bps);
  /* «Сегодня» — по часовому поясу страны продавца (у Финляндии — Хельсинки, как было). */
  const issuedOn = installmentToday(seller.country);
  const tx = invoiceTexts(seller.country);
  /* Оплата до передачи: срок — накануне передачи, но не раньше сегодняшнего дня. */
  const dayBefore = addDays(deal.handover_date, -1);
  const dueOn = dayBefore > issuedOn ? dayBefore : issuedOn;

  const sellerAddress = [seller.legal_street, [seller.legal_postal_code, seller.legal_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const buyerAddress = [
    buyer.billing_street ?? buyer.legal_street,
    [buyer.billing_postal_code ?? buyer.legal_postal_code, buyer.billing_city ?? buyer.legal_city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
  const what = [snapshot.make, snapshot.plate].filter(Boolean).join(' ');
  /*
   * Документ без НДС (Литва — предварительный счёт; Германия с 2027 года —
   * платёжная информация): одна строка «взнос и сумма НДС всей цены», налог не
   * выделяется. Иначе — счёт со всей ценой, как было.
   */
  const kind = firstDocumentKind(seller.country, issuedOn, deal.handover_date);
  const doc: PlainDocKind | null = kind === 'INVOICE' ? null : kind;
  const docLine =
    kind === 'PROFORMA' ? tx.proforma?.line : kind === 'NOTICE' ? tx.notice?.firstLine : undefined;
  if (doc && !docLine) return 'NOT_FOUND';
  const docCents = deal.down_payment_cents + vatCents;
  const lines = [
    doc && docLine
      ? {
          date: deal.handover_date,
          text: docLine({ what, contract: deal.contract_number }),
          quantity: 1,
          unit: tx.unit,
          unitCents: docCents,
          amountCents: docCents,
        }
      : {
          date: deal.handover_date,
          text: tx.first.line({ what, contract: deal.contract_number }),
          quantity: 1,
          unit: tx.unit,
          unitCents: netCents,
          amountCents: netCents,
        },
  ];

  const { data: invoice, error } = await admin
    .from('carrier_invoices')
    .insert({
      company_id: seller.id,
      kind: 'INSTALLMENT',
      customer_company_id: buyer.id,
      job_id: null,
      number: `${DRAFT_PREFIX}${crypto.randomUUID()}`,
      reference: '',
      issued_on: issuedOn,
      due_on: dueOn,
      period_from: deal.handover_date,
      period_to: deal.handover_date,
      seller: {
        name: seller.legal_name || seller.name,
        business_id: seller.business_id,
        vat_id: seller.vat_number,
        iban: seller.iban,
        address: sellerAddress,
        email: seller.billing_email || seller.contact_email,
        country: seller.country,
        /* Вид документа, если это не счёт (23.11.2026); у счёта поля нет, как было. */
        ...(doc ? { document: doc } : {}),
      },
      customer: {
        name: buyer.legal_name || buyer.name,
        business_id: buyer.business_id,
        vat_id: buyer.vat_number,
        address: buyerAddress,
        email: sendTo,
        reference: buyer.billing_reference,
      },
      lines,
      net_cents: doc ? docCents : netCents,
      vat_bps: !doc && vatMode === 'STANDARD' ? deal.vat_bps : 0,
      vat_cents: doc ? 0 : vatCents,
      total_cents: doc ? docCents : netCents + vatCents,
      /* Валюта счёта — валюта сделки (страны продавца), без пересчёта (23.11.2026). */
      currency: asCurrency(deal.currency),
    })
    .select('id')
    .single();
  if (error || !invoice) throw new Error(`первый счёт: ${error?.message}`);

  /* Закрепить «где пусто» и только у согласованной сделки: отмена между чтением и записью не даст счёта. */
  const { data: claimed } = await admin
    .from('installment_deals')
    .update({ first_invoice_id: invoice.id })
    .eq('id', deal.id)
    .eq('status', 'AGREED')
    .is('first_invoice_id', null)
    .select('id');
  if ((claimed ?? []).length !== 1) {
    await admin.from('carrier_invoices').delete().eq('id', invoice.id);
    return 'EXISTS';
  }

  /* Номер не выдан или не записан — счёт без номера не оставляем: снять закрепление и удалить, повтор начнёт заново. */
  try {
    await assignNumber(invoice.id, seller.id, issuedOn, seller.country, fixedNumber(doc, seller.country, deal.contract_number));
  } catch (cause) {
    await admin.from('installment_deals').update({ first_invoice_id: null }).eq('id', deal.id);
    await admin.from('carrier_invoices').delete().eq('id', invoice.id);
    throw cause;
  }

  await settleIfNothingDue(deal.id, invoice.id, deal.down_payment_cents, vatCents, seller.country);
  return deliver(invoice.id, deal);
}

/**
 * Номер документа, который не занимает серию счетов (23.11.2026): у
 * литовского предварительного счёта — от номера договора. null — номер из
 * серии продавца, как у счёта (и у немецкой платёжной информации).
 */
function fixedNumber(doc: PlainDocKind | null, country: string | null, contract: string | null): string | null {
  if (!contract) return null;
  if (doc === 'PROFORMA') return invoiceTexts(country).proforma?.number({ contract }) ?? null;
  /* Польша и Румыния (23.11.2026): уведомление — тоже от номера договора; у немецкой платёжной информации номера в текстах нет — серия, как было. */
  if (doc === 'NOTICE') return invoiceTexts(country).notice?.number?.({ contract }) ?? null;
  return null;
}

/**
 * Счёт выставлен, а платить по нему сейчас нечего (взнос 0 и НДС 0) —
 * отметка об оплате ставится сразу, передача не ждёт продавца
 * (22.11.2026). Только «где пусто» и только у согласованной сделки:
 * повтор ничего не перепишет.
 */
async function settleIfNothingDue(dealId: string, invoiceId: string, downPaymentCents: number, vatCents: number, country: string | null): Promise<void> {
  if (!firstInvoiceSettledAtIssue(downPaymentCents, vatCents)) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from('installment_deals')
    .update({ first_invoice_paid_at: new Date().toISOString() })
    .eq('id', dealId)
    .eq('status', 'AGREED')
    .is('first_invoice_paid_at', null);
  if (error) throw new Error(`первый счёт без суммы к оплате: ${error.message}`);
  /* paid_at у счёта — дата: день по времени страны продавца (у Финляндии — Хельсинки). */
  await admin.from('carrier_invoices').update({ paid_at: installmentToday(country) }).eq('id', invoiceId).is('paid_at', null);
}

/**
 * Номер из серии продавца — счёту, у которого его ещё нет. Запись «где
 * ещё DRAFT-…»: параллельный повтор не перепишет уже выданный номер.
 * Ошибка записи не глотается: без номера счёт не печатается.
 */
async function assignNumber(invoiceId: string, sellerId: string, issuedOn: string, country: string | null, fixed: string | null = null): Promise<void> {
  const admin = createAdminClient();
  const { data: number, error: numberError } = fixed
    ? { data: fixed, error: null }
    : await admin.rpc('next_carrier_invoice_number', {
        p_company_id: sellerId,
        p_year: Number(issuedOn.slice(0, 4)),
      });
  if (numberError || !number) throw new Error(`номер счёта: ${numberError?.message}`);
  const { error } = await admin
    .from('carrier_invoices')
    /* Ссылка платежа: финскому продавцу — viitenumero, остальным — международная RF (ISO 11649). */
    .update({ number, reference: paymentReference(number, country) })
    .eq('id', invoiceId)
    .like('number', `${DRAFT_PREFIX}%`);
  if (error) throw new Error(`номер счёта не записан: ${error.message}`);
}

export type Deal = {
  id: string;
  contract_number: string | null;
  down_payment_cents: number;
  price_cents: number;
  months: number;
  vat_mode: string;
  vat_bps: number;
  handover_date: string;
};

/** Строка первого документа, как она записана в carrier_invoices (для печати). */
export type FirstDocRow = {
  number: string;
  issued_on: string;
  due_on: string;
  reference: string;
  seller: unknown;
  customer: unknown;
  lines: unknown;
  net_cents: number;
  vat_cents: number;
  total_cents: number;
  currency: string | null;
};

/**
 * Что печатается и что уходит письмом по первому документу (23.11.2026):
 * чистая функция без базы — её же вызывает проверка печати. Для счёта
 * (всех стран до 23.11.2026) — то же, что печаталось раньше; для документа
 * без НДС (Литва, Германия с 2027 года) — свой заголовок и подписи, без строк
 * НДС, к оплате — весь итог.
 */
export function firstDocumentPdf(inv: FirstDocRow, deal: Deal): { pdf: SiteInvoicePdfInput; subject: string; text: string; filename: string } {
  /* Тексты, подписи и вид чисел — по стране продавца, записанной в счёте. */
  const country = sellerCountry(inv.seller);
  const tx = invoiceTexts(country);
  const f = createFormat(tx.intl);
  const fiDate = tx.date;
  const doc = firstDocOf(inv.seller);
  const plain = plainDoc(tx, doc);
  /* Латвия с 2028 года: PDF счётом быть перестаёт — документ выходит платёжным уведомлением (invoiceTexts.ts). */
  const notice = !doc && documentKind(country, inv.issued_on) === 'NOTICE' ? tx.notice : null;

  const seller = inv.seller as { name: string; business_id: string; vat_id: string | null; iban: string; address: string; email: string };
  const customer = inv.customer as { name: string; business_id: string | null; vat_id: string | null; address: string; email: string };
  const lines = inv.lines as { date: string; text: string; unit: string; unitCents: number; amountCents: number }[];
  const vatMode = deal.vat_mode as VatMode;
  /* Суммы — в валюте самого счёта (она же валюта сделки). */
  const currency = asCurrency(inv.currency);
  const payNowCents = firstDueNowCents(inv, deal.down_payment_cents);
  const restCents = deal.price_cents - deal.down_payment_cents;
  const what = lines[0]?.text.split(' – ')[0] ?? '';
  /* НДС всей цены — для текста документа без НДС: в строке документа он не выделен. */
  const vatOfPrice = doc ? payNowCents - deal.down_payment_cents : inv.vat_cents;

  const vatLabel = tx.vatLabel(
    vatMode === 'STANDARD' ? (deal.vat_bps / 100).toLocaleString(tx.intl, { maximumFractionDigits: 1 }) : null,
  );
  const noteArgs = {
    down: f.money(deal.down_payment_cents, currency),
    vat: f.money(vatOfPrice, currency),
    rest: f.money(restCents, currency),
    months: deal.months,
    contract: deal.contract_number ?? '',
    vatMode,
    /*
     * Что должен содержать счёт продавца в KSeF / RO e-Factura (23.11.2026):
     * читают только тексты Польши и Румынии, остальные эти поля не используют.
     * НДС внутри платежа до передачи — платёж считается суммой с НДС (Польша, art. 19a ust. 8).
     */
    price: f.money(deal.price_cents, currency),
    vatPercent: (deal.vat_bps / 100).toLocaleString(tx.intl, { maximumFractionDigits: 1 }),
    gross: f.money(deal.price_cents + vatOfPrice, currency),
    advance: f.money(payNowCents, currency),
    advanceVat: f.money(vatMode === 'STANDARD' ? Math.round((payNowCents * deal.vat_bps) / (10_000 + deal.vat_bps)) : 0, currency),
    handover: fiDate(deal.handover_date),
  };
  const note =
    doc === 'NOTICE' && tx.notice?.firstNote
      ? [tx.notice.note, tx.notice.firstNote(noteArgs)].filter(Boolean).join('\n')
      : [notice?.note, tx.first.note(noteArgs)].filter(Boolean).join('\n');

  const pdf: SiteInvoicePdfInput = {
    number: inv.number,
    issuedOn: fiDate(inv.issued_on),
    dueOn: fiDate(inv.due_on),
    reference: inv.reference,
    seller: { name: seller.name, businessId: seller.business_id, vatId: seller.vat_id, address: seller.address, iban: seller.iban, email: seller.email },
    customer: { name: customer.name, businessId: customer.business_id, vatId: customer.vat_id, address: customer.address },
    job: `${what} · ${deal.contract_number}`,
    jobLabel: tx.first.jobLabel,
    period: fiDate(deal.handover_date),
    periodLabel: tx.first.periodLabel,
    lines: lines.map((l) => ({
      date: fiDate(l.date),
      text: l.text,
      quantity: '1',
      unit: l.unit,
      unitPrice: f.money(l.unitCents, currency),
      amount: f.money(l.amountCents, currency),
    })),
    net: f.money(inv.net_cents, currency),
    vatLabel,
    vat: f.money(inv.vat_cents, currency),
    total: f.money(inv.total_cents, currency),
    /* У документа без НДС к оплате — весь итог: отдельной строки «к оплате сейчас» нет. */
    payNow: doc ? undefined : { label: tx.first.payNowLabel, amount: f.money(payNowCents, currency) },
    note,
    labels: doc ? plainDocLabels(tx, doc) : documentLabels(tx, Boolean(notice)),
    title: plain?.title ?? notice?.title,
    docName: plain?.docName ?? notice?.docName,
    ...(plain?.noVat ? { noVat: true } : {}),
  };

  const mailArgs = {
    number: inv.number,
    contract: deal.contract_number ?? '',
    what,
    seller: seller.name,
    sellerEmail: seller.email,
    payNow: f.money(payNowCents, currency),
    due: fiDate(inv.due_on),
    iban: seller.iban,
    reference: inv.reference,
  };
  const subjectArgs = { number: inv.number, seller: seller.name, contract: deal.contract_number ?? '' };
  /* Германия с 2027 года: письмо о платёжной информации, а не о счёте. */
  const noticeMail = doc === 'NOTICE' ? tx.notice : null;
  return {
    pdf,
    subject: noticeMail?.firstMailSubject ? noticeMail.firstMailSubject(subjectArgs) : tx.first.mailSubject(subjectArgs),
    text: noticeMail?.firstMailText ? noticeMail.firstMailText(mailArgs) : tx.first.mailText(mailArgs),
    filename: `${plain?.filePrefix ?? tx.filePrefix}-${inv.number}.pdf`,
  };
}

/** PDF и письмо по уже записанному счёту — и при первом выставлении, и при повторе. */
async function deliver(invoiceId: string, deal: Deal): Promise<FirstInvoiceStatus> {
  const admin = createAdminClient();
  const { data: inv } = await admin.from('carrier_invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (!inv || inv.number.startsWith(DRAFT_PREFIX)) return 'NOT_FOUND';
  const built = firstDocumentPdf(inv, deal);
  const customer = inv.customer as { name: string; email: string };
  const seller = inv.seller as { email: string };

  const buffer = await renderToBuffer(SiteInvoicePdf(built.pdf));

  const path = `installment-invoices/${inv.company_id}/${inv.number}.pdf`;
  const { error: upload } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: 'application/pdf', upsert: true });
  if (upload) throw new Error(`загрузка счёта: ${upload.message}`);
  await admin.from('carrier_invoices').update({ file_path: path }).eq('id', inv.id);

  const mail = await sendEmail({
    template: 'installment_first_invoice',
    to: customer.email,
    toName: customer.name,
    replyTo: seller.email,
    subject: built.subject,
    text: built.text,
    attachments: [{ bucket: BUCKET, path, filename: built.filename }],
    companyId: inv.company_id,
  });

  if (mail.sent) {
    await admin.from('carrier_invoices').update({ sent_to: customer.email, sent_at: new Date().toISOString() }).eq('id', inv.id);
  }
  return mail.sent ? 'SENT' : 'CREATED';
}
