import type { I18n } from '@/lib/i18n/bundle';
import type { MessageKey, MessageValues } from '@/lib/i18n/message';

/**
 * Текст уведомления кабинета на языке читающего.
 *
 * В строке notifications лежит код события и подстановки; фразу собирает
 * словарь: заголовок — msg['event.<код>'], тело — msg['event.<код>.body'].
 * Готовые title/body в строке — запасной текст на языке компании (fi/en):
 * его показываем, если кода нет (свободное сообщение оператора) или
 * словарь этого кода не знает (строка старше словаря).
 *
 * Подстановки хранятся без языка, а слово подбирается здесь:
 * - дата 'YYYY-MM-DD' — датой читающего;
 * - xxxCents (число) — суммой {xxx};
 * - xxxBps (число) — процентом {xxx};
 * - коды перечней (вид документа, узел машины, вид ТО) — подписью из
 *   словаря, см. LABELS.
 * Списки (сроки ТО, затронутые рейсы) в ICU не выражаются — тело для них
 * собирают BODY из уже существующих строк словаря.
 */

export type NotificationRow = {
  code: string | null;
  params: unknown;
  title: string | null;
  body: string | null;
};

type Values = Record<string, unknown>;
type Lines = (string | null | undefined)[];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function label(table: unknown, key: unknown): string | undefined {
  if (typeof key !== 'string' || !table || typeof table !== 'object') return undefined;
  const value = (table as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/** Подписи перечней по коду события: код хранится в базе, слово — в словаре. */
const LABELS: Record<string, (p: Values, t: I18n['t']) => Values> = {
  'driver.certificate_expiring': (p, t) => ({ type: label(t.certificates.types, p.type) ?? p.type }),
  'verification.expiring': (p, t) => ({ item: label(t.verification.items, p.item) ?? p.item }),
  'invoice.terms_proposed': (p, t) => ({ schedule: label(t.invoiceTerms.schedules, p.schedule) ?? p.schedule }),
  'maintenance.defect': (p, t) => ({ area: label(t.maintenance.defects.areas, p.area) ?? p.area }),
  'maintenance.defect_unsafe': (p, t) => ({ area: label(t.maintenance.defects.areas, p.area) ?? p.area }),
  'company.document_approved': (p, t) => ({ document: documentLabel(p, t) }),
  'company.document_rejected': (p, t) => ({ document: documentLabel(p, t) }),
};

/** То же правило, что в forwarders/actions.ts: документ заказчика, лицензия или полис. */
function documentLabel(p: Values, t: I18n['t']): string {
  const kind = String(p.document ?? '');
  if (p.shipper === 'yes') return label(t.documents, kind) ?? kind;
  if (kind === 'FORWARDER_LICENSE') return t.forwarder.licenseTitle;
  return p.owner === 'yes' ? t.forwarder.insuranceTitleOwner : t.forwarder.insuranceTitle;
}

function ordersLine(p: Values, { m, f }: I18n): string | null {
  const orders = Array.isArray(p.orders) ? (p.orders as { ref?: string; day?: string }[]) : [];
  if (orders.length === 0) return null;
  const refs = orders
    .map((o) => (o.day && ISO_DAY.test(o.day) ? `${o.ref ?? ''} (${f.date(`${o.day}T12:00:00Z`)})` : (o.ref ?? '')))
    .join(', ');
  return m('maintenance.downtimeOrders', { refs });
}

type DueItem = {
  plate?: string;
  kind?: string;
  title?: string | null;
  dueOn?: string | null;
  dueKm?: number | null;
  daysLeft?: number | null;
  kmLeft?: number | null;
};

/** Строка срока ТО — как в письме maintenance/reminders.ts, но на языке читающего. */
function dueLine(d: DueItem, { t, m, f }: I18n): string {
  const kind = d.kind === 'OTHER' && d.title ? d.title : (label(t.maintenance.kinds, d.kind) ?? d.kind ?? '');
  const when = [
    d.dueOn && ISO_DAY.test(d.dueOn)
      ? `${f.date(`${d.dueOn}T12:00:00Z`)} (${
          d.daysLeft != null && d.daysLeft < 0
            ? m('maintenance.daysOverdue', { days: -d.daysLeft })
            : m('maintenance.inDays', { days: d.daysLeft ?? 0 })
        })`
      : null,
    d.dueKm != null
      ? `${f.number(d.dueKm)} km (${
          d.kmLeft != null && d.kmLeft <= 0
            ? m('maintenance.kmOver', { km: f.number(-d.kmLeft) })
            : d.kmLeft != null
              ? m('maintenance.kmLeft', { km: f.number(d.kmLeft) })
              : '—'
        })`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return `${d.plate ?? ''} · ${kind} — ${when}`;
}

function dueLines(p: Values, i18n: I18n): Lines {
  const items = Array.isArray(p.items) ? (p.items as DueItem[]) : [];
  return items.map((d) => dueLine(d, i18n));
}

/** Тело, которое не помещается в одну ICU-строку: списки и пометки из словаря. */
const BODY: Record<string, (p: Values, i18n: I18n) => Lines> = {
  'maintenance.defect': (p, i18n) => [`${p.who ?? '—'}: ${p.text ?? ''}`, ordersLine(p, i18n)],
  'maintenance.defect_unsafe': (p, i18n) => [
    `${p.who ?? '—'}: ${p.text ?? ''}`,
    i18n.t.maintenance.downtime.defectBlockedNote,
    ordersLine(p, i18n),
  ],
  'maintenance.due': dueLines,
  'maintenance.overdue': dueLines,
  'maintenance.inspection_blocked': (p, i18n) => [ordersLine(p, i18n)],
};

/** Подстановки без языка → значения для ICU на языке читающего. */
function prepare(code: string, raw: Values, i18n: I18n): MessageValues {
  const { f, t } = i18n;
  const values: MessageValues = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      values[key] = ISO_DAY.test(value) ? f.date(`${value}T12:00:00Z`) : value;
    } else if (typeof value === 'number') {
      values[key] = value;
      if (key.endsWith('Cents') && key.length > 5) values[key.slice(0, -5)] = f.eur(value);
      if (key.endsWith('Bps') && key.length > 3) values[key.slice(0, -3)] = f.percent(value / 10_000, 1);
    } else if (typeof value === 'boolean') {
      values[key] = value ? 'yes' : 'no';
    } else if (value === null) {
      /* Пустая подстановка из триггера — пустое место, а не запасной текст. */
      values[key] = '';
    }
  }
  const extra = LABELS[code]?.(raw, t) ?? {};
  for (const [key, value] of Object.entries(extra)) {
    if (typeof value === 'string' || typeof value === 'number') values[key] = value;
  }
  return values;
}

function known(t: I18n['t'], key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(t.msg, key);
}

export function notificationText(row: NotificationRow, i18n: I18n): { title: string; body: string | null } {
  const fallback = { title: row.title ?? row.code ?? '', body: row.body };
  if (!row.code) return { title: row.title ?? '', body: row.body };

  const titleKey = `event.${row.code}`;
  if (!known(i18n.t, titleKey)) return fallback;

  const raw = (row.params && typeof row.params === 'object' ? row.params : {}) as Values;

  try {
    const values = prepare(row.code, raw, i18n);
    const title = i18n.m(titleKey, values);

    const bodyKey = `${titleKey}.body`;
    const builder = BODY[row.code];
    if (!known(i18n.t, bodyKey) && !builder) return { title, body: row.body };

    const lines: Lines = [
      known(i18n.t, bodyKey) ? i18n.m(bodyKey, values) : null,
      ...(builder ? builder(raw, i18n) : []),
    ];
    const body = lines.filter((line): line is string => Boolean(line)).join('\n');
    return { title, body: body || null };
  } catch {
    /* Не хватило подстановки — показываем запасной текст, а не пустую строку. */
    return fallback;
  }
}
