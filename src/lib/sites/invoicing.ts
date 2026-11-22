import 'server-only';

import { renderToBuffer } from '@react-pdf/renderer';
import { todayInHelsinki } from '@/lib/dates';
import { sendEmail } from '@/lib/email';
import { createFormat } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { ibanHoldActive, maskIban } from '@/lib/trust/changes';
import { lastIbanChange } from '@/lib/trust/sensitive';
import { paymentReference, invoiceLines, invoiceTotals, quantityLabel, standardVatBps, type InvoiceDay, type InvoiceLine } from './invoice';
import { SiteInvoicePdf } from './SiteInvoicePdf';
import { dayMinutes } from './work';

const BUCKET = 'reports';
/** Сколько дней после выставления недоставленный счёт ещё досылается сам. */
const REDELIVER_DAYS = 14;

type Admin = ReturnType<typeof createAdminClient>;

export type SiteInvoiceResult =
  | { status: 'SENT' | 'CREATED'; invoiceId: string; number: string }
  /* IBAN сменили меньше 48 часов назад: сам счёт не уходит, вручную — после подтверждения. */
  | { status: 'IBAN_RECENT'; changedAt: string; iban: string | null }
  | {
      status: 'NOTHING' | 'BUSY' | 'NO_VAT_RATE' | 'NO_IBAN' | 'NO_CUSTOMER_EMAIL' | 'NO_CUSTOMER_ADDRESS' | 'NOT_FOUND' | 'PLATFORM_ORDER';
    };

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
 *
 * Перед новым счётом досылаются счета этого объекта, у которых номер есть,
 * а PDF не получился (22.11.2026): их дни уже закреплены, и без досылки
 * такой счёт не дошёл бы до клиента никогда.
 */
export async function createSiteInvoice(
  jobId: string,
  upTo: string,
  /** Смена IBAN за 48 часов уже подтверждена перевозчиком (ручная отправка). */
  options: { ibanConfirmed?: boolean } = {},
): Promise<SiteInvoiceResult> {
  const admin = createAdminClient();

  const { data: job } = await admin.from('site_jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) return { status: 'NOT_FOUND' };
  const redelivered = await redeliverSiteInvoices(admin, job.id);
  /* Объект из заказа самосвалов по договору RAHTIS оплачивает заказчик через
     Aivomaa — свой счёт перевозчика был бы двойным. */
  if (job.order_id) {
    /* Заказ «напрямую с перевозчиком» (contract_party CARRIER) Aivomaa не выставляет — счёт за перевозчиком. */
    const { data: order } = await admin.from('orders').select('contract_party').eq('id', job.order_id).maybeSingle();
    if (order?.contract_party !== 'CARRIER') return { status: 'PLATFORM_ORDER' };
  }
  /* Валюта счёта — валюта объекта (ставка в ней); в БД её же ставит триггер. */
  const currency = job.currency;

  const { data: seller } = await admin
    .from('companies')
    .select('id, name, business_id, vat_number, iban, legal_name, legal_street, legal_postal_code, legal_city, contact_email, billing_email, country')
    .eq('id', job.company_id)
    .maybeSingle();
  if (!seller) return { status: 'NOT_FOUND' };
  if (!seller.iban) return { status: 'NO_IBAN' };
  /*
   * Счёт со свежим IBAN — то, ради чего захватывают кабинет: 48 часов
   * после смены сам он не уходит, вручную — только после подтверждения.
   */
  if (!options.ibanConfirmed) {
    const changedAt = await lastIbanChange(seller.id);
    if (changedAt && ibanHoldActive(changedAt)) return { status: 'IBAN_RECENT', changedAt, iban: maskIban(seller.iban) };
  }
  /* НДС — обычный, по стране перевозчика (FI 25,5 %, SE 25 %…): заказы между странами не бывают. */
  const vatBps = standardVatBps(seller.country);
  if (vatBps === null) return { status: 'NO_VAT_RATE' };
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
  /* Нового выставлять нечего — ответом будет досланный счёт, если он был. */
  if (!days || days.length === 0) return redelivered ?? { status: 'NOTHING' };

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
  const totals = invoiceTotals(lines, vatBps);
  const issuedOn = todayInHelsinki();
  const dueOn = addDays(issuedOn, job.payment_term_days);

  const sellerAddress = [seller.legal_street, [seller.legal_postal_code, seller.legal_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const customerAddress = [job.customer_street, [job.customer_postal_code, job.customer_city].filter(Boolean).join(' '), job.customer_country !== seller.country ? job.customer_country : null]
    .filter(Boolean)
    .join(', ');
  const replyTo = seller.billing_email || seller.contact_email;

  const { data: invoice, error } = await admin
    .from('carrier_invoices')
    .insert({
      company_id: job.company_id,
      job_id: job.id,
      /* Временный номер: настоящий выдаётся, только когда дни закреплены за этим счётом. */
      number: `DRAFT-${crypto.randomUUID()}`,
      reference: '',
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
      currency,
    })
    .select('id')
    .single();
  if (error || !invoice) throw new Error(`счёт: ${error?.message}`);

  /*
   * Дни закрепляются за счётом одной командой: «где invoice_id пусто».
   * Если параллельно (вторая кнопка, задание понедельника) часть дней уже
   * забрал другой счёт, этот отменяется целиком — без номера и письма,
   * поэтому в серии не остаётся пропусков, а день не попадает в два счёта.
   */
  const { data: claimed, error: claimError } = await admin
    .from('site_days')
    .update({ invoice_id: invoice.id })
    .in('id', dayIds)
    .is('invoice_id', null)
    .select('id');
  if (claimError || (claimed ?? []).length !== dayIds.length) {
    await discard(admin, invoice.id);
    if (claimError) throw new Error(`закрепление дней: ${claimError.message}`);
    return { status: 'BUSY' };
  }

  const { data: number, error: numberError } = await admin.rpc('next_carrier_invoice_number', {
    p_company_id: job.company_id,
    p_year: Number(issuedOn.slice(0, 4)),
  });
  if (numberError || !number) {
    await discard(admin, invoice.id);
    throw new Error(`номер счёта: ${numberError?.message}`);
  }
  /*
   * Номер не записался — счёт отменяется, дни освобождаются (22.11.2026).
   * Прежде ошибку не смотрели: счёт оставался с временным номером, а дни —
   * закреплёнными за ним навсегда.
   */
  const { error: numberSaveError } = await admin
    .from('carrier_invoices')
    .update({ number, reference: paymentReference(number, seller.country) })
    .eq('id', invoice.id);
  if (numberSaveError) {
    await discard(admin, invoice.id);
    throw new Error(`запись номера счёта: ${numberSaveError.message}`);
  }

  const status = await deliverSiteInvoice(admin, invoice.id);
  return { status, invoiceId: invoice.id, number };
}

/** Отменить несостоявшийся счёт: освободить дни и убрать строку. */
async function discard(admin: Admin, invoiceId: string): Promise<void> {
  const { error: release } = await admin.from('site_days').update({ invoice_id: null }).eq('invoice_id', invoiceId);
  if (release) console.error('счёт объекта: дни не освобождены:', release.message);
  const { error: remove } = await admin.from('carrier_invoices').delete().eq('id', invoiceId);
  if (remove) console.error('счёт объекта: черновик не удалён:', remove.message);
}

type StoredSeller = { name?: string; business_id?: string; vat_id?: string | null; iban?: string; address?: string; email?: string };
type StoredCustomer = { name?: string; business_id?: string | null; vat_id?: string | null; address?: string; email?: string };

/**
 * PDF и письмо по уже записанному счёту объекта — и при первом
 * выставлении, и при досылке (22.11.2026; тот же приём, что у первого
 * счёта рассрочки). Стороны, строки и суммы — из строки счёта: они сняты в
 * неё при выставлении. Из объекта — только название и адрес для шапки.
 */
async function deliverSiteInvoice(admin: Admin, invoiceId: string): Promise<'SENT' | 'CREATED'> {
  const { data: inv, error } = await admin
    .from('carrier_invoices')
    .select('id, company_id, job_id, number, reference, issued_on, due_on, period_from, period_to, seller, customer, lines, net_cents, vat_bps, vat_cents, total_cents, currency')
    .eq('id', invoiceId)
    .maybeSingle();
  if (error || !inv) throw new Error(`счёт не прочитан: ${error?.message ?? invoiceId}`);
  if (inv.number.startsWith('DRAFT-') || !inv.job_id) throw new Error(`счёт объекта без номера или объекта: ${invoiceId}`);

  const [{ data: job }, { data: company }] = await Promise.all([
    admin.from('site_jobs').select('name, address').eq('id', inv.job_id).maybeSingle(),
    admin.from('companies').select('country').eq('id', inv.company_id).maybeSingle(),
  ]);
  if (!job) throw new Error(`объект счёта ${inv.number} не найден`);

  /* Счёт на финском/английском — формат чисел fi-FI, валюта — из счёта. */
  const f = createFormat('fi-FI');
  const currency = inv.currency;
  const seller = (inv.seller ?? {}) as StoredSeller;
  const customer = (inv.customer ?? {}) as StoredCustomer;
  const lines = (inv.lines ?? []) as InvoiceLine[];
  const sellerName = seller.name ?? '';
  const replyTo = seller.email ?? '';
  const sendTo = customer.email ?? '';

  const unit = { h: 'h', kuorma: 'kuorma', t: 't' } as const;
  const buffer = await renderToBuffer(
    SiteInvoicePdf({
      number: inv.number,
      issuedOn: fiDate(inv.issued_on),
      dueOn: fiDate(inv.due_on),
      reference: inv.reference,
      seller: { name: sellerName, businessId: seller.business_id ?? '', vatId: seller.vat_id ?? null, address: seller.address ?? '', iban: seller.iban ?? '', email: replyTo },
      customer: { name: customer.name ?? '', businessId: customer.business_id ?? null, vatId: customer.vat_id ?? null, address: customer.address ?? '' },
      job: [job.name, job.address].filter(Boolean).join(', '),
      period: `${fiDate(inv.period_from)} – ${fiDate(inv.period_to)}`,
      lines: lines.map((l) => ({
        date: fiDate(l.date),
        text: l.text,
        /* Часы — «ч:мм», тонны — до килограмма: количество × цена сходится с суммой строки. */
        quantity: quantityLabel(l),
        unit: unit[l.unit],
        unitPrice: f.money(l.unitCents, currency),
        amount: f.money(l.amountCents, currency),
      })),
      net: f.money(inv.net_cents, currency),
      vatLabel: `${company?.country === 'FI' ? 'ALV / VAT' : 'VAT'} ${(inv.vat_bps / 100).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} %`,
      vat: f.money(inv.vat_cents, currency),
      total: f.money(inv.total_cents, currency),
      note: 'Päivät ja kuormat on hyväksytty työmaalla. Kuormien ja punnitusten erittely toimitetaan pyynnöstä. / Days and loads have been approved at the site. A breakdown of loads and weighings is available on request.',
    }),
  );

  const path = `site-invoices/${inv.company_id}/${inv.number}.pdf`;
  const { error: upload } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: 'application/pdf', upsert: true });
  if (upload) throw new Error(`загрузка счёта: ${upload.message}`);

  const text = [
    `Hei,`,
    ``,
    `liitteenä lasku ${inv.number}, työmaa ${job.name}. Laskuttaja: ${sellerName}.`,
    `Maksettava ${f.money(inv.total_cents, currency)}, eräpäivä ${fiDate(inv.due_on)}.`,
    `Tilinumero (IBAN) ${seller.iban}, viitenumero ${inv.reference}.`,
    ``,
    `Jos laskusta on kysyttävää, vastatkaa tähän viestiin (${replyTo}).`,
    ``,
    `—`,
    `Attached is invoice ${inv.number} from ${sellerName} for worksite ${job.name}. Amount due ${f.money(inv.total_cents, currency)}, due date ${fiDate(inv.due_on)}, IBAN ${seller.iban}, reference ${inv.reference}. Questions about the invoice? Just reply to this email.`,
  ].join('\n');

  const mail = sendTo
    ? await sendEmail({
        template: 'site_invoice',
        to: sendTo,
        toName: customer.name ?? '',
        replyTo,
        subject: `Lasku ${inv.number} · ${sellerName} · ${job.name}`,
        text,
        attachments: [{ bucket: BUCKET, path, filename: `Lasku-${inv.number}.pdf` }],
        companyId: inv.company_id,
      })
    : { sent: false };

  /* Без этой отметки досылка отправила бы клиенту второе письмо — ошибка идёт наружу. */
  const { error: saveError } = await admin
    .from('carrier_invoices')
    .update({ file_path: path, sent_to: sendTo, sent_at: mail.sent ? new Date().toISOString() : null })
    .eq('id', inv.id);
  if (saveError) throw new Error(`счёт ${inv.number}: отметка об отправке не записана: ${saveError.message}`);

  return mail.sent ? 'SENT' : 'CREATED';
}

/**
 * Досылка счетов объекта: номер выдан, дни закреплены, а PDF нет —
 * сорвалась печать или загрузка (22.11.2026). Счёт с готовым PDF, у
 * которого не ушло только письмо, не трогаем: перевозчику уже сказано
 * скачать PDF и отправить самому, второе письмо от RAHTIS было бы лишним.
 * Возвращает итог последнего досланного счёта или null.
 */
async function redeliverSiteInvoices(admin: Admin, jobId: string): Promise<SiteInvoiceResult | null> {
  const { data: pending, error } = await admin
    .from('carrier_invoices')
    .select('id, number')
    .eq('job_id', jobId)
    .is('sent_at', null)
    .is('file_path', null)
    .is('paid_at', null)
    .not('number', 'like', 'DRAFT-%')
    .gte('issued_on', addDays(todayInHelsinki(), -REDELIVER_DAYS))
    .order('issued_on')
    .order('id');
  if (error) throw new Error(`досылка счетов объекта: ${error.message}`);
  let last: SiteInvoiceResult | null = null;
  for (const row of pending ?? []) {
    last = { status: await deliverSiteInvoice(admin, row.id), invoiceId: row.id, number: row.number };
  }
  return last;
}

/**
 * Понедельник: счета по объектам с расписанием WEEKLY — за дни до
 * вчерашнего включительно. С 17.11.2026 и объекты из прямых заказов:
 * createSiteInvoice сама отсекает заказы старой схемы (PLATFORM_ORDER).
 */
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
