import 'server-only';

import { renderToBuffer } from '@react-pdf/renderer';
import { COMMISSION_BPS, commissionCents, payoutCents, vatBpsFor, withVat } from '@/lib/config';
import { operatorInbox } from '@/lib/email';
import { emailLocaleOf, emailText } from '@/lib/email/text';
import { createFormat } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';
import { createMessages } from '@/lib/i18n/message';
import { notify } from '@/lib/notify';
import { getOperatorProfile, operatorLines } from '@/lib/operator/profile';
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
  commission_bps: number | null;
  /** Плата заказчика сверху цены, зафиксированная при закрытии. */
  shipper_fee_bps: number | null;
  shipper_company_id: string;
  assigned_company_id: string | null;
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
   * Конец месяца — начисляется месячный сбор перевозчиков за активные
   * машины. До выпуска документов: отчёт за 16–конец удерживает его из
   * выплаты. Повторный запуск ничего не дублирует.
   */
  const monthEnd = new Date(`${period.period_end}T00:00:00Z`);
  monthEnd.setUTCDate(monthEnd.getUTCDate() + 1);
  if (monthEnd.getUTCDate() === 1) {
    const { error: feeError } = await admin.rpc('issue_monthly_subscriptions', {
      p_month: `${period.period_end.slice(0, 7)}-01`,
    });
    if (feeError) {
      return { week: period.period_start, reports: 0, emails: 0, errors: [`сбор: ${feeError.message}`] };
    }
  }

  return run({
    kind: 'PERIOD',
    start: period.period_start,
    end: period.period_end,
    due: { shipper: period.invoice_due, carrier: period.payout_due },
  });
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
      'id, ref, closed_at, updated_at, distance_km, rate_cents, commission_bps, shipper_fee_bps, shipper_company_id, assigned_company_id',
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

  const { data: company } = await admin
    .from('companies')
    .select(
      'name, country, language, contact_email, billing_email, frozen_at, business_id, vat_number, legal_name, legal_street, legal_postal_code, legal_city, legal_country, billing_street, billing_postal_code, billing_city, billing_country, billing_reference',
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
   * нет, выплата равна цене). Заказчику — цена плюс плата 3 % за заказ со
   * стола: в колонке «Palvelumaksu» и в сумме к оплате.
   */
  const rows: ReportRow[] = orders.map((order) => {
    const rate = order.rate_cents ?? 0;
    const bps = order.commission_bps ?? COMMISSION_BPS;
    const payout = payoutCents(rate, bps);
    const shipperFee = Math.round((rate * (order.shipper_fee_bps ?? 0)) / 10_000);

    gross += rate;
    fee += carrier ? commissionCents(rate, bps) : shipperFee;
    net += carrier ? payout : rate + shipperFee;
    km += order.distance_km ?? 0;

    return {
      ref: order.ref,
      closedAt: f.date(order.closed_at ?? order.updated_at),
      route: route.get(order.id) ?? '—',
      vehicle: plate.get(order.id) ?? '—',
      distance: String(order.distance_km ?? 0),
      gross: f.eur(rate),
      commission: carrier ? null : f.eur(shipperFee),
      net: f.eur(carrier ? payout : rate + shipperFee),
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
        label: t.report_.feeLine
          .replace('{month}', `${Number(row.month.slice(5, 7))}/${row.month.slice(0, 4)}`)
          .replace('{count}', String(row.active_vehicles))
          .replace('{unit}', f.eur(row.unit_cents))
          .replace('{vat}', f.percent(row.vat_bps / 10_000, 1)),
        amount: `−${f.eur(row.amount_cents)}`,
      });
    }
  }
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
      company.business_id ? `Y-tunnus ${company.business_id}` : null,
      company.vat_number ? `${t.report_.vatNumber} ${company.vat_number}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    company.billing_reference ? `${t.report_.reference} ${company.billing_reference}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));

  const texts: ReportTexts = {
    parties: [
      { label: carrier ? t.report_.payer : t.report_.seller, lines: operatorLines(operator, ids) },
      { label: carrier ? t.report_.payee : t.report_.customer, lines: recipient },
    ],
    title,
    period: `${period} · ${company.name}`,
    due,
    vatNote: vatBps > 0 ? t.done.vatNoteDomestic : t.done.vatNoteReverse,
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
        deductions,
        payable: deductions.length > 0 ? { label: t.report_.payable, amount: f.eur(payable) } : null,
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
        /* Доля оператора: у заказчика — плата 3 %, у перевозчика — удержанный сбор. */
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
            `${t.report_.total}: ${f.eur(deductions.length > 0 ? payable : net)}`,
            ...(due ? ['', due] : []),
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
