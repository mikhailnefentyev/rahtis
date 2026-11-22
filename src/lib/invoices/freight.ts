import 'server-only';

import { renderToBuffer } from '@react-pdf/renderer';
import { todayInHelsinki } from '@/lib/dates';
import { sendEmail } from '@/lib/email';
import { createFormat } from '@/lib/format';
import { asCurrency } from '@/lib/money/currency';
import { fetchAll, fetchIn } from '@/lib/money/paging';
import { notify } from '@/lib/notify';
import { paymentReference, standardVatBps } from '@/lib/sites/invoice';
import { SiteInvoicePdf } from '@/lib/sites/SiteInvoicePdf';
import { createAdminClient } from '@/lib/supabase/admin';
import { ibanHoldActive } from '@/lib/trust/changes';
import { lastIbanChange } from '@/lib/trust/sensitive';
import { freightScope, ownClientOff } from './freightScope';
import { freightVat } from './freightVat';
import { DEFAULT_SCHEDULE, DEFAULT_TERM_DAYS, invoiceCutoff, isSchedule } from './terms';

/**
 * Счёт перевозчика заказчику за прямые перевозки (17.11.2026).
 *
 * Aivomaa Oy в перевозках не участвует: счёт выставляет перевозчик — его
 * имя, Y-tunnus, IBAN и серия номеров (та же, что у счетов по объектам).
 * Периодичность и срок оплаты согласуют стороны (invoice_agreements,
 * правило — terms.ts); без согласования — раз в неделю и 14 дней.
 * Задание идёт каждое утро: по каждой паре RAHTIS составляет счёт из
 * прямых заказов (contract_party CARRIER), закрытых до последней
 * наступившей границы её периодичности (в обычный день таких нет) —
 * один на пару «перевозчик — заказчик — валюта», а при «сразу после
 * рейса» один на рейс — и отправляет заказчику с PDF; ответ — на почту
 * перевозчика. Деньги идут перевозчику напрямую.
 *
 * Не попадают:
 *   · заказы, по которым перевозчик уже внёс свой счёт вручную
 *     (freight_invoices) — второго счёта за тот же рейс быть не должно;
 *   · перевозчики, выключившие companies.weekly_invoicing (выставляют из
 *     своей бухгалтерии);
 *   · заказы, закрытые до START — счёт задним числом за историю никому
 *     не нужен;
 *   · заказы, закрытые до того, как перевозчик включил недельные счета
 *     (companies.weekly_invoicing_from, 22.11.2026): пока настройка была
 *     выключена, он выставлял счета сам — включение историю не выставляет;
 *   · заказы своих клиентов перевозчика (companies.client_of), пока он не
 *     подтвердил автоматические счета для этого клиента
 *     (companies.auto_invoice, 22.11.2026) — правило в freightScope.ts;
 *   · пары «тестовая — боевая» компания.
 *
 * Счёт с номером, который не дошёл до письма (сорвалась печать, загрузка
 * или почта), досылается следующим запуском — redeliver ниже (22.11.2026).
 */

const BUCKET = 'reports';
/** Сколько дней после выставления недоставленный счёт ещё досылается сам. */
const REDELIVER_DAYS = 14;
/** С какой даты закрытия заказы идут в недельный счёт: первая неделя новой схемы. */
export const START = '2026-11-16';

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
  | 'NO_SELLER_VAT'
  | 'NO_CUSTOMER_EMAIL'
  /* Свой клиент перевозчика без подтверждения автоматических счетов (22.11.2026). */
  | 'OWN_CLIENT_OFF'
  | 'NOT_FOUND';

type Admin = ReturnType<typeof createAdminClient>;

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

/** Каждое утро: досылка недоставленных счетов и новые счета по парам — за рейсы до последней границы их периодичности. */
export async function runFreightInvoices(now: Date = new Date()): Promise<{ sent: number; skipped: number; reasons: Partial<Record<FreightInvoiceStatus, number>>; errors: string[] }> {
  const admin = createAdminClient();
  const today = todayInHelsinki(now);
  /* reasons — почему пропущены (NO_BUYER_VAT, NO_SELLER_VAT…): видно в ответе планировщику. */
  const out = { sent: 0, skipped: 0, reasons: {} as Partial<Record<FreightInvoiceStatus, number>>, errors: [] as string[] };

  /* Сначала — счета прошлых запусков, у которых есть номер, но нет письма. */
  await redeliver(admin, today, out);

  /*
   * Страницами и в устойчивом порядке (22.11.2026): без `.range()` сервер
   * отдавал первую тысячу строк и молчал об остальных. Заказы, которым счёт
   * не положен никогда (внесён вручную, объект, выключенная настройка),
   * остаются в выборке — без страниц они со временем вытеснили бы живые.
   */
  const { data: rows, error } = await fetchAll((from, to) =>
    admin
      .from('orders')
      .select('id, ref, closed_at, rate_cents, waiting_cents, currency, shipper_company_id, assigned_company_id, assigned_vehicle_id')
      .eq('status', 'DONE')
      .eq('contract_party', 'CARRIER')
      .is('carrier_invoice_id', null)
      .not('assigned_company_id', 'is', null)
      .gte('closed_at', `${START}T00:00:00Z`)
      .order('closed_at')
      .order('id')
      .range(from, to),
  );
  if (error) return { ...out, errors: [...out.errors, error.message] };

  const orders = (rows as OrderRow[]).filter(
    (o) => o.closed_at && helsinkiDate(o.closed_at) >= START && helsinkiDate(o.closed_at) < today && (o.rate_cents ?? 0) > 0,
  );
  if (orders.length === 0) return out;

  /*
   * Уже выставлено другим путём — второго счёта за тот же рейс быть не должно:
   *   · счёт, внесённый перевозчиком вручную (freight_invoices);
   *   · заказ, из которого создан объект: его работу выставляет счёт по
   *     объекту за подтверждённые дни (security review 17.11.2026).
   *
   * Ошибка любого из запросов останавливает запуск (22.11.2026): с
   * пустым списком пропусков ушли бы двойные счета, без согласованных
   * условий — счета не с той периодичностью и сроком, без сторон — счета
   * за историю и своим клиентам без подтверждения. Списки id — частями:
   * длинный `.in()` не помещается в адрес запроса.
   */
  const orderIds = orders.map((o) => o.id);
  const carrierIds = [...new Set(orders.map((o) => o.assigned_company_id!))];
  const partyIds = [...new Set([...carrierIds, ...orders.map((o) => o.shipper_company_id)])];
  const [manual, siteJobs, agreements, parties] = await Promise.all([
    fetchIn(orderIds, (part) => admin.from('freight_invoices').select('order_id').in('order_id', part)),
    fetchIn(orderIds, (part) => admin.from('site_jobs').select('order_id').in('order_id', part)),
    /* Пар у сотни перевозчиков может быть больше тысячи — каждая часть читается страницами. */
    fetchIn(carrierIds, (part) =>
      fetchAll((from, to) =>
        admin
          .from('invoice_agreements')
          .select('carrier_company_id, shipper_company_id, schedule, payment_term_days')
          .in('carrier_company_id', part)
          .order('carrier_company_id')
          .order('shipper_company_id')
          .range(from, to),
      ),
    ),
    /* С какого момента перевозчик поручил счета RAHTIS и подтверждён ли свой клиент (22.11.2026). */
    fetchIn(partyIds, (part) => admin.from('companies').select('id, weekly_invoicing_from, client_of, auto_invoice').in('id', part)),
  ]);
  const failed = [
    manual.error && `счета вручную: ${manual.error.message}`,
    siteJobs.error && `объекты: ${siteJobs.error.message}`,
    agreements.error && `условия счетов: ${agreements.error.message}`,
    parties.error && `стороны: ${parties.error.message}`,
  ].filter((x): x is string => Boolean(x));
  if (failed.length > 0) return { ...out, errors: [...out.errors, ...failed] };

  const skipIds = new Set([...manual.data, ...siteJobs.data].map((m) => m.order_id));
  const terms = new Map(agreements.data.map((a) => [`${a.carrier_company_id}|${a.shipper_company_id}`, a]));

  const party = new Map(parties.data.map((c) => [c.id, c]));

  const groups = new Map<string, { orders: OrderRow[]; termDays: number }>();
  /* Пары «перевозчик — свой клиент» без подтверждения: в ответе планировщику — по одной на пару. */
  const ownOff = new Set<string>();
  for (const order of orders) {
    if (skipIds.has(order.id)) continue;
    const pair = `${order.assigned_company_id}|${order.shipper_company_id}`;
    /*
     * Рейс до включения недельных счетов и рейс своего клиента без
     * подтверждения в счёт не идут (22.11.2026, freightScope.ts). Сторона,
     * которой нет в ответе базы, рейс тоже не пропускает: неизвестно, свой
     * ли это клиент.
     */
    const carrier = party.get(order.assigned_company_id!);
    const shipper = party.get(order.shipper_company_id);
    if (!carrier || !shipper) continue;
    const skip = freightScope(order.closed_at!, carrier, shipper);
    if (skip === 'OWN_CLIENT_OFF') ownOff.add(pair);
    if (skip) continue;
    const agreed = terms.get(pair);
    const schedule = agreed && isSchedule(agreed.schedule) ? agreed.schedule : DEFAULT_SCHEDULE;
    /*
     * Рейс закрыт после последней границы периода этой пары — войдёт в
     * следующий счёт. Граница считается в любой день, не только в понедельник
     * или 1-го числа: сорвавшийся запуск навёрстывается наутро (terms.ts).
     */
    const cutoff = invoiceCutoff(schedule, today);
    if (helsinkiDate(order.closed_at!) >= cutoff) continue;
    /* «Сразу после рейса» — счёт на каждый рейс; иначе один на пару и валюту. */
    const key = schedule === 'PER_TRIP' ? `${pair}|${order.id}` : `${pair}|${asCurrency(order.currency)}`;
    const group = groups.get(key) ?? { orders: [], termDays: agreed?.payment_term_days ?? DEFAULT_TERM_DAYS };
    group.orders.push(order);
    groups.set(key, group);
  }
  if (ownOff.size > 0) {
    out.skipped += ownOff.size;
    out.reasons.OWN_CLIENT_OFF = ownOff.size;
  }

  for (const { orders: list, termDays } of groups.values()) {
    try {
      const status = await createFreightInvoice(list, termDays);
      if (status === 'SENT' || status === 'CREATED') out.sent++;
      else {
        out.skipped++;
        out.reasons[status] = (out.reasons[status] ?? 0) + 1;
      }
    } catch (cause) {
      out.errors.push(`${list[0].assigned_company_id}/${list[0].shipper_company_id}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
  return out;
}

/** Один счёт: перевозчик → заказчик за переданные заказы (одна валюта). */
async function createFreightInvoice(orders: OrderRow[], termDays: number): Promise<FreightInvoiceStatus> {
  const admin = createAdminClient();
  const carrierId = orders[0].assigned_company_id!;
  const shipperId = orders[0].shipper_company_id;
  const currency = asCurrency(orders[0].currency);

  const [{ data: seller }, { data: buyer }] = await Promise.all([
    admin
      .from('companies')
      .select('id, name, business_id, vat_number, iban, legal_name, legal_street, legal_postal_code, legal_city, contact_email, billing_email, country, status, is_test, weekly_invoicing')
      .eq('id', carrierId)
      .maybeSingle(),
    admin
      .from('companies')
      .select('id, name, business_id, vat_number, legal_name, legal_street, legal_postal_code, legal_city, legal_country, billing_street, billing_postal_code, billing_city, billing_country, billing_email, billing_reference, contact_email, country, is_test, client_of, auto_invoice')
      .eq('id', shipperId)
      .maybeSingle(),
  ]);
  if (!seller || !buyer) return 'NOT_FOUND';
  if (!seller.weekly_invoicing || seller.status !== 'ACTIVE') return 'NOTHING';
  /* Тестовая и боевая компании в одном счёте — номер из боевой серии ушёл бы тесту. */
  if (seller.is_test !== buyer.is_test) return 'NOTHING';
  /* Подтверждение сняли между выборкой и счётом — свой клиент счёта не получает (22.11.2026). */
  if (ownClientOff(buyer)) return 'OWN_CLIENT_OFF';
  if (!seller.iban) return 'NO_IBAN';
  /* Свежий IBAN — то, ради чего захватывают кабинет: 48 часов счёт сам не уходит. */
  const changedAt = await lastIbanChange(seller.id);
  if (changedAt && ibanHoldActive(changedAt)) return 'IBAN_RECENT';

  /*
   * НДС — по стране регистрации (companies.country): её проверяют при
   * заявке (PRH/VIES), и менять её пользователь не может. Платёжный адрес
   * и номер НДС он правит сам — по ним финская фирма объявила бы себя
   * немецкой и получала бы счета без налога (security review 17.11.2026).
   */
  const buyerCountry = buyer.country;
  const vat = freightVat(seller.country, buyerCountry, buyer.vat_number, standardVatBps(seller.country), seller.vat_number ?? null);
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
  const dueOn = addDays(issuedOn, termDays);
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
  const { data: claimed, error: claimError } = await admin
    .from('orders')
    .update({ carrier_invoice_id: invoice.id })
    .in('id', ids)
    .is('carrier_invoice_id', null)
    .select('id');
  if (claimError || (claimed ?? []).length !== ids.length) {
    await discard(admin, invoice.id);
    if (claimError) throw new Error(`закрепление рейсов: ${claimError.message}`);
    return 'BUSY';
  }

  const { data: number, error: numberError } = await admin.rpc('next_carrier_invoice_number', {
    p_company_id: seller.id,
    p_year: Number(issuedOn.slice(0, 4)),
  });
  if (numberError || !number) {
    await discard(admin, invoice.id);
    throw new Error(`номер счёта: ${numberError?.message}`);
  }
  /*
   * Номер не записался — счёт отменяется, рейсы освобождаются и войдут в
   * счёт следующего запуска (22.11.2026). Прежде ошибку не смотрели: счёт
   * оставался с временным номером, рейсы — закреплёнными за ним навсегда.
   */
  const { error: numberSaveError } = await admin
    .from('carrier_invoices')
    .update({ number, reference: paymentReference(number, seller.country) })
    .eq('id', invoice.id);
  if (numberSaveError) {
    await discard(admin, invoice.id);
    throw new Error(`запись номера счёта: ${numberSaveError.message}`);
  }

  return deliverFreightInvoice(admin, invoice.id);
}

/** Отменить несостоявшийся счёт: освободить рейсы и убрать строку. */
async function discard(admin: Admin, invoiceId: string): Promise<void> {
  const { error: release } = await admin.from('orders').update({ carrier_invoice_id: null }).eq('carrier_invoice_id', invoiceId);
  if (release) console.error('счёт за перевозки: рейсы не освобождены:', release.message);
  const { error: remove } = await admin.from('carrier_invoices').delete().eq('id', invoiceId);
  if (remove) console.error('счёт за перевозки: черновик не удалён:', remove.message);
}

type StoredLine = { date: string; text: string; unit: string; unitCents: number; amountCents: number; orderId?: string };
type StoredSeller = { name?: string; business_id?: string; vat_id?: string | null; iban?: string; address?: string; email?: string };
type StoredCustomer = { name?: string; business_id?: string | null; vat_id?: string | null; address?: string; email?: string; reference?: string | null };

/**
 * PDF и письмо по уже записанному счёту — и при первом выставлении, и при
 * повторе (22.11.2026; тот же приём, что у первого счёта рассрочки).
 *
 * Всё берётся из строки счёта: реквизиты сторон сняты в неё при
 * выставлении, и повторная отправка не подхватит ни новый IBAN, ни новый
 * адрес. Из компаний читается только страна — для подписи и пометки НДС.
 */
async function deliverFreightInvoice(admin: Admin, invoiceId: string): Promise<'SENT' | 'CREATED'> {
  const { data: inv, error } = await admin
    .from('carrier_invoices')
    .select('id, company_id, customer_company_id, number, reference, issued_on, due_on, period_from, period_to, seller, customer, lines, net_cents, vat_bps, vat_cents, total_cents, currency, file_path')
    .eq('id', invoiceId)
    .maybeSingle();
  if (error || !inv) throw new Error(`счёт не прочитан: ${error?.message ?? invoiceId}`);
  if (inv.number.startsWith('DRAFT-')) throw new Error(`счёт без номера: ${invoiceId}`);

  const seller = (inv.seller ?? {}) as StoredSeller;
  const customer = (inv.customer ?? {}) as StoredCustomer;
  const lines = (inv.lines ?? []) as StoredLine[];
  const currency = asCurrency(inv.currency);
  const f = createFormat('fi-FI');
  const sellerName = seller.name ?? '';
  const buyerName = customer.name ?? '';
  const sendTo = (customer.email ?? '').trim().toLowerCase();
  const replyTo = seller.email ?? '';
  const trips = new Set(lines.map((l) => l.orderId ?? l.text)).size;

  const { data: countries, error: countryError } = await admin
    .from('companies')
    .select('id, country')
    .in('id', [inv.company_id, inv.customer_company_id].filter((id): id is string => Boolean(id)));
  if (countryError) throw new Error(`страны сторон: ${countryError.message}`);
  const countryOf = new Map((countries ?? []).map((c) => [c.id, c.country]));
  const sellerCountry = countryOf.get(inv.company_id) ?? null;
  /* Пометка об обратном начислении — по тем же правилам, что при выставлении; ставка — та, что в счёте. */
  const vat = freightVat(
    sellerCountry,
    inv.customer_company_id ? countryOf.get(inv.customer_company_id) : null,
    customer.vat_id,
    standardVatBps(sellerCountry),
    seller.vat_id ?? null,
  );
  if (!vat.ok || vat.vatBps !== inv.vat_bps) {
    throw new Error(`счёт ${inv.number}: ставка НДС в счёте не сходится с правилом, счёт не отправлен`);
  }

  const vatLabel = `${sellerCountry === 'FI' ? 'ALV / VAT' : 'VAT'} ${(inv.vat_bps / 100).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} %`;
  const buffer = await renderToBuffer(
    SiteInvoicePdf({
      number: inv.number,
      issuedOn: fiDate(inv.issued_on),
      dueOn: fiDate(inv.due_on),
      reference: inv.reference,
      seller: { name: sellerName, businessId: seller.business_id ?? '', vatId: seller.vat_id ?? null, address: seller.address ?? '', iban: seller.iban ?? '', email: replyTo },
      customer: { name: buyerName, businessId: customer.business_id ?? null, vatId: customer.vat_id ?? null, address: customer.address ?? '' },
      job: customer.reference ? `Kuljetukset / Transport services · Viite / Ref. ${customer.reference}` : 'Kuljetukset / Transport services',
      period: `${fiDate(inv.period_from)} – ${fiDate(inv.period_to)}`,
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
      note: [
        'Kuljetukset on toteutettu ja kuitattu RAHTIS-palvelussa. Laskuttaja on kuljetusliike; RAHTIS (Aivomaa Oy) ei ole kuljetussopimuksen osapuoli eikä vastaanota maksua. / Transports performed and confirmed in RAHTIS. The invoice is issued by the carrier; RAHTIS (Aivomaa Oy) is not a party to the transport contract and does not receive the payment.',
        vat.note,
      ]
        .filter(Boolean)
        .join('\n'),
    }),
  );

  const path = `freight-invoices/${inv.company_id}/${inv.number}.pdf`;
  const { error: upload } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: 'application/pdf', upsert: true });
  if (upload) throw new Error(`загрузка счёта: ${upload.message}`);

  const text = [
    `Hei,`,
    ``,
    `liitteenä lasku ${inv.number}: kuljetukset ${fiDate(inv.period_from)}–${fiDate(inv.period_to)} (${trips} kpl). Laskuttaja: ${sellerName}.`,
    `Maksettava ${f.money(inv.total_cents, currency)}, eräpäivä ${fiDate(inv.due_on)}.`,
    `Tilinumero (IBAN) ${seller.iban}, viitenumero ${inv.reference}.`,
    `Maksu suoritetaan suoraan kuljetusliikkeelle, ei RAHTIS-palvelulle eikä Aivomaa Oy:lle.`,
    ``,
    `Jos laskusta on kysyttävää, vastatkaa tähän viestiin (${replyTo}).`,
    ``,
    `—`,
    `Attached is invoice ${inv.number} from ${sellerName} for transports ${fiDate(inv.period_from)}–${fiDate(inv.period_to)} (${trips}). Amount due ${f.money(inv.total_cents, currency)}, due date ${fiDate(inv.due_on)}, IBAN ${seller.iban}, reference ${inv.reference}. Pay the carrier directly, not RAHTIS or Aivomaa Oy. Questions about the invoice? Just reply to this email.`,
  ].join('\n');

  const mail = sendTo
    ? await sendEmail({
        template: 'freight_invoice',
        to: sendTo,
        toName: buyerName,
        replyTo,
        subject: `Lasku ${inv.number} · ${sellerName} · kuljetukset ${fiDate(inv.period_from)}–${fiDate(inv.period_to)}`,
        text,
        attachments: [{ bucket: BUCKET, path, filename: `Lasku-${inv.number}.pdf` }],
        companyId: inv.company_id,
      })
    : { sent: false };

  /*
   * Отметка об отправке обязана записаться: без неё следующий запуск счёл
   * бы счёт недоставленным и отправил заказчику второе письмо. Ошибка —
   * наружу, в ответ планировщику.
   */
  const { error: saveError } = await admin
    .from('carrier_invoices')
    .update({ file_path: path, sent_to: sendTo, sent_at: mail.sent ? new Date().toISOString() : null })
    .eq('id', inv.id);
  if (saveError) throw new Error(`счёт ${inv.number}: отметка об отправке не записана: ${saveError.message}`);

  /*
   * Перевозчик узнаёт о счёте, выставленном от его имени, в кабинете
   * (22.11.2026): прежде счёт уходил заказчику, а сам перевозчик его нигде
   * не видел. «Письмо не ушло» — один раз, при первой печати, а не каждое
   * утро, пока идут повторы.
   */
  if (mail.sent || !inv.file_path) {
    const total = f.money(inv.total_cents, currency);
    await notify({
      companyId: inv.company_id,
      kind: 'BILLING',
      code: 'invoice.issued',
      params: { number: inv.number, customer: buyerName, total, dueOn: inv.due_on, sent: mail.sent ? 'yes' : 'no' },
      title: mail.sent ? `Lasku ${inv.number} lähetetty: ${buyerName}` : `Lasku ${inv.number} laadittu, sähköposti ei lähtenyt: ${buyerName}`,
      body: `${total}, eräpäivä ${fiDate(inv.due_on)}`,
      link: '/carrier/invoices',
    });
  }

  return mail.sent ? 'SENT' : 'CREATED';
}

/**
 * Досылка: счета с номером, но без письма (22.11.2026).
 *
 * Номер выдан и рейсы закреплены до печати, поэтому сорвавшаяся печать,
 * загрузка или почта оставляли счёт неотправленным навсегда: рейсы в
 * выборку уже не возвращались. Каждый запуск пробует такие счета снова —
 * две недели после выставления; дальше это уже разговор с перевозчиком,
 * а не повтор письма. Оплаченный счёт не досылается.
 */
async function redeliver(admin: Admin, today: string, out: { sent: number; errors: string[] }): Promise<void> {
  const { data: pending, error } = await admin
    .from('carrier_invoices')
    .select('id, number')
    .eq('kind', 'FREIGHT')
    .is('sent_at', null)
    .is('paid_at', null)
    .not('number', 'like', 'DRAFT-%')
    .gte('issued_on', addDays(today, -REDELIVER_DAYS))
    .order('issued_on')
    .order('id')
    .limit(200);
  if (error) {
    out.errors.push(`досылка: ${error.message}`);
    return;
  }
  for (const row of pending ?? []) {
    try {
      if ((await deliverFreightInvoice(admin, row.id)) === 'SENT') out.sent++;
    } catch (cause) {
      out.errors.push(`досылка ${row.number}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
}
