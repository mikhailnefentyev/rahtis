import 'server-only';

import { renderToBuffer } from '@react-pdf/renderer';
import { todayInHelsinki } from '@/lib/dates';
import { sendEmail } from '@/lib/email';
import { emailLocaleOf } from '@/lib/email/text';
import { createFormat } from '@/lib/format';
import { notify } from '@/lib/notify';
import { finnishReference } from '@/lib/sites/invoice';
import { SiteInvoicePdf } from '@/lib/sites/SiteInvoicePdf';
import { createAdminClient } from '@/lib/supabase/admin';
import { ibanHoldActive } from '@/lib/trust/changes';
import { lastIbanChange } from '@/lib/trust/sensitive';
import { buildSchedule, daysBetween, remedyAllowed, type VatMode } from './calc';
import { fill, installmentUiCopy } from './copy';

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
 * Просрочка — только по взносам с отправленным счётом: напоминание
 * покупателю на 1-й и 7-й день, продавцу — один сигнал, когда выполнен
 * порог OskL 2 §. Машину задание не изымает и запуск не блокирует.
 */

const BUCKET = 'reports';
/** За сколько дней до срока выставлять счёт взноса. */
export const INVOICE_LEAD_DAYS = 14;

const fiDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const helsinkiDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(new Date(iso));

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
};

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
  const actual = helsinkiDay(deal.handed_over_at);
  const delay = Math.max(0, daysBetween(deal.handover_date, actual));
  const schedule = buildSchedule({
    priceCents: deal.price_cents,
    vatMode: deal.vat_mode as VatMode,
    vatBps: deal.vat_bps,
    downPaymentCents: deal.down_payment_cents,
    months: deal.months,
    finalCents: deal.final_cents,
    annualRateBps: deal.annual_rate_bps,
    handoverDate: delay > 0 ? actual : deal.handover_date,
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
      .select('id, name, legal_name, business_id, vat_number, iban, legal_street, legal_postal_code, legal_city, billing_email, contact_email')
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
  return { seller: sellerParty, buyer: buyerParty, sellerId: seller.id, iban: seller.iban };
}

/** IBAN есть и не менялся последние 48 часов — иначе автоматический счёт не выставляется. */
async function ibanReady(sellerId: string, iban: string | null): Promise<boolean> {
  if (!iban) return false;
  const changedAt = await lastIbanChange(sellerId);
  return !(changedAt && ibanHoldActive(changedAt));
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
      reference: finnishReference(number),
      issued_on: input.issuedOn,
      due_on: input.dueOn,
      period_from: input.issuedOn,
      period_to: input.dueOn,
      seller: { ...input.seller, meta: input.meta },
      customer: input.buyer,
      lines: input.lines.map((l) => ({ ...l, quantity: 1, unit: 'kpl' })),
      net_cents: netCents,
      vat_bps: input.vatBps,
      vat_cents: input.vatCents,
      total_cents: netCents + input.vatCents,
      currency: 'EUR',
    })
    .select('id')
    .single();
  if (error || !inv) throw new Error(`счёт: ${error?.message}`);
  return inv.id;
}

/** Шаг 2: PDF и письмо по записанному счёту; повтор безопасен. true — письмо отправлено. */
export async function deliverInvoice(invoiceId: string): Promise<boolean> {
  const admin = createAdminClient();
  const f = createFormat('fi-FI');
  const { data: inv } = await admin.from('carrier_invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (!inv) return false;
  if (inv.sent_at && inv.file_path) return true;
  const seller = inv.seller as Party & { meta?: Meta };
  const meta = seller.meta;
  if (!meta) return false;
  const buyer = inv.customer as Party;
  const lines = inv.lines as { date: string; text: string; unitCents: number; amountCents: number }[];

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
        jobLabel: ['Osamaksusopimus', 'Hire-purchase contract'],
        period: meta.period,
        periodLabel: meta.periodLabel,
        lines: lines.map((l) => ({
          date: fiDate(l.date),
          text: l.text,
          quantity: '1',
          unit: 'kpl',
          unitPrice: f.money(l.unitCents, 'EUR'),
          amount: f.money(l.amountCents, 'EUR'),
        })),
        net: f.money(inv.net_cents, 'EUR'),
        vatLabel: inv.vat_bps > 0 ? `ALV / VAT ${(inv.vat_bps / 100).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} %` : 'ALV / VAT 0 %',
        vat: f.money(inv.vat_cents, 'EUR'),
        total: f.money(inv.total_cents, 'EUR'),
        note: meta.note,
        title: meta.title,
        payNow: meta.payNow ? { label: meta.payNow.label, amount: f.money(meta.payNow.cents, 'EUR') } : undefined,
        amountLabel: meta.amountLabel,
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
    text: `${meta.mail.text}\n\nLasku / Invoice ${inv.number} · viitenumero / reference ${inv.reference}`,
    attachments: [{ bucket: BUCKET, path, filename: `Lasku-${inv.number}.pdf` }],
    companyId: inv.company_id,
  });
  if (mail.sent) {
    await admin.from('carrier_invoices').update({ sent_to: buyer.email, sent_at: new Date().toISOString() }).eq('id', inv.id);
  }
  return mail.sent;
}

export type IssueStatus = 'SENT' | 'CREATED' | 'EXISTS' | 'IBAN' | 'NOT_FOUND';

/** Счёт взноса n (без НДС: весь НДС был в первом счёте). */
export async function issuePaymentInvoice(paymentId: string): Promise<IssueStatus> {
  const admin = createAdminClient();
  const { data: pay } = await admin.from('installment_payments').select('*').eq('id', paymentId).maybeSingle();
  if (!pay) return 'NOT_FOUND';
  if (pay.invoice_id) return (await deliverInvoice(pay.invoice_id)) ? 'EXISTS' : 'CREATED';
  const { data: deal } = await admin.from('installment_deals').select('*').eq('id', pay.deal_id).maybeSingle();
  if (!deal || deal.status !== 'ACTIVE' || !deal.contract_number) return 'NOT_FOUND';
  const p = await parties(deal.seller_company_id, deal.buyer_company_id);
  if (!p) return 'NOT_FOUND';
  if (!(await ibanReady(p.sellerId, p.iban))) return 'IBAN';

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
  const f = createFormat('fi-FI');
  const total = f.money(pay.principal_cents + pay.interest_cents, 'EUR');
  const lines = [
    {
      date: pay.due_date,
      text: `Maksuerä ${pay.n}/${deal.months}, osamaksusopimus nro ${deal.contract_number} (${what}) / Instalment ${pay.n}/${deal.months}`,
      unitCents: pay.principal_cents,
      amountCents: pay.principal_cents,
    },
    ...(pay.interest_cents > 0
      ? [
          {
            date: pay.due_date,
            text: 'Korko, veroton rahoituspalvelu (AVL 41 §) / Interest, VAT-exempt financial service',
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
    issuedOn: todayInHelsinki(),
    dueOn: pay.due_date,
    lines,
    vatBps: 0,
    vatCents: 0,
    meta: {
      job: `${deal.contract_number} · ${what}`,
      period: `${pay.n} / ${deal.months}`,
      periodLabel: ['Maksuerä', 'Instalment'],
      note: [
        `Osamaksuerä ilman arvonlisäveroa: kauppahinnan arvonlisävero on laskutettu kokonaisuudessaan laskulla nro ${first?.number ?? '—'}. / The instalment has no VAT: VAT on the whole price was invoiced on invoice ${first?.number ?? '—'}.`,
        'Laskuttaja on myyjä; RAHTIS (Aivomaa Oy) ei ole kaupan osapuoli eikä vastaanota maksua. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale and does not receive the payment.',
      ].join('\n'),
      mail: {
        template: 'installment_payment_invoice',
        subject: `Lasku · ${p.seller.name} · maksuerä ${pay.n}/${deal.months}, sopimus ${deal.contract_number}`,
        text: [
          'Hei,',
          '',
          `liitteenä osamaksusopimuksen ${deal.contract_number} maksuerän ${pay.n}/${deal.months} lasku (${what}).`,
          `Maksettava ${total}, eräpäivä ${fiDate(pay.due_date)}. Tilinumero (IBAN) ${p.seller.iban}.`,
          'Maksu suoritetaan suoraan myyjälle, ei RAHTIS-palvelulle eikä Aivomaa Oy:lle.',
          '',
          '—',
          `Attached is the invoice for instalment ${pay.n}/${deal.months} of hire-purchase contract ${deal.contract_number}. Amount ${total}, due ${fiDate(pay.due_date)}, IBAN ${p.seller.iban}. Pay the seller directly.`,
        ].join('\n'),
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
  const issuedOn = todayInHelsinki();
  /* Возвращается только уплаченное по первому счёту: взнос и весь НДС; не оплачен — возврата нет. */
  const f = createFormat('fi-FI');
  const refundCents = deal.first_invoice_paid_at ? deal.down_payment_cents + original.vat_cents : 0;

  const invoiceId = await createInvoiceRow({
    sellerId: deal.seller_company_id,
    buyerId: deal.buyer_company_id,
    seller: p.seller,
    buyer: p.buyer,
    issuedOn,
    dueOn: issuedOn,
    lines: originalLines.map((l) => ({ date: issuedOn, text: `Hyvitys / Credit: ${l.text}`, unitCents: -l.unitCents, amountCents: -l.amountCents })),
    vatBps: original.vat_bps,
    vatCents: -original.vat_cents,
    meta: {
      job: `${deal.contract_number} · peruttu / cancelled`,
      period: original.number,
      periodLabel: ['Hyvitettävä lasku', 'Credited invoice'],
      title: 'HYVITYSLASKU / CREDIT NOTE',
      payNow: { label: ['Palautetaan ostajalle', 'Refunded to the buyer'], cents: refundCents },
      amountLabel: ['Palautetaan', 'Refund'],
      note: [
        `HYVITYSLASKU / CREDIT NOTE. Hyvittää laskun nro ${original.number} (${fiDate(original.issued_on)}) kokonaisuudessaan, koska osamaksukauppa ${deal.contract_number} peruttiin ennen ajoneuvon luovutusta. ${refundCents > 0 ? `Myyjä palauttaa ostajalle maksetun ${f.money(refundCents, 'EUR')}.` : 'Laskua ei ollut maksettu, joten palautettavaa ei ole.'} / Credits invoice ${original.number} in full because hire-purchase ${deal.contract_number} was cancelled before handover. ${refundCents > 0 ? `The seller refunds the ${f.money(refundCents, 'EUR')} paid to the buyer.` : 'The invoice was not paid, so nothing is refunded.'}`,
        'Laskuttaja on myyjä; RAHTIS (Aivomaa Oy) ei ole kaupan osapuoli. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale.',
      ].join('\n'),
      mail: {
        template: 'installment_credit_note',
        subject: `Hyvityslasku · ${p.seller.name} · lasku ${original.number}`,
        text: [
          'Hei,',
          '',
          `liitteenä hyvityslasku, joka hyvittää laskun ${original.number}: osamaksukauppa ${deal.contract_number} on peruttu ennen luovutusta.`,
          '',
          '—',
          `Attached is a credit note crediting invoice ${original.number}: hire-purchase ${deal.contract_number} was cancelled before handover.`,
        ].join('\n'),
      },
    },
  });
  await admin.from('installment_deals').update({ credit_note_id: invoiceId }).eq('id', dealId);
  return (await deliverInvoice(invoiceId)) ? 'SENT' : 'CREATED';
}

export type RunResult = { deals: number; invoices: number; reminders: number; thresholds: number; errors: string[] };

/** Каждое утро (или по одной сделке после передачи): график, счета взносов, просрочки. */
export async function runInstallments(options: { dealId?: string; today?: string } = {}): Promise<RunResult> {
  const today = options.today ?? todayInHelsinki();
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
    result.deals += 1;
    try {
      await ensureSchedule(deal.id);
      const { data: rows } = await admin.from('installment_payments').select('*').eq('deal_id', deal.id).order('n');

      for (const row of rows ?? []) {
        if (row.paid_at) continue;
        if (!row.invoice_id && row.due_date <= addDays(today, INVOICE_LEAD_DAYS)) {
          const status = await issuePaymentInvoice(row.id);
          if (status === 'SENT' || status === 'CREATED') result.invoices += 1;
        } else if (row.invoice_id) {
          /* Не дошедший счёт — дослать. */
          await deliverInvoice(row.invoice_id);
        }
      }

      /* Просрочка — только по взносам, счёт которых отправлен покупателю. */
      const { data: fresh } = await admin.from('installment_payments').select('*').eq('deal_id', deal.id).order('n');
      const invoiceIds = (fresh ?? []).map((r) => r.invoice_id).filter((v): v is string => Boolean(v));
      const { data: invs } = invoiceIds.length
        ? await admin.from('carrier_invoices').select('id, sent_at').in('id', invoiceIds)
        : { data: [] as { id: string; sent_at: string | null }[] };
      const sent = new Set((invs ?? []).filter((i) => i.sent_at).map((i) => i.id));
      const overdue = (fresh ?? []).filter((r) => !r.paid_at && r.due_date < today && r.invoice_id && sent.has(r.invoice_id));

      const plate = ((deal.vehicle_snapshot ?? {}) as { plate?: string }).plate ?? '';
      const [{ data: buyer }, { data: seller }] = await Promise.all([
        admin.from('companies').select('language').eq('id', deal.buyer_company_id).maybeSingle(),
        admin.from('companies').select('language').eq('id', deal.seller_company_id).maybeSingle(),
      ]);
      const cb = installmentUiCopy(emailLocaleOf(buyer?.language ?? 'fi'));
      const cs = installmentUiCopy(emailLocaleOf(seller?.language ?? 'fi'));

      for (const row of overdue) {
        const late = daysBetween(row.due_date, today);
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
          title: fill(cb.notify.overdueTitle, { plate, n: String(row.n) }),
          body: fill(cb.notify.overdueBody, { days: String(late), date: fiDate(row.due_date) }),
          link: `/carrier/installments/${deal.id}`,
        });
        result.reminders += 1;
      }

      const priceGross =
        deal.price_cents + (deal.vat_mode === 'STANDARD' ? Math.round((deal.price_cents * deal.vat_bps) / 10_000) : 0);
      const remaining = (fresh ?? []).filter((r) => !r.paid_at).reduce((s, r) => s + r.principal_cents, 0);
      const allowed = remedyAllowed(
        overdue.map((r) => ({ dueDate: r.due_date, unpaidCents: r.principal_cents })),
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
            title: fill(cs.notify.thresholdTitle, { plate }),
            body: cs.notify.thresholdBody,
            link: `/carrier/installments/${deal.id}`,
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
