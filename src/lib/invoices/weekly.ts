import 'server-only';

import { renderToBuffer } from '@react-pdf/renderer';
import { todayInHelsinki, weeksAgoMonday } from '@/lib/dates';
import { sendEmail } from '@/lib/email';
import { createFormat } from '@/lib/format';
import { asCurrency } from '@/lib/money/currency';
import { finnishReference, standardVatBps } from '@/lib/sites/invoice';
import { SiteInvoicePdf } from '@/lib/sites/SiteInvoicePdf';
import { createAdminClient } from '@/lib/supabase/admin';
import { ibanHoldActive } from '@/lib/trust/changes';
import { lastIbanChange } from '@/lib/trust/sensitive';
import { freightVat } from './freightVat';

/**
 * Недельный счёт перевозчика заказчику (17.11.2026).
 *
 * Aivomaa Oy в перевозках не участвует: счёт выставляет перевозчик — его
 * имя, Y-tunnus, IBAN и серия номеров (та же, что у счетов по объектам).
 * RAHTIS по понедельникам составляет его из прямых заказов
 * (contract_party CARRIER), завершённых до этого понедельника, один счёт
 * на пару «перевозчик — заказчик — валюта», и отправляет заказчику с PDF;
 * ответ — на почту перевозчика. Деньги идут перевозчику напрямую.
 *
 * Не попадают:
 *   · заказы, по которым перевозчик уже внёс свой счёт вручную
 *     (freight_invoices) — второго счёта за тот же рейс быть не должно;
 *   · перевозчики, выключившие companies.weekly_invoicing (выставляют из
 *     своей бухгалтерии);
 *   · заказы, закрытые до START — счёт задним числом за историю никому
 *     не нужен;
 *   · пары «тестовая — боевая» компания.
 */

const BUCKET = 'reports';
/** С какой даты закрытия заказы идут в недельный счёт: первая неделя новой схемы. */
export const START = '2026-11-16';
/** Срок оплаты, дней. Как у счетов по объектам по умолчанию. */
const PAYMENT_TERM_DAYS = 14;

type OrderRow = {
  id: string;
  ref: string;
  closed_at: string | null;
  rate_cents: number | null;
  waiting_cents: number | null;
  currency: string;
  shipper_company_id: string;
  assigned_company_id: string | null;
  assigned_vehicle_id: string | null;
};

export type FreightInvoiceStatus =
  | 'SENT'
  | 'CREATED'
  | 'NOTHING'
  | 'BUSY'
  | 'NO_IBAN'
  | 'IBAN_RECENT'
  | 'NO_VAT_RATE'
  | 'NO_BUYER_VAT'
  | 'NO_CUSTOMER_EMAIL'
  | 'NOT_FOUND';

const helsinkiDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(new Date(iso));

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const fiDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
};

/** Понедельник: недельные счета по всем парам «перевозчик — заказчик». */
export async function runWeeklyFreightInvoices(now: Date = new Date()): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const admin = createAdminClient();
  /* Граница — этот понедельник по Хельсинки: в счёт идёт всё, что закрыто раньше. */
  const monday = weeksAgoMonday(0, now);
  const out = { sent: 0, skipped: 0, errors: [] as string[] };

  const { data: rows, error } = await admin
    .from('orders')
    .select('id, ref, closed_at, rate_cents, waiting_cents, currency, shipper_company_id, assigned_company_id, assigned_vehicle_id')
    .eq('status', 'DONE')
    .eq('contract_party', 'CARRIER')
    .is('carrier_invoice_id', null)
    .not('assigned_company_id', 'is', null)
    .gte('closed_at', `${START}T00:00:00Z`);
  if (error) return { ...out, errors: [error.message] };

  const orders = ((rows ?? []) as OrderRow[]).filter(
    (o) => o.closed_at && helsinkiDate(o.closed_at) >= START && helsinkiDate(o.closed_at) < monday && (o.rate_cents ?? 0) > 0,
  );
  if (orders.length === 0) return out;

  /* Счёт, внесённый перевозчиком вручную, — этот рейс уже выставлен. */
  const { data: manual } = await admin.from('freight_invoices').select('order_id').in('order_id', orders.map((o) => o.id));
  const manualIds = new Set((manual ?? []).map((m) => m.order_id));

  const groups = new Map<string, OrderRow[]>();
  for (const order of orders) {
    if (manualIds.has(order.id)) continue;
    const key = `${order.assigned_company_id}|${order.shipper_company_id}|${asCurrency(order.currency)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(order);
  }

  for (const list of groups.values()) {
    try {
      const status = await createFreightInvoice(list);
      if (status === 'SENT' || status === 'CREATED') out.sent++;
      else out.skipped++;
    } catch (cause) {
      out.errors.push(`${list[0].assigned_company_id}/${list[0].shipper_company_id}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
  return out;
}

/** Один счёт: перевозчик → заказчик за переданные заказы (одна валюта). */
async function createFreightInvoice(orders: OrderRow[]): Promise<FreightInvoiceStatus> {
  const admin = createAdminClient();
  const carrierId = orders[0].assigned_company_id!;
  const shipperId = orders[0].shipper_company_id;
  const currency = asCurrency(orders[0].currency);
  const f = createFormat('fi-FI');

  const [{ data: seller }, { data: buyer }] = await Promise.all([
    admin
      .from('companies')
      .select('id, name, business_id, vat_number, iban, legal_name, legal_street, legal_postal_code, legal_city, contact_email, billing_email, country, status, is_test, weekly_invoicing')
      .eq('id', carrierId)
      .maybeSingle(),
    admin
      .from('companies')
      .select('id, name, business_id, vat_number, legal_name, legal_street, legal_postal_code, legal_city, legal_country, billing_street, billing_postal_code, billing_city, billing_country, billing_email, billing_reference, contact_email, country, is_test')
      .eq('id', shipperId)
      .maybeSingle(),
  ]);
  if (!seller || !buyer) return 'NOT_FOUND';
  if (!seller.weekly_invoicing || seller.status !== 'ACTIVE') return 'NOTHING';
  /* Тестовая и боевая компании в одном счёте — номер из боевой серии ушёл бы тесту. */
  if (seller.is_test !== buyer.is_test) return 'NOTHING';
  if (!seller.iban) return 'NO_IBAN';
  /* Свежий IBAN — то, ради чего захватывают кабинет: 48 часов счёт сам не уходит. */
  const changedAt = await lastIbanChange(seller.id);
  if (changedAt && ibanHoldActive(changedAt)) return 'IBAN_RECENT';

  const buyerCountry = buyer.billing_country ?? buyer.legal_country ?? buyer.country;
  const vat = freightVat(seller.country, buyerCountry, buyer.vat_number, standardVatBps(seller.country));
  if (!vat.ok) return vat.reason;

  const sendTo = (buyer.billing_email || buyer.contact_email || '').trim().toLowerCase();
  if (!sendTo) return 'NO_CUSTOMER_EMAIL';

  /* Строка маршрута и номер машины — чтобы заказчик узнал рейс без номера заказа. */
  const ids = orders.map((o) => o.id);
  const vehicleIds = [...new Set(orders.map((o) => o.assigned_vehicle_id).filter((v): v is string => Boolean(v)))];
  const [{ data: stops }, { data: vehicles }] = await Promise.all([
    admin.from('order_stops').select('order_id, sequence, city, place_name').in('order_id', ids).order('sequence'),
    vehicleIds.length ? admin.from('vehicles').select('id, plate').in('id', vehicleIds) : Promise.resolve({ data: [] as { id: string; plate: string }[] }),
  ]);
  const route = new Map<string, string>();
  for (const stop of stops ?? []) {
    const label = stop.city || stop.place_name || '';
    const current = route.get(stop.order_id);
    route.set(stop.order_id, current ? `${current.split(' - ')[0]} - ${label}` : label);
  }
  const plate = new Map((vehicles ?? []).map((v) => [v.id, v.plate]));

  const sorted = [...orders].sort((a, b) => (a.closed_at ?? '').localeCompare(b.closed_at ?? ''));
  const lines = sorted.flatMap((o) => {
    const date = helsinkiDate(o.closed_at!);
    const text = [o.ref, route.get(o.id), o.assigned_vehicle_id && plate.get(o.assigned_vehicle_id)].filter(Boolean).join(' · ');
    const main = { date, text, quantity: 1, unit: 'kpl', unitCents: o.rate_cents ?? 0, amountCents: o.rate_cents ?? 0, orderId: o.id };
    const waiting = o.waiting_cents ?? 0;
    return waiting > 0
      ? [main, { date, text: `${o.ref} · odotus / waiting`, quantity: 1, unit: 'kpl', unitCents: waiting, amountCents: waiting, orderId: o.id }]
      : [main];
  });
  const netCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const vatCents = Math.round((netCents * vat.vatBps) / 10_000);
  const totalCents = netCents + vatCents;

  const issuedOn = todayInHelsinki();
  const dueOn = addDays(issuedOn, PAYMENT_TERM_DAYS);
  const periodFrom = lines[0].date;
  const periodTo = lines[lines.length - 1].date;

  const sellerName = seller.legal_name || seller.name;
  const buyerName = buyer.legal_name || buyer.name;
  const sellerAddress = [seller.legal_street, [seller.legal_postal_code, seller.legal_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const buyerAddress = [
    buyer.billing_street ?? buyer.legal_street,
    [buyer.billing_postal_code ?? buyer.legal_postal_code, buyer.billing_city ?? buyer.legal_city].filter(Boolean).join(' '),
    buyerCountry && buyerCountry !== seller.country ? buyerCountry : null,
  ]
    .filter(Boolean)
    .join(', ');
  const replyTo = seller.billing_email || seller.contact_email;

  const { data: invoice, error } = await admin
    .from('carrier_invoices')
    .insert({
      company_id: seller.id,
      kind: 'FREIGHT',
      customer_company_id: buyer.id,
      job_id: null,
      /* Временный номер: настоящий — только когда заказы закреплены за этим счётом. */
      number: `DRAFT-${crypto.randomUUID()}`,
      reference: '',
      issued_on: issuedOn,
      due_on: dueOn,
      period_from: periodFrom,
      period_to: periodTo,
      seller: { name: sellerName, business_id: seller.business_id, vat_id: seller.vat_number, iban: seller.iban, address: sellerAddress, email: replyTo },
      customer: { name: buyerName, business_id: buyer.business_id, vat_id: buyer.vat_number, address: buyerAddress, email: sendTo, reference: buyer.billing_reference },
      lines,
      net_cents: netCents,
      vat_bps: vat.vatBps,
      vat_cents: vatCents,
      total_cents: totalCents,
      currency,
    })
    .select('id')
    .single();
  if (error || !invoice) throw new Error(`счёт: ${error?.message}`);

  /*
   * Заказы закрепляются за счётом одной командой «где пусто». Если часть
   * уже забрал параллельный запуск, этот счёт отменяется целиком — без
   * номера и письма: в серии нет пропусков, рейс не попадает в два счёта.
   */
  const { data: claimed } = await admin
    .from('orders')
    .update({ carrier_invoice_id: invoice.id })
    .in('id', ids)
    .is('carrier_invoice_id', null)
    .select('id');
  if ((claimed ?? []).length !== ids.length) {
    await admin.from('orders').update({ carrier_invoice_id: null }).eq('carrier_invoice_id', invoice.id);
    await admin.from('carrier_invoices').delete().eq('id', invoice.id);
    return 'BUSY';
  }

  const { data: number, error: numberError } = await admin.rpc('next_carrier_invoice_number', {
    p_company_id: seller.id,
    p_year: Number(issuedOn.slice(0, 4)),
  });
  if (numberError || !number) {
    await admin.from('orders').update({ carrier_invoice_id: null }).eq('carrier_invoice_id', invoice.id);
    await admin.from('carrier_invoices').delete().eq('id', invoice.id);
    throw new Error(`номер счёта: ${numberError?.message}`);
  }
  const reference = finnishReference(number);
  await admin.from('carrier_invoices').update({ number, reference }).eq('id', invoice.id);

  const vatLabel = `${seller.country === 'FI' ? 'ALV / VAT' : 'VAT'} ${(vat.vatBps / 100).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} %`;
  const buffer = await renderToBuffer(
    SiteInvoicePdf({
      number,
      issuedOn: fiDate(issuedOn),
      dueOn: fiDate(dueOn),
      reference,
      seller: { name: sellerName, businessId: seller.business_id, vatId: seller.vat_number, address: sellerAddress, iban: seller.iban, email: replyTo },
      customer: { name: buyerName, businessId: buyer.business_id, vatId: buyer.vat_number, address: buyerAddress },
      job: buyer.billing_reference ? `Kuljetukset / Transport services · Viite / Ref. ${buyer.billing_reference}` : 'Kuljetukset / Transport services',
      period: `${fiDate(periodFrom)} – ${fiDate(periodTo)}`,
      lines: lines.map((l) => ({
        date: fiDate(l.date),
        text: l.text,
        quantity: '1',
        unit: l.unit,
        unitPrice: f.money(l.unitCents, currency),
        amount: f.money(l.amountCents, currency),
      })),
      net: f.money(netCents, currency),
      vatLabel,
      vat: f.money(vatCents, currency),
      total: f.money(totalCents, currency),
      note: [
        'Kuljetukset on toteutettu ja kuitattu RAHTIS-palvelussa. Laskuttaja on kuljetusliike; RAHTIS (Aivomaa Oy) ei ole kuljetussopimuksen osapuoli eikä vastaanota maksua. / Transports performed and confirmed in RAHTIS. The invoice is issued by the carrier; RAHTIS (Aivomaa Oy) is not a party to the transport contract and does not receive the payment.',
        vat.note,
      ]
        .filter(Boolean)
        .join('\n'),
    }),
  );

  const path = `freight-invoices/${seller.id}/${number}.pdf`;
  const { error: upload } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: 'application/pdf', upsert: true });
  if (upload) throw new Error(`загрузка счёта: ${upload.message}`);

  const text = [
    `Hei,`,
    ``,
    `liitteenä lasku ${number}: kuljetukset ${fiDate(periodFrom)}–${fiDate(periodTo)} (${orders.length} kpl). Laskuttaja: ${sellerName}.`,
    `Maksettava ${f.money(totalCents, currency)}, eräpäivä ${fiDate(dueOn)}.`,
    `Tilinumero (IBAN) ${seller.iban}, viitenumero ${reference}.`,
    `Maksu suoritetaan suoraan kuljetusliikkeelle, ei RAHTIS-palvelulle eikä Aivomaa Oy:lle.`,
    ``,
    `Jos laskusta on kysyttävää, vastatkaa tähän viestiin (${replyTo}).`,
    ``,
    `—`,
    `Attached is invoice ${number} from ${sellerName} for transports ${fiDate(periodFrom)}–${fiDate(periodTo)} (${orders.length}). Amount due ${f.money(totalCents, currency)}, due date ${fiDate(dueOn)}, IBAN ${seller.iban}, reference ${reference}. Pay the carrier directly, not RAHTIS or Aivomaa Oy. Questions about the invoice? Just reply to this email.`,
  ].join('\n');

  const mail = await sendEmail({
    template: 'freight_invoice',
    to: sendTo,
    toName: buyerName,
    replyTo,
    subject: `Lasku ${number} · ${sellerName} · kuljetukset ${fiDate(periodFrom)}–${fiDate(periodTo)}`,
    text,
    attachments: [{ bucket: BUCKET, path, filename: `Lasku-${number}.pdf` }],
    companyId: seller.id,
  });

  await admin
    .from('carrier_invoices')
    .update({ file_path: path, sent_to: sendTo, sent_at: mail.sent ? new Date().toISOString() : null })
    .eq('id', invoice.id);

  return mail.sent ? 'SENT' : 'CREATED';
}
