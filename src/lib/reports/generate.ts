import 'server-only';

import { businessIdLabel, stopTimeZone } from '@/lib/country';
import { stopTime } from '@/lib/orders/stopTime';
import { renderToBuffer } from '@react-pdf/renderer';
import { COMMISSION_BPS, commissionCents, payoutCents, vatBpsFor, withVat } from '@/lib/config';
import { operatorInbox } from '@/lib/email';
import { emailLocaleOf, emailText } from '@/lib/email/text';
import { isoWeekNumber } from '@/lib/dates';
import { createFormat } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';
import { createMessages } from '@/lib/i18n/message';
import { notify } from '@/lib/notify';
import { getOperatorProfile, operatorLines } from '@/lib/operator/profile';
import { createAdminClient } from '@/lib/supabase/admin';
import { asCurrency } from '@/lib/money/currency';
import { dayMinutes } from '@/lib/sites/work';
import { loadFxHistory } from '@/lib/money/fx';
import { WeeklyReport, type OwnRow, type OwnSection, type ReportRow, type ReportTexts } from './WeeklyReport';

/**
 * Выпуск недельных отчётов.
 *
 * Служебным ключом: задание работает по расписанию, без сессии, и должно
 * видеть рейсы обеих сторон сразу. RLS здесь не помощник, а помеха.
 *
 * Неделю рейса решает момент закрытия. Рейс, взятый в пятницу и
 * выгруженный в понедельник, попадает в отчёт следующей недели — платят
 * за выполненную работу, а не за начатую.
 */

const BUCKET = 'reports';

/** Разделитель точек маршрута. Только символы Windows-1252: см. ниже. */
const LEG = ' - ';

/** Дата по Хельсинки: YYYY-MM-DD. */
function helsinkiDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(new Date(iso));
}

/** Понедельник недели, содержащей дату, по Хельсинки. */
export function mondayOf(date: Date): string {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(date);
  const d = new Date(`${local}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Прошлая неделя: понедельничное задание отчитывается за только что законченную. */
export function lastWeek(now: Date = new Date()): string {
  const d = new Date(`${mondayOf(now)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

export type GenerateResult = {
  week: string;
  reports: number;
  emails: number;
  errors: string[];
  /** Период ещё не закончился — выпускать нечего. */
  skipped?: boolean;
};

/*
 * Отрезок, за который выпускается документ.
 *
 * Недельный отчёт и документы расчётного периода отличаются тремя
 * вещами: границами, заголовком и наличием срока оплаты. Всё остальное —
 * выборка рейсов, подсчёт, вёрстка, хранилище, письмо — у них общее, и
 * разводить это на два похожих файла значило бы чинить их потом
 * по очереди.
 */
export type Span = {
  kind: 'WEEK' | 'PERIOD';
  /** Понедельник недели либо первое число периода. */
  start: string;
  /** Последний день отрезка включительно. */
  end: string;
  /** Заказчику — срок оплаты, перевозчику — день выплаты. */
  due: { shipper: string; carrier: string } | null;
};

/** Отрезок недели: конец считается от начала, как было. */
function weekSpan(start: string): Span {
  const end = new Date(new Date(`${start}T00:00:00Z`).getTime() + 6 * 24 * 3600 * 1000);
  return { kind: 'WEEK', start, end: end.toISOString().slice(0, 10), due: null };
}

type OrderRow = {
  id: string;
  ref: string;
  closed_at: string | null;
  updated_at: string;
  distance_km: number | null;
  rate_cents: number | null;
  /** Валюта цены: рейсы RAHTIS — евро, свои — валюта перевозчика или выбранная. */
  currency: string;
  commission_bps: number | null;
  /** Плата заказчика сверху цены, зафиксированная при закрытии. */
  shipper_fee_bps: number | null;
  shipper_company_id: string;
  assigned_company_id: string | null;
  /** Чей договор с клиентом: наш подряд или собственный рейс перевозчика. */
  contract_party: 'RAHTIS' | 'CARRIER';
  /** Доплата за простой, зафиксированная при закрытии, и её строки по точкам. */
  waiting_cents: number | null;
  waiting: WaitingLine[] | null;
};

type WaitingLine = {
  sequence: number;
  role: string;
  city: string | null;
  /* Страна точки — с 20261021140000; в снимках закрытых раньше рейсов её нет. */
  country?: string | null;
  started_at: string;
  completed_at: string;
  minutes: number;
  hours: number;
  cents: number;
};

export async function generateWeeklyReports(week?: string): Promise<GenerateResult> {
  return run(weekSpan(week ?? lastWeek()));
}

/**
 * Документы расчётного периода.
 *
 * Границы и оба срока берутся из базы, а не считаются здесь: правило
 * периодов (1–15 и 16–конец, миграция half_month_periods) записано один раз, и
 * второй его экземпляр на TypeScript однажды разошёлся бы с первым.
 */
export async function generatePeriodSettlement(moment?: string): Promise<GenerateResult> {
  const admin = createAdminClient();

  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);

  const { data, error } = await admin.rpc('settlement_period', {
    p_moment: moment ?? yesterday.toISOString(),
  });

  const period = Array.isArray(data) ? data[0] : data;

  /*
   * Выпуск — только если вчера период закончился. Планировщик зовёт
   * маршрут 1-го и 16-го, и проверка там всегда проходит; она страхует от
   * ручного или сбойного вызова посреди периода, который иначе выпустил
   * бы счёт за недоделанный период. Явный момент (перевыпуск из админки)
   * эту проверку обходит.
   */
  if (!moment && period && period.period_end !== helsinkiDate(yesterday.toISOString())) {
    return { week: period.period_start, reports: 0, emails: 0, errors: [], skipped: true };
  }

  if (error || !period) {
    return {
      week: moment ?? '',
      reports: 0,
      emails: 0,
      errors: [error?.message ?? 'период не определён'],
    };
  }

  /*
   * Обе даты приходят из базы и обе считаются от конца периода.
   *
   * Прежде срок заказчика считался здесь как «сегодня плюс срок». Пока
   * задание шло вовремя, это совпадало; запустись оно на день позже — и
   * срок уехал бы вместе с ним. Хуже того, агент, у которого дня
   * выставления нет вовсе, назвать такую дату не мог и честно писал, что
   * не знает. От конца периода её знают оба.
   */
  /*
   * Только заказы старой схемы (до 6.11.2026, Aivomaa — сторона): их
   * документы выпускаются из пульта оператора вручную. По расписанию это
   * больше не идёт, а месячный сбор — отдельное задание
   * generateMonthlyFees (17.11.2026).
   */
  return run({
    kind: 'PERIOD',
    start: period.period_start,
    end: period.period_end,
    due: { shipper: period.invoice_due, carrier: period.payout_due },
  });
}

/**
 * Счёт Aivomaa за подписку — раз в месяц, 1-го числа за прошлый месяц
 * (17.11.2026).
 *
 * Прежде шёл внутри расчёта за полмесяца — то есть зависел от задания
 * старой схемы, где Aivomaa была стороной перевозки. Теперь своё задание:
 * начислить сбор за активные машины, выписать счёт и разослать.
 * Повторный запуск ничего не дублирует: начисление и счёт идемпотентны в
 * базе.
 *
 * month — первый день месяца (YYYY-MM-01); по умолчанию прошлый месяц по
 * Хельсинки.
 */
export async function generateMonthlyFees(month?: string): Promise<GenerateResult> {
  const admin = createAdminClient();
  const target = month ?? previousMonth();

  if (!/^\d{4}-\d{2}-01$/.test(target)) {
    return { week: target, reports: 0, emails: 0, errors: ['month must be YYYY-MM-01'] };
  }

  const { error: feeError } = await admin.rpc('issue_monthly_subscriptions', { p_month: target });
  if (feeError) return { week: target, reports: 0, emails: 0, errors: [`сбор: ${feeError.message}`] };

  const { error: invoiceError } = await admin.rpc('invoice_subscription_fees', { p_month: target });
  if (invoiceError) return { week: target, reports: 0, emails: 0, errors: [`счёт за сбор: ${invoiceError.message}`] };

  return issueSubscriptionInvoices(admin, target, null);
}

/** Первый день прошлого месяца по Хельсинки. */
export function previousMonth(now: Date = new Date()): string {
  const today = helsinkiDate(now.toISOString());
  const year = Number(today.slice(0, 4));
  const monthIndex = Number(today.slice(5, 7)) - 1;
  const prev = new Date(Date.UTC(year, monthIndex - 1, 1));
  return prev.toISOString().slice(0, 10);
}

async function run(span: Span): Promise<GenerateResult> {
  const admin = createAdminClient();
  const target = span.start;
  const errors: string[] = [];

  /*
   * Граница — дата по Хельсинки, как у периода в базе. Смещение +02:00,
   * зашитое в запрос, летом сдвигало границу на час: рейс, закрытый в
   * полночь по местному времени, попадал в документ другого периода,
   * чем в расчётах оператора. Выборка берётся с запасом в сутки и
   * отсекается по местной дате.
   */
  const day = 24 * 3600 * 1000;
  const from = new Date(new Date(`${target}T00:00:00Z`).getTime() - day).toISOString();
  const to = new Date(new Date(`${span.end}T00:00:00Z`).getTime() + 2 * day).toISOString();

  const { data: orders, error } = await admin
    .from('orders')
    .select(
      'id, ref, closed_at, updated_at, distance_km, rate_cents, currency, commission_bps, shipper_fee_bps, shipper_company_id, assigned_company_id, contract_party, waiting_cents, waiting',
    )
    .eq('status', 'DONE')
    .gte('closed_at', from)
    .lt('closed_at', to)
    .order('closed_at', { ascending: true });

  if (error) {
    return { week: target, reports: 0, emails: 0, errors: [error.message] };
  }

  /*
   * Рейсы тестовых компаний в документы периода не попадают: счёт с
   * номером из боевой серии, отданный тестовой компании, уже не вернуть.
   * Недельный отчёт они получают — он для того, чтобы смотреть, как всё
   * выглядит.
   */
  const { data: tests } =
    span.kind === 'PERIOD' ? await admin.from('companies').select('id').eq('is_test', true) : { data: [] };
  const test = new Set((tests ?? []).map((c) => c.id));

  const list = ((orders ?? []) as OrderRow[]).filter((order) => {
    const date = helsinkiDate(order.closed_at ?? order.updated_at);
    if (date < target || date > span.end) return false;
    return !test.has(order.shipper_company_id) && !(order.assigned_company_id && test.has(order.assigned_company_id));
  });

  /* Точки нужны для строки маршрута: первая и последняя из порядка. */
  const ids = list.map((o) => o.id);
  const { data: stops } = ids.length
    ? await admin
        .from('order_stops')
        .select('order_id, sequence, place_name, city')
        .in('order_id', ids)
        .order('sequence')
    : { data: [] };

  const { data: vehicles } = ids.length
    ? await admin.from('order_offers').select('order_id, vehicles(plate)').in('order_id', ids)
    : { data: [] };

  /*
   * Разделитель маршрута обычным дефисом, а не стрелкой.
   *
   * Встроенная Helvetica выводится с WinAnsiEncoding, и стрелки U+2192 в
   * этой кодировке нет: в первом же выпущенном отчёте она отрисовалась
   * апострофом. Всё, что мы составляем сами, должно жить внутри
   * Windows-1252 — пока в PDF не встроен шрифт с полным Юникодом.
   */
  const route = new Map<string, string>();
  for (const stop of stops ?? []) {
    const label = stop.place_name || stop.city || '';
    const current = route.get(stop.order_id);
    route.set(stop.order_id, current ? `${current.split(LEG)[0]}${LEG}${label}` : label);
  }

  const plate = new Map<string, string>();
  for (const row of vehicles ?? []) {
    const v = row.vehicles as { plate?: string } | null;
    if (v?.plate && !plate.has(row.order_id)) plate.set(row.order_id, v.plate);
  }

  /*
   * Рейс своего клиента подписчика в документы периода не попадает: счёт
   * заказчику выставляет перевозчик, деньги идут мимо нас, и наш счёт с
   * номером из боевой серии там был бы чужим. В недельный отчёт такой
   * рейс входит — это отчёт о проделанной работе, а не требование денег.
   */
  const documented = span.kind === 'PERIOD' ? list.filter((o) => o.contract_party !== 'CARRIER') : list;

  /*
   * Кому какие рейсы. Одна и та же строка попадает в два отчёта разными
   * числами. С 17.11.2026 недельный отчёт получают все стороны, в том
   * числе клиенты, заведённые перевозчиком (client_of), — прежде они его
   * не получали. Документы старой схемы (PERIOD) — по-прежнему без них.
   */
  const shipperIds = [...new Set(documented.map((o) => o.shipper_company_id))];
  const { data: carrierClients } =
    span.kind === 'PERIOD' && shipperIds.length
      ? await admin.from('companies').select('id').in('id', shipperIds).not('client_of', 'is', null)
      : { data: [] };
  const clientOfCarrier = new Set((carrierClients ?? []).map((c) => c.id));

  const byCompany = new Map<string, { role: 'CARRIER' | 'SHIPPER'; orders: OrderRow[] }>();
  for (const order of documented) {
    if (!clientOfCarrier.has(order.shipper_company_id)) push(byCompany, order.shipper_company_id, 'SHIPPER', order);
    if (order.assigned_company_id) push(byCompany, order.assigned_company_id, 'CARRIER', order);
  }

  /*
   * Неделя (17.11.2026): дни на объектах — перевозчику объекта и заказчику
   * заказа, из которого объект создан; и отчёт «за неделю рейсов нет» —
   * каждой действующей компании платформы, у которой работы не было.
   */
  const sitesByCompany = span.kind === 'WEEK' ? await loadSiteWeek(admin, target, span.end) : new Map<string, SiteDay[]>();
  if (span.kind === 'WEEK') {
    for (const key of sitesByCompany.keys()) {
      const role = key.split(':')[1] as 'CARRIER' | 'SHIPPER';
      if (!byCompany.has(key)) byCompany.set(key, { role, orders: [] });
    }
    const { data: active } = await admin
      .from('companies')
      .select('id, kind')
      .eq('status', 'ACTIVE')
      .is('client_of', null)
      .in('kind', ['CARRIER', 'SHIPPER']);
    for (const company of active ?? []) {
      const role = company.kind as 'CARRIER' | 'SHIPPER';
      const key = `${company.id}:${role}`;
      if (!byCompany.has(key)) byCompany.set(key, { role, orders: [] });
    }
  }

  let reports = 0;
  let emails = 0;

  for (const [companyId, entry] of byCompany) {
    try {
      const sent = await issue(admin, span, companyId, entry.role, entry.orders, route, plate, sitesByCompany.get(companyId) ?? []);
      reports += 1;
      if (sent) emails += 1;
    } catch (cause) {
      errors.push(`${companyId}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  return { week: target, reports, emails, errors };
}

function uniformBps(orders: OrderRow[]): number | null {
  const rates = new Set(orders.map((o) => o.commission_bps ?? COMMISSION_BPS));
  return rates.size === 1 ? [...rates][0]! : null;
}

/** День на объекте для недельного отчёта (17.11.2026). */
type SiteDay = {
  day: string;
  job: string;
  customer: string;
  plate: string;
  minutes: number;
  loads: number;
  netKg: number;
};

/**
 * Дни на объектах за неделю: ключ `компания:роль` → дни. Перевозчику —
 * дни его объектов; заказчику — дни объектов, созданных из его заказа.
 * Клиент объекта, записанный текстом (не компания платформы), отчёта не
 * получает: ему уходят счета по объекту.
 */
async function loadSiteWeek(
  admin: ReturnType<typeof createAdminClient>,
  start: string,
  end: string,
): Promise<Map<string, SiteDay[]>> {
  const out = new Map<string, SiteDay[]>();
  const { data: days } = await admin
    .from('site_days')
    .select('id, day, job_id, vehicle_id, trailer_id, arrived_at, ended_at, buffer_minutes')
    .gte('day', start)
    .lte('day', end)
    .order('day');
  if (!days?.length) return out;

  const jobIds = [...new Set(days.map((d) => d.job_id))];
  const dayIds = days.map((d) => d.id);
  const [{ data: jobs }, { data: loads }] = await Promise.all([
    admin.from('site_jobs').select('id, name, company_id, customer_name, order_id').in('id', jobIds),
    admin.from('site_loads').select('day_id, unloaded_at, net_kg').in('day_id', dayIds),
  ]);
  const jobById = new Map((jobs ?? []).map((j) => [j.id, j]));
  const orderIds = [...new Set((jobs ?? []).map((j) => j.order_id).filter((id): id is string => Boolean(id)))];
  const { data: orders } = orderIds.length
    ? await admin.from('orders').select('id, shipper_company_id').in('id', orderIds)
    : { data: [] as { id: string; shipper_company_id: string }[] };
  const shipperOf = new Map((orders ?? []).map((o) => [o.id, o.shipper_company_id]));

  const unitIds = [...new Set(days.flatMap((d) => [d.vehicle_id, d.trailer_id]).filter((id): id is string => Boolean(id)))];
  const [{ data: vehicles }, { data: trailers }] = unitIds.length
    ? await Promise.all([
        admin.from('vehicles').select('id, plate').in('id', unitIds),
        admin.from('trailers').select('id, plate').in('id', unitIds),
      ])
    : [{ data: [] as { id: string; plate: string }[] }, { data: [] as { id: string; plate: string }[] }];
  const plateOf = new Map([...(vehicles ?? []), ...(trailers ?? [])].map((v) => [v.id, v.plate]));

  const add = (key: string, row: SiteDay) => {
    const list = out.get(key) ?? [];
    list.push(row);
    out.set(key, list);
  };

  for (const d of days) {
    const job = jobById.get(d.job_id);
    if (!job) continue;
    const dl = (loads ?? []).filter((l) => l.day_id === d.id);
    const row: SiteDay = {
      day: d.day,
      job: job.name,
      customer: job.customer_name ?? '',
      plate: [d.vehicle_id && plateOf.get(d.vehicle_id), d.trailer_id && plateOf.get(d.trailer_id)].filter(Boolean).join(' + '),
      minutes:
        dayMinutes({ arrivedAt: d.arrived_at, endedAt: d.ended_at, bufferMinutes: d.buffer_minutes, unloads: dl.map((l) => l.unloaded_at) }) ?? 0,
      loads: dl.length,
      netKg: dl.reduce((sum, l) => sum + (l.net_kg ?? 0), 0),
    };
    add(`${job.company_id}:CARRIER`, row);
    const shipper = job.order_id ? shipperOf.get(job.order_id) : undefined;
    if (shipper) add(`${shipper}:SHIPPER`, row);
  }
  return out;
}

function push(
  map: Map<string, { role: 'CARRIER' | 'SHIPPER'; orders: OrderRow[] }>,
  companyId: string,
  role: 'CARRIER' | 'SHIPPER',
  order: OrderRow,
) {
  const key = `${companyId}:${role}`;
  const entry = map.get(key) ?? { role, orders: [] };
  entry.orders.push(order);
  map.set(key, entry);
}

async function issue(
  admin: ReturnType<typeof createAdminClient>,
  span: Span,
  key: string,
  role: 'CARRIER' | 'SHIPPER',
  orders: OrderRow[],
  route: Map<string, string>,
  plate: Map<string, string>,
  /** Дни на объектах за неделю (только недельный отчёт). */
  siteDays: SiteDay[] = [],
): Promise<boolean> {
  const companyId = key.split(':')[0]!;
  const week = span.start;

  const { data: company } = await admin
    .from('companies')
    .select(
      'name, country, currency, language, contact_email, billing_email, frozen_at, business_id, vat_number, legal_name, legal_street, legal_postal_code, legal_city, legal_country, billing_street, billing_postal_code, billing_city, billing_country, billing_reference',
    )
    .eq('id', companyId)
    .single();

  if (!company) throw new Error('компания не найдена');

  /*
   * Язык компании, а не финский на всех.
   *
   * Отчёт и письмо к нему собирались словарём по умолчанию, и английская
   * компания получала финский документ и финское письмо — при том, что
   * приглашение, счёт и уведомление о претензии ей уже приходили
   * по-английски. Язык переписки лежит в карточке компании, и документ
   * обязан слушаться того же поля.
   */
  const locale = emailLocaleOf(company.language) as Locale;
  const t = await getDictionary(locale);
  const mail = emailText(emailLocaleOf(company.language));
  const f = createFormat(t.meta.intl);
  const m = createMessages(t.meta.intl, t);

  const carrier = role === 'CARRIER';

  /*
   * Документ периода заказчику — счёт. Номер закрепляется до выпуска
   * PDF: перевыпуск того же периода получает тот же номер.
   */
  const invoice =
    span.kind === 'PERIOD' && !carrier
      ? await admin.rpc('period_invoice', { p_company_id: companyId, p_period_start: week }).then(({ data, error }) => {
          if (error || !data) throw new Error(`номер счёта: ${error?.message ?? 'нет ответа'}`);
          return data;
        })
      : null;

  let gross = 0;
  let fee = 0;
  let net = 0;
  let km = 0;

  /*
   * Деньги строки. Перевозчику — выплата (с 22.09.2026 процента с рейса
   * нет, выплата равна цене). Заказчику — цена плюс плата за рейс подряда
   * (5 % с минимумом, замороженная в shipper_fee_bps): в колонке
   * «Palvelumaksu» и в сумме к оплате.
   */
  /*
   * Простой — отдельными строками под таблицей: договор заказчика 5.6
   * требует показать точку, время, начисленные часы. В сумму рейса он
   * входит целиком и перевозчику идёт без сервисного сбора (договор
   * перевозчика 9.2).
   */
  const waitingLines: Array<{ label: string; amount: string }> = [];

  /*
   * Рейсы по договору перевозчика с клиентом — свои рейсы и прямые
   * заказы подписчика — идут в отчёт работой, но не деньгами: цену
   * выставляет перевозчик сам. С 7.10.2026 они отдельным блоком после
   * расчёта, а не строками общей таблицы: там они мешались с рейсами,
   * по которым мы платим или выставляем счёт.
   */
  const ownOrders = orders.filter((o) => o.contract_party === 'CARRIER');
  const paidOrders = orders.filter((o) => o.contract_party !== 'CARRIER');

  const rows: ReportRow[] = paidOrders.map((order) => {
    const rate = order.rate_cents ?? 0;
    const bps = order.commission_bps ?? COMMISSION_BPS;
    const payout = payoutCents(rate, bps);
    const shipperFee = Math.round((rate * (order.shipper_fee_bps ?? 0)) / 10_000);
    const waiting = order.waiting_cents ?? 0;

    km += order.distance_km ?? 0;
    gross += rate;
    fee += carrier ? commissionCents(rate, bps) : shipperFee;
    net += (carrier ? payout : rate + shipperFee) + waiting;
    for (const w of order.waiting ?? []) {
      const loading = w.role === 'PICKUP' || w.role === 'EXTRA_LOAD';
      waitingLines.push({
        label: t.report_.waitingLine
          .replace('{ref}', order.ref)
          .replace('{stop}', `${w.sequence + 1}. ${w.city ?? ''}`.trim())
          .replace('{operation}', loading ? t.report_.waitingLoading : t.report_.waitingUnloading)
          .replace('{from}', f.time(w.started_at, stopTimeZone(w.country)))
          .replace('{to}', stopTime(f, w.completed_at, w.country))
          .replace('{minutes}', String(w.minutes))
          .replace('{hours}', String(w.hours)),
        amount: f.eur(w.cents),
      });
    }

    return {
      ref: order.ref,
      closedAt: f.date(order.closed_at ?? order.updated_at),
      route: route.get(order.id) ?? '—',
      vehicle: plate.get(order.id) ?? '—',
      distance: String(order.distance_km ?? 0),
      gross: f.eur(rate),
      commission: carrier ? null : f.eur(shipperFee),
      net: f.eur((carrier ? payout : rate + shipperFee) + waiting),
      documents: 0,
    };
  });

  /* Колонки цены и платы — только в документе заказчика, где плата есть. */
  const withFee = !carrier && fee > 0;

  const period =
    span.kind === 'WEEK'
      ? t.report_.period
          .replace('{week}', String(isoWeekNumber(week)))
          .replace('{from}', f.date(week))
          .replace('{to}', f.date(span.end))
      : t.report_.periodRange.replace('{from}', f.date(week)).replace('{to}', f.date(span.end));

  const title =
    span.kind === 'WEEK'
      ? carrier
        ? t.report_.carrierTitle
        : t.report_.shipperTitle
      : carrier
        ? t.report_.settlementCarrierTitle
        : t.report_.settlementShipperTitle.replace('{number}', invoice?.number ?? '');

  /*
   * Срок стоит в шапке, а не в письме: письмо теряется, документ
   * остаётся. Заказчику это «оплатить до», перевозчику «выплатим» —
   * одна дата разного смысла, и называть их одним словом нельзя.
   */
  const due = span.due
    ? carrier
      ? t.report_.dueCarrier.replace('{date}', f.date(span.due.carrier))
      : [
          invoice ? t.report_.invoiceDate.replace('{date}', f.date(invoice.issued_on)) : null,
          t.report_.dueShipper.replace('{date}', f.date(span.due.shipper)),
        ]
          .filter(Boolean)
          .join(' · ')
    : null;

  /*
   * Ставка налога — от страны контрагента, а не одна на всех. Финская
   * компания платит с налогом, иностранная — по обратному начислению.
   * Считается здесь, а не в шаблоне: шаблон переводится на два языка, и
   * правило, размноженное по локалям, разойдётся на первой же правке.
   */
  const vatBps = vatBpsFor(company.country);
  const vatBase = net;
  const vatAmount = withVat(vatBase, vatBps) - vatBase;

  /*
   * Месячный сбор за активные машины удерживается из выплаты перевозчику
   * за период: сколько хватает, остаток — из следующих выплат. Перевыпуск
   * документа сначала снимает удержания этого периода, потом считает
   * заново.
   */
  const payGross = vatBase + vatAmount;
  let deducted = 0;
  const deductions: Array<{ label: string; amount: string }> = [];
  if (carrier && span.kind === 'PERIOD') {
    const { data: fees, error: feeError } = await admin.rpc('apply_carrier_fees', {
      p_company_id: companyId,
      p_period_start: week,
      p_available_cents: payGross,
    });
    if (feeError) throw new Error(`удержание сбора: ${feeError.message}`);
    for (const row of fees ?? []) {
      deducted += row.amount_cents;
      deductions.push({
        /* Год вперёд — своей строкой; месяц — платные машины сверх года (первая бесплатна) × цена за машину. */
        label: (row.kind === 'ANNUAL' ? t.report_.feeLineAnnual : t.report_.feeLine)
          .replace('{month}', `${Number(row.month.slice(5, 7))}/${row.month.slice(0, 4)}`)
          .replace('{count}', String(row.active_vehicles))
          .replace('{unit}', f.eur(row.unit_cents))
          .replace('{vat}', f.percent(row.vat_bps / 10_000, 1)),
        amount: `−${f.eur(row.amount_cents)}`,
      });
    }
  }
  /* Свой блок: клиент перевозчика (или перевозчик — для заказчика) по имени. */
  const counterpartIds = [
    ...new Set(ownOrders.map((o) => (carrier ? o.shipper_company_id : o.assigned_company_id)).filter((id): id is string => Boolean(id))),
  ];
  const { data: counterparts } = counterpartIds.length
    ? await admin.from('companies').select('id, name').in('id', counterpartIds)
    : { data: [] };
  const counterpartName = new Map((counterparts ?? []).map((c) => [c.id, c.name]));
  let ownKm = 0;
  /*
   * Цена своего рейса — в его валюте. Итог: одна валюта — простая сумма;
   * разные — пересчёт в валюту компании по курсу ЕЦБ дня закрытия, с
   * пометкой «≈». Строка без курса в итог не входит.
   */
  const ownCurrencies = new Set(ownOrders.map((o) => asCurrency(o.currency)));
  const companyCurrency = asCurrency(company.currency);
  const totalCurrency = ownCurrencies.size === 1 ? [...ownCurrencies][0]! : companyCurrency;
  const fx = ownCurrencies.size > 1 ? await loadFxHistory(admin, week, span.end) : null;
  let ownPrice = 0;
  const ownRows: OwnRow[] = ownOrders.map((order) => {
    ownKm += order.distance_km ?? 0;
    const cents = order.rate_cents ?? 0;
    const cur = asCurrency(order.currency);
    const converted = fx
      ? fx.convert(cents, cur, totalCurrency, helsinkiDate(order.closed_at ?? order.updated_at))
      : cents;
    ownPrice += converted ?? 0;
    const party = carrier ? order.shipper_company_id : order.assigned_company_id;
    return {
      ref: order.ref,
      closedAt: f.date(order.closed_at ?? order.updated_at),
      client: (party && counterpartName.get(party)) || '—',
      route: route.get(order.id) ?? '—',
      vehicle: plate.get(order.id) ?? '—',
      distance: String(order.distance_km ?? 0),
      price: f.money(cents, cur),
    };
  });
  const own: OwnSection | null = ownRows.length
    ? {
        title: t.report_.ownTitle,
        note: t.report_.ownNote,
        colClient: carrier ? t.report_.colClient : t.report_.colCarrier,
        total: t.report_.total,
        rows: ownRows,
        distance: String(ownKm),
        price: `${fx ? '≈ ' : ''}${f.money(ownPrice, totalCurrency)}`,
      }
    : null;

  /* Дни на объектах — отдельным блоком (17.11.2026): часы, кузова и тонны, без денег — их считает счёт по объекту. */
  let siteMinutes = 0;
  const sites: OwnSection | null = siteDays.length
    ? {
        title: t.report_.sitesTitle,
        note: t.report_.sitesNote,
        colRef: t.report_.colSite,
        colClient: t.report_.colClient,
        colRoute: t.report_.colWork,
        colDistance: t.report_.colHours,
        colGross: '',
        total: t.report_.total,
        rows: siteDays.map((d) => {
          siteMinutes += d.minutes;
          return {
            ref: d.job,
            closedAt: f.date(d.day),
            client: d.customer || '—',
            route: `${d.loads} · ${(d.netKg / 1000).toLocaleString(t.meta.intl, { maximumFractionDigits: 1 })} t`,
            vehicle: d.plate || '—',
            distance: (d.minutes / 60).toLocaleString(t.meta.intl, { maximumFractionDigits: 1 }),
            price: '',
          };
        }),
        distance: (siteMinutes / 60).toLocaleString(t.meta.intl, { maximumFractionDigits: 1 }),
        price: '',
      }
    : null;

  const payable = payGross - deducted;

  /*
   * Стороны документа. Aivomaa Oy — продавец для заказчика и плательщик
   * для перевозчика; реквизиты из operator_profile, адрес компании —
   * платёжный, если он задан отдельно, иначе юридический.
   */
  const operator = await getOperatorProfile();
  const ids = { businessId: 'Y-tunnus', vatNumber: t.report_.vatNumber };
  const street = company.billing_street ?? company.legal_street;
  const city = [
    company.billing_postal_code ?? company.legal_postal_code,
    company.billing_city ?? company.legal_city,
  ]
    .filter(Boolean)
    .join(' ');
  const recipient = [
    company.legal_name ?? company.name,
    [street, city, company.billing_country ?? company.legal_country].filter(Boolean).join(', '),
    [
      company.business_id ? `${businessIdLabel(company.country, 'Y-tunnus')} ${company.business_id}` : null,
      company.vat_number ? `${t.report_.vatNumber} ${company.vat_number}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    company.billing_reference ? `${t.report_.reference} ${company.billing_reference}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));

  /*
   * Aivomaa — плательщик или продавец только по рейсам прежней модели, где
   * она была стороной договора. С 6.11.2026 все рейсы прямые: документ —
   * отчёт о работе компании, без «Maksaja: Aivomaa Oy» и без строки про
   * налог в счёте (09.11.2026).
   */
  const legacy = paidOrders.length > 0;
  const texts: ReportTexts = {
    parties: legacy
      ? [
          { label: carrier ? t.report_.payer : t.report_.seller, lines: operatorLines(operator, ids) },
          { label: carrier ? t.report_.payee : t.report_.customer, lines: recipient },
        ]
      : [{ label: carrier ? t.report_.colCarrier : t.report_.colClient, lines: recipient }],
    title,
    period: `${period} · ${company.name}`,
    due,
    vatNote: legacy ? (vatBps > 0 ? t.done.vatNoteDomestic : t.done.vatNoteReverse) : '',
    colRef: t.report_.colRef,
    colDate: t.report_.colDate,
    colRoute: t.report_.colRoute,
    colVehicle: t.report_.colVehicle,
    colDistance: t.report_.colDistance,
    colGross: t.report_.colGross,
    colCommission: t.report_.colCommission,
    colNet: carrier ? t.report_.colNetCarrier : t.report_.colNetShipper,
    colDocuments: t.report_.colDocuments,
    total: t.report_.total,
    empty: t.report_.empty,
    closingNote: span.kind === 'WEEK' ? t.report_.closingNote : t.report_.periodClosingNote,
    operator: `${operator.legal_name} · Y-tunnus ${operator.business_id}`,
    page: t.report_.page,
  };

  const buffer = await renderToBuffer(
    WeeklyReport({
      texts,
      rows,
      totals: {
        gross: f.eur(gross),
        commission: withFee ? f.eur(fee) : null,
        net: f.eur(net),
        waiting: waitingLines.length ? { title: t.report_.waitingTitle, lines: waitingLines } : null,
        deductions,
        payable: deducted > 0 ? { label: t.report_.payable, amount: f.eur(payable) } : null,
        distance: String(km),
        vat:
          vatBps > 0
            ? {
                label: t.report_.vatLine.replace('{rate}', f.percent(vatBps / 10_000, 1)),
                amount: f.eur(vatAmount),
                grossLabel: t.report_.totalWithVat,
                gross: f.eur(vatBase + vatAmount),
              }
            : null,
      },
      withCommission: withFee,
      own,
      sites,
    }),
  );

  const path = `${companyId}/${week}-${role}${span.kind === 'PERIOD' ? '-settlement' : ''}.pdf`;

  const { error: upload } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true });

  if (upload) throw new Error(`загрузка: ${upload.message}`);

  const { data: saved } = await admin
    .from('weekly_reports')
    .upsert(
      {
        week,
        company_id: companyId,
        role,
        file_path: path,
        bytes: buffer.length,
        orders_count: orders.length,
        gross_cents: gross,
        /* Доля оператора: у заказчика — плата за подряд, у перевозчика — удержанный сбор. */
        commission_cents: carrier ? deducted : fee,
        payout_cents: carrier ? net : null,
        /*
         * Ставка пишется, только если она одна на все рейсы недели. Взяв
         * ставку первого, мы бы подписали отчёт числом, к остальным строкам
         * не относящимся: у закрытых в разное время рейсов она разная.
         */
        commission_bps: uniformBps(orders),
        vat_bps: vatBps,
        kind: span.kind,
        due_date: span.due ? (carrier ? span.due.carrier : span.due.shipper) : null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'week,company_id,role,kind' },
    )
    .select('id')
    .single();

  /*
   * Счёт выпущен — рейсы периода выставлены. Только те, что ещё ждали:
   * перевыпуск не откатывает оплаченные и выплаченные назад.
   */
  if (invoice) {
    const { error: marked } = await admin
      .from('orders')
      .update({ billing: 'INVOICED', invoice_ref: invoice.number, invoiced_at: new Date().toISOString() })
      .in(
        'id',
        orders.map((o) => o.id),
      )
      .eq('billing', 'PENDING');
    if (marked) throw new Error(`отметка счёта: ${marked.message}`);
  }

  /*
   * Замороженной компании отчёт выпускается, но не рассылается: данные
   * для бухгалтерии нужны, а писать в кабинет, куда она не войдёт, и на
   * почту, с которой отношения закончились, незачем.
   */
  if (company.frozen_at) return false;

  const to = company.billing_email ?? company.contact_email;

  const result = await notify({
    companyId,
    kind: 'REPORT',
    title: `${texts.title} · ${period}`,
    /* Словами: «2 kuljetusta · 450 €» вместо «2 · 450 €». */
    body: m('report.notice', { count: orders.length, amount: f.eur(net) }),
    /*
     * Ссылка ведёт на сам отчёт, а не в раздел выполненных рейсов:
     * человек приходил туда, где отчёта нет, и искал его среди
     * карточек. Если строка почему-то не вернулась, остаётся прежний
     * адрес — уведомление без ссылки хуже, чем с неточной.
     */
    link: saved?.id ? `/reports/${saved.id}` : carrier ? '/carrier/done' : '/shipper/done',
    email: to
      ? {
          to,
          /*
           * Журнал писем должен различать документы: недельный отчёт и
           * документы периода уходят по-разному и на разные вопросы
           * отвечают. Одно имя на оба означало бы, что на вопрос «за
           * что письмо» журнал ответить не может.
           */
          template: span.kind === 'WEEK' ? 'weekly_report' : 'period_settlement',
          subject:
            span.kind === 'WEEK'
              ? t.report_.emailSubject.replace('{week}', String(isoWeekNumber(week)))
              : (invoice ? t.report_.invoiceEmailSubject : t.report_.settlementEmailSubject)
                  .replace('{number}', invoice?.number ?? '')
                  .replace('{from}', f.date(week))
                  .replace('{to}', f.date(span.end)),
          text: [
            mail.greeting,
            '',
            `${texts.title}, ${texts.period}.`,
            '',
            `${t.report_.emailTrips}: ${orders.length}`,
            ...(legacy ? [`${t.report_.total}: ${f.eur(deducted > 0 ? payable : net)}`] : []),
            ...(due ? ['', due] : []),
            ...(texts.vatNote ? ['', texts.vatNote] : []),
            '',
            t.report_.emailWhere,
            '',
            mail.billing.questions(operatorInbox()),
            '',
            texts.operator,
          ].join('\n'),
        }
      : undefined,
  });

  if (result.emailSent) {
    await admin
      .from('weekly_reports')
      .update({ emailed_at: new Date().toISOString() })
      .eq('week', week)
      .eq('company_id', companyId)
      .eq('role', role)
      .eq('kind', span.kind);
  }

  return result.emailSent;
}

/*
 * Счета за месячный сбор.
 *
 * Выписываются после документов периода: сначала месяц закрывается
 * расчётами и удержаниями, и только непокрытый остаток идёт счётом. У
 * подписчика, который возит своих клиентов, выплаты от нас нет вовсе —
 * для него это единственный способ заплатить.
 */
async function issueSubscriptionInvoices(
  admin: ReturnType<typeof createAdminClient>,
  month: string,
  due: string | null,
): Promise<GenerateResult> {
  const errors: string[] = [];
  let reports = 0;
  let emails = 0;

  const { data: fees, error } = await admin
    .from('carrier_subscription_fees')
    .select(
      'id, month, kind, active_vehicles, unit_cents, net_cents, vat_bps, gross_cents, carrier_company_id, invoices(number)',
    )
    .eq('month', month)
    .not('invoice_id', 'is', null);

  if (error) return { week: month, reports: 0, emails: 0, errors: [`счета за сбор: ${error.message}`] };
  if (!fees?.length) return { week: month, reports: 0, emails: 0, errors: [] };

  const { data: taken } = await admin
    .from('carrier_fee_deductions')
    .select('fee_id, amount_cents')
    .in(
      'fee_id',
      fees.map((f) => f.id),
    );

  const deductedBy = new Map<string, number>();
  for (const row of taken ?? []) {
    deductedBy.set(row.fee_id, (deductedBy.get(row.fee_id) ?? 0) + row.amount_cents);
  }

  for (const fee of fees) {
    try {
      const number = (fee.invoices as { number: string } | null)?.number ?? '';
      const deducted = deductedBy.get(fee.id) ?? 0;
      const open = Math.max(fee.gross_cents - deducted, 0);
      if (open <= 0) continue;

      const { data: company } = await admin
        .from('companies')
        .select(
          'name, country, language, contact_email, billing_email, frozen_at, business_id, vat_number, legal_name, legal_street, legal_postal_code, legal_city, legal_country, billing_street, billing_postal_code, billing_city, billing_country, billing_reference',
        )
        .eq('id', fee.carrier_company_id)
        .single();

      if (!company) continue;

      const locale = emailLocaleOf(company.language) as Locale;
      const t = await getDictionary(locale);
      const mail = emailText(emailLocaleOf(company.language));
      const f = createFormat(t.meta.intl);
      const operator = await getOperatorProfile();
      const ids = { businessId: 'Y-tunnus', vatNumber: t.report_.vatNumber };

      const monthLabel = `${Number(fee.month.slice(5, 7))}/${fee.month.slice(0, 4)}`;
      const description = (fee.kind === 'ANNUAL' ? t.report_.feeLineAnnual : t.report_.feeLine)
        .replace('{month}', monthLabel)
        .replace('{count}', String(fee.active_vehicles))
        .replace('{unit}', f.eur(fee.unit_cents))
        .replace('{vat}', f.percent(fee.vat_bps / 10_000, 1));

      const street = company.billing_street ?? company.legal_street;
      const city = [
        company.billing_postal_code ?? company.legal_postal_code,
        company.billing_city ?? company.legal_city,
      ]
        .filter(Boolean)
        .join(' ');

      /*
       * Срок считается от дня выставления, а не от расчётного периода.
       *
       * Репетиция показала, зачем: счёт за август, выписанный в сентябре,
       * получил срок 15.09 — то есть уже прошедший. У сбора нет периода
       * поставки, есть месяц и срок оплаты из договора перевозчика (п. 3.5):
       * четырнадцать дней (прежде здесь стояло 15 — расходилось с договором).
       */
      const dueDay = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const dueLine = t.report_.dueShipper.replace('{date}', f.date(dueDay));

      const texts: ReportTexts = {
        parties: [
          { label: t.report_.seller, lines: operatorLines(operator, ids) },
          {
            label: t.report_.customer,
            lines: [
              company.legal_name ?? company.name,
              [street, city, company.billing_country ?? company.legal_country].filter(Boolean).join(', '),
              [
                company.business_id ? `${businessIdLabel(company.country, 'Y-tunnus')} ${company.business_id}` : null,
                company.vat_number ? `${t.report_.vatNumber} ${company.vat_number}` : null,
              ]
                .filter(Boolean)
                .join(' · '),
            ].filter((line): line is string => Boolean(line && line.trim())),
          },
        ],
        title: `${t.report_.subTitle} ${number}`,
        period: `${monthLabel} · ${company.name}`,
        due: dueLine,
        /*
         * Общая пометка «суммы без алв, алв добавится к счёту» здесь
         * лгала бы: это и есть счёт, и налог в итоговой сумме уже стоит.
         */
        vatNote: fee.vat_bps > 0 ? t.report_.subVatNote : t.report_.subVatNoteReverse,
        colRef: t.report_.subColRef,
        colDate: t.report_.subColMonth,
        colRoute: t.report_.subColDescription,
        colVehicle: t.report_.subColVehicles,
        colDistance: '',
        colGross: t.report_.subColUnit,
        colCommission: t.report_.colCommission,
        colNet: t.report_.colNetShipper,
        colDocuments: t.report_.colDocuments,
        total: t.report_.total,
        empty: t.report_.empty,
        closingNote: t.report_.periodClosingNote,
        operator: `${operator.legal_name} · Y-tunnus ${operator.business_id}`,
        page: t.report_.page,
      };

      const vatAmount = fee.gross_cents - fee.net_cents;

      const buffer = await renderToBuffer(
        WeeklyReport({
          texts,
          rows: [
            {
              ref: number,
              closedAt: monthLabel,
              route: description,
              vehicle: String(fee.active_vehicles),
              distance: '',
              gross: f.eur(fee.unit_cents),
              commission: null,
              net: f.eur(fee.net_cents),
              documents: 0,
            },
          ],
          totals: {
            gross: f.eur(fee.net_cents),
            commission: null,
            net: f.eur(fee.net_cents),
            deductions: deducted > 0 ? [{ label: t.report_.subDeducted, amount: `−${f.eur(deducted)}` }] : [],
            payable: deducted > 0 ? { label: t.report_.payable, amount: f.eur(open) } : null,
            distance: '',
            vat:
              fee.vat_bps > 0
                ? {
                    label: t.report_.vatLine.replace('{rate}', f.percent(fee.vat_bps / 10_000, 1)),
                    amount: f.eur(vatAmount),
                    grossLabel: t.report_.totalWithVat,
                    gross: f.eur(fee.gross_cents),
                  }
                : null,
          },
          withCommission: false,
        }),
      );

      const path = `${fee.carrier_company_id}/${month}-subscription.pdf`;
      const { error: upload } = await admin.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: 'application/pdf', upsert: true });
      if (upload) throw new Error(`загрузка: ${upload.message}`);

      const { data: saved } = await admin
        .from('weekly_reports')
        .upsert(
          {
            week: month,
            company_id: fee.carrier_company_id,
            role: 'CARRIER',
            file_path: path,
            bytes: buffer.length,
            orders_count: 0,
            gross_cents: fee.net_cents,
            commission_cents: fee.net_cents,
            payout_cents: null,
            commission_bps: null,
            vat_bps: fee.vat_bps,
            kind: 'SUBSCRIPTION',
            due_date: due,
            generated_at: new Date().toISOString(),
          },
          { onConflict: 'week,company_id,role,kind' },
        )
        .select('id')
        .single();

      reports += 1;

      if (company.frozen_at) continue;
      const to = company.billing_email ?? company.contact_email;

      const result = await notify({
        companyId: fee.carrier_company_id,
        kind: 'REPORT',
        title: `${texts.title} · ${monthLabel}`,
        body: description,
        link: saved?.id ? `/reports/${saved.id}` : '/carrier/done',
        email: to
          ? {
              to,
              template: 'subscription_invoice',
              subject: t.report_.subEmailSubject.replace('{number}', number).replace('{month}', monthLabel),
              text: [
                mail.greeting,
                '',
                `${texts.title}, ${monthLabel}.`,
                '',
                t.report_.subEmailLine,
                description,
                `${t.report_.subNet}: ${f.eur(fee.net_cents)}`,
                ...(deducted > 0 ? [`${t.report_.subDeducted}: −${f.eur(deducted)}`] : []),
                `${t.report_.subPayable}: ${f.eur(open)}`,
                ...(dueLine ? ['', dueLine] : []),
                '',
                texts.vatNote,
                '',
                t.report_.emailWhere,
                '',
                mail.billing.questions(operatorInbox()),
                '',
                texts.operator,
              ].join('\n'),
            }
          : undefined,
      });

      if (result.emailSent) {
        emails += 1;
        await admin
          .from('weekly_reports')
          .update({ emailed_at: new Date().toISOString() })
          .eq('week', month)
          .eq('company_id', fee.carrier_company_id)
          .eq('role', 'CARRIER')
          .eq('kind', 'SUBSCRIPTION');
      }
    } catch (cause) {
      errors.push(`${fee.carrier_company_id}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  return { week: month, reports, emails, errors };
}

export const REPORTS_BUCKET = BUCKET;

