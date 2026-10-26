import 'server-only';

import { renderToBuffer } from '@react-pdf/renderer';
import { vatBpsFor } from '@/lib/config';
import { todayInHelsinki } from '@/lib/dates';
import { sendEmail } from '@/lib/email';
import { createFormat } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { finnishReference, invoiceLines, invoiceTotals, type InvoiceDay } from './invoice';
import { SiteInvoicePdf } from './SiteInvoicePdf';
import { dayMinutes } from './work';

const BUCKET = 'reports';

export type SiteInvoiceResult =
  | { status: 'SENT' | 'CREATED'; invoiceId: string; number: string }
  | { status: 'NOTHING' | 'NO_IBAN' | 'NO_CUSTOMER_EMAIL' | 'NO_CUSTOMER_ADDRESS' | 'NOT_FOUND' };

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const fiDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
};

/**
 * Счёт перевозчика клиенту за подтверждённые и ещё не выставленные дни
 * объекта (до upTo включительно). Номер — серия перевозчика, PDF — в
 * хранилище, письмо — клиенту с ответом на почту перевозчика.
 *
 * Работает секретным ключом: зовут и кнопка перевозчика (после проверки,
 * что объект его), и задание по понедельникам.
 */
export async function createSiteInvoice(jobId: string, upTo: string): Promise<SiteInvoiceResult> {
  const admin = createAdminClient();
  const f = createFormat('fi-FI');

  const { data: job } = await admin.from('site_jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) return { status: 'NOT_FOUND' };

  const { data: seller } = await admin
    .from('companies')
    .select('id, name, business_id, vat_number, iban, legal_name, legal_street, legal_postal_code, legal_city, contact_email, billing_email, country')
    .eq('id', job.company_id)
    .maybeSingle();
  if (!seller) return { status: 'NOT_FOUND' };
  if (!seller.iban) return { status: 'NO_IBAN' };
  if (!job.customer_email) return { status: 'NO_CUSTOMER_EMAIL' };
  if (!job.customer_street || !job.customer_city) return { status: 'NO_CUSTOMER_ADDRESS' };

  const { data: days } = await admin
    .from('site_days')
    .select('*')
    .eq('job_id', job.id)
    .is('invoice_id', null)
    .not('approved_at', 'is', null)
    .lte('day', upTo)
    .order('day');
  if (!days || days.length === 0) return { status: 'NOTHING' };

  const dayIds = days.map((d) => d.id);
  const [{ data: loads }, { data: drivers }, { data: vehicles }, { data: trailers }] = await Promise.all([
    admin.from('site_loads').select('day_id, unloaded_at, net_kg').in('day_id', dayIds),
    admin.from('drivers').select('id, full_name').eq('company_id', job.company_id),
    admin.from('vehicles').select('id, plate').eq('company_id', job.company_id),
    admin.from('trailers').select('id, plate').eq('company_id', job.company_id),
  ]);
  const driverName = new Map((drivers ?? []).map((d) => [d.id, d.full_name]));
  const plateOf = new Map([...(vehicles ?? []), ...(trailers ?? [])].map((v) => [v.id, v.plate]));

  const invoiceDays: InvoiceDay[] = days.map((d) => {
    const dl = (loads ?? []).filter((l) => l.day_id === d.id);
    return {
      day: d.day,
      driver: driverName.get(d.driver_id) ?? '',
      plate: [d.vehicle_id && plateOf.get(d.vehicle_id), d.trailer_id && plateOf.get(d.trailer_id)].filter(Boolean).join(' + '),
      minutes: dayMinutes({ arrivedAt: d.arrived_at, endedAt: d.ended_at, bufferMinutes: d.buffer_minutes, unloads: dl.map((l) => l.unloaded_at) }) ?? 0,
      loads: dl.length,
      netKg: dl.reduce((sum, l) => sum + (l.net_kg ?? 0), 0),
    };
  });

  const lines = invoiceLines(job.pricing, job.rate_cents, invoiceDays);
  const totals = invoiceTotals(lines, vatBpsFor(job.customer_country));
  const issuedOn = todayInHelsinki();
  const dueOn = addDays(issuedOn, job.payment_term_days);

  const { data: number, error: numberError } = await admin.rpc('next_carrier_invoice_number', {
    p_company_id: job.company_id,
    p_year: Number(issuedOn.slice(0, 4)),
  });
  if (numberError || !number) throw new Error(`номер счёта: ${numberError?.message}`);
  const reference = finnishReference(number);

  const sellerAddress = [seller.legal_street, [seller.legal_postal_code, seller.legal_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const customerAddress = [job.customer_street, [job.customer_postal_code, job.customer_city].filter(Boolean).join(' '), job.customer_country !== 'FI' ? job.customer_country : null]
    .filter(Boolean)
    .join(', ');
  const replyTo = seller.billing_email || seller.contact_email;

  const { data: invoice, error } = await admin
    .from('carrier_invoices')
    .insert({
      company_id: job.company_id,
      job_id: job.id,
      number,
      reference,
      issued_on: issuedOn,
      due_on: dueOn,
      period_from: invoiceDays[0].day,
      period_to: invoiceDays[invoiceDays.length - 1].day,
      seller: { name: seller.legal_name || seller.name, business_id: seller.business_id, vat_id: seller.vat_number, iban: seller.iban, address: sellerAddress, email: replyTo },
      customer: { name: job.customer_name, business_id: job.customer_business_id, vat_id: job.customer_vat_id, address: customerAddress, email: job.customer_email },
      lines,
      net_cents: totals.netCents,
      vat_bps: totals.vatBps,
      vat_cents: totals.vatCents,
      total_cents: totals.totalCents,
    })
    .select('id')
    .single();
  if (error || !invoice) throw new Error(`счёт: ${error?.message}`);

  /* Дни закрепляются за счётом; чужие (уже выставленные параллельно) не трогаются. */
  await admin.from('site_days').update({ invoice_id: invoice.id }).in('id', dayIds).is('invoice_id', null);

  const unit = { h: 'h', kuorma: 'kuorma', t: 't' } as const;
  const buffer = await renderToBuffer(
    SiteInvoicePdf({
      number,
      issuedOn: fiDate(issuedOn),
      dueOn: fiDate(dueOn),
      reference,
      seller: { name: seller.legal_name || seller.name, businessId: seller.business_id, vatId: seller.vat_number, address: sellerAddress, iban: seller.iban, email: replyTo },
      customer: { name: job.customer_name, businessId: job.customer_business_id, vatId: job.customer_vat_id, address: customerAddress },
      job: [job.name, job.address].filter(Boolean).join(', '),
      period: `${fiDate(invoiceDays[0].day)} – ${fiDate(invoiceDays[invoiceDays.length - 1].day)}`,
      lines: lines.map((l) => ({
        date: fiDate(l.date),
        text: l.text,
        quantity: l.quantity.toLocaleString('fi-FI', { maximumFractionDigits: 2 }),
        unit: unit[l.unit],
        unitPrice: f.eur(l.unitCents),
        amount: f.eur(l.amountCents),
      })),
      net: f.eur(totals.netCents),
      vatLabel: `ALV / VAT ${(totals.vatBps / 100).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} %`,
      vat: f.eur(totals.vatCents),
      total: f.eur(totals.totalCents),
      reverseCharge: totals.reverseCharge,
      note: 'Päivät ja kuormat on hyväksytty työmaalla. Erittely kuormista ja punnituksista toimitetaan pyydettäessä. / Days and loads have been approved at the site.',
    }),
  );

  const path = `site-invoices/${job.company_id}/${number}.pdf`;
  const { error: upload } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: 'application/pdf', upsert: true });
  if (upload) throw new Error(`загрузка счёта: ${upload.message}`);

  const sellerName = seller.legal_name || seller.name;
  const text = [
    `Hei,`,
    ``,
    `liitteenä ${sellerName}:n lasku ${number} työmaalta ${job.name}.`,
    `Summa ${f.eur(totals.totalCents)}, eräpäivä ${fiDate(dueOn)}.`,
    `Tilinumero ${seller.iban}, viitenumero ${reference}.`,
    ``,
    `Kysymykset laskusta: vastaa tähän viestiin (${replyTo}).`,
    ``,
    `—`,
    `Attached is invoice ${number} from ${sellerName} for the worksite ${job.name}: ${f.eur(totals.totalCents)}, due ${fiDate(dueOn)}, IBAN ${seller.iban}, reference ${reference}.`,
  ].join('\n');

  const mail = await sendEmail({
    template: 'site_invoice',
    to: job.customer_email,
    toName: job.customer_name,
    replyTo,
    subject: `Lasku ${number} · ${sellerName} · ${job.name}`,
    text,
    attachments: [{ bucket: BUCKET, path, filename: `Lasku-${number}.pdf` }],
    companyId: job.company_id,
  });

  await admin
    .from('carrier_invoices')
    .update({ file_path: path, sent_to: job.customer_email, sent_at: mail.sent ? new Date().toISOString() : null })
    .eq('id', invoice.id);

  return { status: mail.sent ? 'SENT' : 'CREATED', invoiceId: invoice.id, number };
}

/** Понедельник: счета по объектам с расписанием WEEKLY/BIWEEKLY — за дни до вчерашнего включительно. */
export async function runScheduledSiteInvoices(): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const { invoiceDue } = await import('./invoice');
  const admin = createAdminClient();
  const today = todayInHelsinki();
  const yesterday = addDays(today, -1);
  const out = { sent: 0, skipped: 0, errors: [] as string[] };

  const { data: jobs } = await admin.from('site_jobs').select('id, invoice_schedule').neq('invoice_schedule', 'MANUAL');
  for (const job of jobs ?? []) {
    if (!invoiceDue(job.invoice_schedule, today)) continue;
    try {
      const result = await createSiteInvoice(job.id, yesterday);
      if (result.status === 'SENT' || result.status === 'CREATED') out.sent++;
      else out.skipped++;
    } catch (cause) {
      out.errors.push(`${job.id}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
  return out;
}
