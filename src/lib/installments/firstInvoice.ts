import 'server-only';

import { renderToBuffer } from '@react-pdf/renderer';
import { todayInHelsinki } from '@/lib/dates';
import { sendEmail } from '@/lib/email';
import { createFormat } from '@/lib/format';
import { finnishReference } from '@/lib/sites/invoice';
import { SiteInvoicePdf } from '@/lib/sites/SiteInvoicePdf';
import { createAdminClient } from '@/lib/supabase/admin';
import { ibanHoldActive } from '@/lib/trust/changes';
import { lastIbanChange } from '@/lib/trust/sensitive';
import { firstInvoiceSettledAtIssue, vatOf, type VatMode } from './calc';

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
 */

const BUCKET = 'reports';
/** Номер-заглушка строки счёта, пока настоящий номер не выдан. */
const DRAFT_PREFIX = 'DRAFT-';

export type FirstInvoiceStatus = 'SENT' | 'CREATED' | 'EXISTS' | 'NO_IBAN' | 'IBAN_RECENT' | 'NO_EMAIL' | 'NOT_FOUND';

const fiDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const VAT_NOTE: Record<VatMode, string> = {
  STANDARD: '',
  MARGIN: 'Voittomarginaalijärjestelmä – käytetyt tavarat. / Margin scheme – second-hand goods.',
  EXEMPT: 'Veroton myynti, AVL 61 §. / VAT-exempt sale, VAT Act s. 61.',
  NONE: 'Myyjä ei ole arvonlisäverovelvollinen. / The seller is not VAT-registered.',
};

export async function createFirstInvoice(dealId: string): Promise<FirstInvoiceStatus> {
  const admin = createAdminClient();

  const { data: deal } = await admin.from('installment_deals').select('*').eq('id', dealId).maybeSingle();
  if (!deal || deal.status !== 'AGREED' || !deal.contract_number) return 'NOT_FOUND';

  if (deal.first_invoice_id) {
    const { data: existing } = await admin
      .from('carrier_invoices')
      .select('id, company_id, number, issued_on, file_path, sent_at, vat_cents')
      .eq('id', deal.first_invoice_id)
      .maybeSingle();
    if (!existing) return 'NOT_FOUND';
    if (!existing.number.startsWith(DRAFT_PREFIX)) await settleIfNothingDue(deal.id, existing.id, deal.down_payment_cents, existing.vat_cents);
    if (existing.file_path && existing.sent_at) return 'EXISTS';
    /*
     * Процесс оборвался после закрепления счёта, но до номера: раньше
     * повтор навсегда упирался в NOT_FOUND у deliver (22.11.2026).
     */
    if (existing.number.startsWith(DRAFT_PREFIX)) {
      await assignNumber(existing.id, existing.company_id, existing.issued_on);
      await settleIfNothingDue(deal.id, existing.id, deal.down_payment_cents, existing.vat_cents);
    }
    return deliver(existing.id, deal);
  }

  const [{ data: seller }, { data: buyer }] = await Promise.all([
    admin
      .from('companies')
      .select('id, name, business_id, vat_number, iban, legal_name, legal_street, legal_postal_code, legal_city, contact_email, billing_email')
      .eq('id', deal.seller_company_id)
      .maybeSingle(),
    admin
      .from('companies')
      .select('id, name, business_id, vat_number, legal_name, legal_street, legal_postal_code, legal_city, billing_street, billing_postal_code, billing_city, billing_email, billing_reference, contact_email')
      .eq('id', deal.buyer_company_id)
      .maybeSingle(),
  ]);
  if (!seller || !buyer) return 'NOT_FOUND';
  if (!seller.iban) return 'NO_IBAN';
  const changedAt = await lastIbanChange(seller.id);
  if (changedAt && ibanHoldActive(changedAt)) return 'IBAN_RECENT';
  const sendTo = (buyer.billing_email || buyer.contact_email || '').trim().toLowerCase();
  if (!sendTo) return 'NO_EMAIL';

  const snapshot = (deal.vehicle_snapshot ?? {}) as { make?: string; plate?: string };
  const vatMode = deal.vat_mode as VatMode;
  const netCents = deal.price_cents;
  const vatCents = vatOf(netCents, vatMode, deal.vat_bps);
  const issuedOn = todayInHelsinki();
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
  const lines = [
    {
      date: deal.handover_date,
      text: `${what} – kauppahinta, osamaksusopimus nro ${deal.contract_number} / purchase price, hire-purchase contract`,
      quantity: 1,
      unit: 'kpl',
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
      net_cents: netCents,
      vat_bps: vatMode === 'STANDARD' ? deal.vat_bps : 0,
      vat_cents: vatCents,
      total_cents: netCents + vatCents,
      currency: 'EUR',
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
    await assignNumber(invoice.id, seller.id, issuedOn);
  } catch (cause) {
    await admin.from('installment_deals').update({ first_invoice_id: null }).eq('id', deal.id);
    await admin.from('carrier_invoices').delete().eq('id', invoice.id);
    throw cause;
  }

  await settleIfNothingDue(deal.id, invoice.id, deal.down_payment_cents, vatCents);
  return deliver(invoice.id, deal);
}

/**
 * Счёт выставлен, а платить по нему сейчас нечего (взнос 0 и НДС 0) —
 * отметка об оплате ставится сразу, передача не ждёт продавца
 * (22.11.2026). Только «где пусто» и только у согласованной сделки:
 * повтор ничего не перепишет.
 */
async function settleIfNothingDue(dealId: string, invoiceId: string, downPaymentCents: number, vatCents: number): Promise<void> {
  if (!firstInvoiceSettledAtIssue(downPaymentCents, vatCents)) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from('installment_deals')
    .update({ first_invoice_paid_at: new Date().toISOString() })
    .eq('id', dealId)
    .eq('status', 'AGREED')
    .is('first_invoice_paid_at', null);
  if (error) throw new Error(`первый счёт без суммы к оплате: ${error.message}`);
  /* paid_at у счёта — дата: день по Хельсинки. */
  await admin.from('carrier_invoices').update({ paid_at: todayInHelsinki() }).eq('id', invoiceId).is('paid_at', null);
}

/**
 * Номер из серии продавца — счёту, у которого его ещё нет. Запись «где
 * ещё DRAFT-…»: параллельный повтор не перепишет уже выданный номер.
 * Ошибка записи не глотается: без номера счёт не печатается.
 */
async function assignNumber(invoiceId: string, sellerId: string, issuedOn: string): Promise<void> {
  const admin = createAdminClient();
  const { data: number, error: numberError } = await admin.rpc('next_carrier_invoice_number', {
    p_company_id: sellerId,
    p_year: Number(issuedOn.slice(0, 4)),
  });
  if (numberError || !number) throw new Error(`номер счёта: ${numberError?.message}`);
  const { error } = await admin
    .from('carrier_invoices')
    .update({ number, reference: finnishReference(number) })
    .eq('id', invoiceId)
    .like('number', `${DRAFT_PREFIX}%`);
  if (error) throw new Error(`номер счёта не записан: ${error.message}`);
}

type Deal = {
  id: string;
  contract_number: string | null;
  down_payment_cents: number;
  price_cents: number;
  months: number;
  vat_mode: string;
  vat_bps: number;
  handover_date: string;
};

/** PDF и письмо по уже записанному счёту — и при первом выставлении, и при повторе. */
async function deliver(invoiceId: string, deal: Deal): Promise<FirstInvoiceStatus> {
  const admin = createAdminClient();
  const f = createFormat('fi-FI');
  const { data: inv } = await admin.from('carrier_invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (!inv || inv.number.startsWith(DRAFT_PREFIX)) return 'NOT_FOUND';

  const seller = inv.seller as { name: string; business_id: string; vat_id: string | null; iban: string; address: string; email: string };
  const customer = inv.customer as { name: string; business_id: string | null; vat_id: string | null; address: string; email: string };
  const lines = inv.lines as { date: string; text: string; unit: string; unitCents: number; amountCents: number }[];
  const vatMode = deal.vat_mode as VatMode;
  const currency = 'EUR' as const;
  const payNowCents = deal.down_payment_cents + inv.vat_cents;
  const restCents = deal.price_cents - deal.down_payment_cents;
  const what = lines[0]?.text.split(' – ')[0] ?? '';

  const vatLabel =
    vatMode === 'STANDARD'
      ? `ALV / VAT ${(deal.vat_bps / 100).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} %`
      : 'ALV / VAT 0 %';
  const note = [
    `Osamaksukauppa: koko kauppahinnan arvonlisävero laskutetaan tällä laskulla. Maksettava nyt: käsiraha ${f.money(deal.down_payment_cents, currency)} + arvonlisävero ${f.money(inv.vat_cents, currency)}. Loppuosa ${f.money(restCents, currency)} maksetaan ${deal.months} erässä osamaksusopimuksen nro ${deal.contract_number} mukaisesti; erät eivät sisällä arvonlisäveroa. Omistusoikeus säilyy myyjällä, kunnes kauppahinta on kokonaan maksettu. Ajoneuvo luovutetaan, kun tämä lasku on maksettu.`,
    `Hire-purchase: VAT on the whole price is invoiced on this invoice. Due now: down payment + VAT. The remainder is paid in ${deal.months} instalments under contract ${deal.contract_number}, without VAT. The seller retains ownership until the price is paid in full. The vehicle is handed over once this invoice is paid.`,
    VAT_NOTE[vatMode],
    'Laskuttaja on myyjä; RAHTIS (Aivomaa Oy) ei ole kaupan osapuoli eikä vastaanota maksua. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale and does not receive the payment.',
  ]
    .filter(Boolean)
    .join('\n');

  const buffer = await renderToBuffer(
    SiteInvoicePdf({
      number: inv.number,
      issuedOn: fiDate(inv.issued_on),
      dueOn: fiDate(inv.due_on),
      reference: inv.reference,
      seller: { name: seller.name, businessId: seller.business_id, vatId: seller.vat_id, address: seller.address, iban: seller.iban, email: seller.email },
      customer: { name: customer.name, businessId: customer.business_id, vatId: customer.vat_id, address: customer.address },
      job: `${what} · ${deal.contract_number}`,
      jobLabel: ['Kaupan kohde', 'Item sold'],
      period: fiDate(deal.handover_date),
      periodLabel: ['Luovutus', 'Handover'],
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
      payNow: { label: ['Maksettava nyt', 'Due now'], amount: f.money(payNowCents, currency) },
      note,
    }),
  );

  const path = `installment-invoices/${inv.company_id}/${inv.number}.pdf`;
  const { error: upload } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: 'application/pdf', upsert: true });
  if (upload) throw new Error(`загрузка счёта: ${upload.message}`);
  await admin.from('carrier_invoices').update({ file_path: path }).eq('id', inv.id);

  const mailText = [
    'Hei,',
    '',
    `liitteenä osamaksukaupan ensimmäinen lasku ${inv.number} (sopimus ${deal.contract_number}, ${what}). Laskuttaja: ${seller.name}.`,
    `Maksettava nyt ${f.money(payNowCents, currency)} (käsiraha ja koko kauppahinnan arvonlisävero), eräpäivä ${fiDate(inv.due_on)}.`,
    `Tilinumero (IBAN) ${seller.iban}, viitenumero ${inv.reference}.`,
    'Maksu suoritetaan suoraan myyjälle, ei RAHTIS-palvelulle eikä Aivomaa Oy:lle.',
    '',
    `Kysymykset: vastatkaa tähän viestiin (${seller.email}).`,
    '',
    '—',
    `Attached is the first invoice ${inv.number} of the hire-purchase contract ${deal.contract_number} (${what}) from ${seller.name}. Due now ${f.money(payNowCents, currency)} (down payment and VAT on the whole price), due date ${fiDate(inv.due_on)}, IBAN ${seller.iban}, reference ${inv.reference}. Pay the seller directly, not RAHTIS or Aivomaa Oy.`,
  ].join('\n');

  const mail = await sendEmail({
    template: 'installment_first_invoice',
    to: customer.email,
    toName: customer.name,
    replyTo: seller.email,
    subject: `Lasku ${inv.number} · ${seller.name} · osamaksusopimus ${deal.contract_number}`,
    text: mailText,
    attachments: [{ bucket: BUCKET, path, filename: `Lasku-${inv.number}.pdf` }],
    companyId: inv.company_id,
  });

  if (mail.sent) {
    await admin.from('carrier_invoices').update({ sent_to: customer.email, sent_at: new Date().toISOString() }).eq('id', inv.id);
  }
  return mail.sent ? 'SENT' : 'CREATED';
}
