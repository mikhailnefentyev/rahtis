import 'server-only';

import { renderToBuffer } from '@react-pdf/renderer';
import {
  APP,
  COMMISSION_BPS,
  INVOICE_TERM_DAYS,
  VAT_BPS,
  commissionCents,
  payoutCents,
} from '@/lib/config';
import { operatorInbox } from '@/lib/email';
import { createFormat } from '@/lib/format';
import { getDictionary, defaultLocale } from '@/lib/i18n';
import { notify } from '@/lib/notify';
import { createAdminClient } from '@/lib/supabase/admin';
import { WeeklyReport, type ReportRow, type ReportTexts } from './WeeklyReport';

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

/** Понедельник недели, содержащей дату, по Хельсинки. */
export function mondayOf(date: Date): string {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(date);
  const d = new Date(`${local}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Прошлая неделя: воскресное задание отчитывается за только что законченную. */
export function lastWeek(now: Date = new Date()): string {
  const d = new Date(`${mondayOf(now)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

function isoWeekNumber(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  jan4.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((d.getTime() - jan4.getTime()) / (7 * 24 * 3600 * 1000));
}

export type GenerateResult = {
  week: string;
  reports: number;
  emails: number;
  errors: string[];
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
  commission_bps: number | null;
  shipper_company_id: string;
  assigned_company_id: string | null;
};

export async function generateWeeklyReports(week?: string): Promise<GenerateResult> {
  return run(weekSpan(week ?? lastWeek()));
}

/**
 * Документы расчётного периода.
 *
 * Границы и день выплаты перевозчику берутся из базы, а не считаются
 * здесь: правило периодов — включая короткий февраль — записано в
 * payout_schedule, и второй его экземпляр на TypeScript разошёлся бы с
 * первым ровно в феврале.
 *
 * Срок оплаты заказчику, наоборот, живёт в config.ts: это коммерческое
 * условие, а не свойство календаря.
 */
export async function generatePeriodSettlement(moment?: string): Promise<GenerateResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc('settlement_period', {
    p_moment: moment ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  });

  const period = Array.isArray(data) ? data[0] : data;

  if (error || !period) {
    return {
      week: moment ?? '',
      reports: 0,
      emails: 0,
      errors: [error?.message ?? 'период не определён'],
    };
  }

  const issued = new Date();
  const shipperDue = new Date(issued.getTime() + INVOICE_TERM_DAYS * 24 * 3600 * 1000);

  return run({
    kind: 'PERIOD',
    start: period.period_start,
    end: period.period_end,
    due: { shipper: shipperDue.toISOString().slice(0, 10), carrier: period.payout_due },
  });
}

async function run(span: Span): Promise<GenerateResult> {
  const admin = createAdminClient();
  const target = span.start;
  const errors: string[] = [];

  const from = `${target}T00:00:00+02:00`;
  const to = new Date(new Date(`${span.end}T00:00:00Z`).getTime() + 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: orders, error } = await admin
    .from('orders')
    .select(
      'id, ref, closed_at, updated_at, distance_km, rate_cents, commission_bps, shipper_company_id, assigned_company_id',
    )
    .eq('status', 'DONE')
    .gte('closed_at', from)
    .lt('closed_at', `${to}T00:00:00+02:00`)
    .order('closed_at', { ascending: true });

  if (error) {
    return { week: target, reports: 0, emails: 0, errors: [error.message] };
  }

  const list = (orders ?? []) as OrderRow[];

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
    ? await admin
        .from('order_offers')
        .select('order_id, vehicles(plate)')
        .in('order_id', ids)
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

  /* Кому какие рейсы. Одна и та же строка попадает в два отчёта разными числами. */
  const byCompany = new Map<string, { role: 'CARRIER' | 'SHIPPER'; orders: OrderRow[] }>();
  for (const order of list) {
    push(byCompany, order.shipper_company_id, 'SHIPPER', order);
    if (order.assigned_company_id) push(byCompany, order.assigned_company_id, 'CARRIER', order);
  }

  let reports = 0;
  let emails = 0;

  for (const [companyId, entry] of byCompany) {
    try {
      const sent = await issue(admin, span, companyId, entry.role, entry.orders, route, plate);
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
): Promise<boolean> {
  const companyId = key.split(':')[0]!;
  const week = span.start;
  const t = await getDictionary(defaultLocale);
  const f = createFormat(t.meta.intl);

  const { data: company } = await admin
    .from('companies')
    .select('name, contact_email, billing_email, frozen_at')
    .eq('id', companyId)
    .single();

  if (!company) throw new Error('компания не найдена');

  const carrier = role === 'CARRIER';

  let gross = 0;
  let fee = 0;
  let net = 0;
  let km = 0;

  const rows: ReportRow[] = orders.map((order) => {
    const rate = order.rate_cents ?? 0;
    const bps = order.commission_bps ?? COMMISSION_BPS;
    const commission = commissionCents(rate, bps);
    const payout = payoutCents(rate, bps);

    gross += rate;
    fee += commission;
    net += carrier ? payout : rate;
    km += order.distance_km ?? 0;

    return {
      ref: order.ref,
      closedAt: f.date(order.closed_at ?? order.updated_at),
      route: route.get(order.id) ?? '—',
      vehicle: plate.get(order.id) ?? '—',
      distance: String(order.distance_km ?? 0),
      gross: f.eur(rate),
      commission: carrier ? f.eur(commission) : null,
      net: f.eur(carrier ? payout : rate),
      documents: 0,
    };
  });

  const period = span.kind === 'WEEK'
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
        : t.report_.settlementShipperTitle;

  /*
   * Срок стоит в шапке, а не в письме: письмо теряется, документ
   * остаётся. Заказчику это «оплатить до», перевозчику «выплатим» —
   * одна дата разного смысла, и называть их одним словом нельзя.
   */
  const due = span.due
    ? carrier
      ? t.report_.dueCarrier.replace('{date}', f.date(span.due.carrier))
      : t.report_.dueShipper.replace('{date}', f.date(span.due.shipper))
    : null;

  const texts: ReportTexts = {
    title,
    period: `${period} · ${company.name}`,
    due,
    vatNote: carrier ? t.done.vatNoteCarrier : t.done.vatNoteShipper,
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
    closingNote: t.report_.closingNote,
    operator: `${t.brand.legalEntity} · Y-tunnus ${APP.operator.businessId}`,
    page: t.report_.page,
  };

  const buffer = await renderToBuffer(
    WeeklyReport({
      texts,
      rows,
      totals: {
        gross: f.eur(gross),
        commission: carrier ? f.eur(fee) : null,
        net: f.eur(net),
        distance: String(km),
      },
      withCommission: carrier,
    }),
  );

  const path = `${companyId}/${week}-${role}${span.kind === 'PERIOD' ? '-settlement' : ''}.pdf`;

  const { error: upload } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true });

  if (upload) throw new Error(`загрузка: ${upload.message}`);

  const { data: saved } = await admin.from('weekly_reports').upsert(
    {
      week,
      company_id: companyId,
      role,
      file_path: path,
      bytes: buffer.length,
      orders_count: orders.length,
      gross_cents: gross,
      commission_cents: carrier ? fee : null,
      payout_cents: carrier ? net : null,
      /*
       * Ставка пишется, только если она одна на все рейсы недели. Взяв
       * ставку первого, мы бы подписали отчёт числом, к остальным строкам
       * не относящимся: у закрытых в разное время рейсов она разная.
       */
      commission_bps: uniformBps(orders),
      vat_bps: VAT_BPS,
      kind: span.kind,
      due_date: span.due ? (carrier ? span.due.carrier : span.due.shipper) : null,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'week,company_id,role,kind' },
  )
    .select('id')
    .single();

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
    body: `${orders.length} · ${f.eur(net)}`,
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
          template: 'weekly_report',
          subject:
            span.kind === 'WEEK'
              ? t.report_.emailSubject.replace('{week}', String(isoWeekNumber(week)))
              : t.report_.settlementEmailSubject
                  .replace('{from}', f.date(week))
                  .replace('{to}', f.date(span.end)),
          text: [
            'Hei,',
            '',
            `${texts.title}, ${texts.period}.`,
            '',
            `Kuljetuksia: ${orders.length}`,
            `Yhteensä: ${f.eur(net)}`,
            ...(due ? ['', due] : []),
            '',
            texts.vatNote,
            '',
            'Raportti on saatavilla omilla sivuillasi.',
            '',
            `Kysymykset: ${operatorInbox()}`,
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

export const REPORTS_BUCKET = BUCKET;
