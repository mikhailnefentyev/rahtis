/**
 * Пакет tilaajavastuu: пункты, сроки и состояние. Модуль без серверных
 * импортов — его читают и страницы, и клиентские формы.
 *
 * Перечень — tilaajavastuulaki 1233/2006, 5 § (изменения 464/2025 и
 * 729/2025, в силе с 1.1.2026; работодательский надзор:
 * https://tyosuojelu.fi/en/grey-economy/contractor-s-obligations-and-liability,
 * Verohallinto: https://www.vero.fi/ → Tilaajavastuu). Тот же список стоит
 * в app.verification_required_items() (миграция 20261103060000).
 */

export const VERIFICATION_ITEMS = [
  'REGISTERS',
  'TRADE_REGISTER',
  'TAX_DEBT',
  'PENSION',
  'COLLECTIVE_AGREEMENT',
  'OCCUPATIONAL_HEALTH',
  'ACCIDENT_INSURANCE',
] as const;

export type VerificationItem = (typeof VERIFICATION_ITEMS)[number];

/**
 * Справки о налогах и пенсионном страховании — не старше трёх месяцев
 * (5 § 2 mom.); реестровые данные считаем так же. Срок у них не
 * правится: дата выдачи + 3 месяца.
 */
export const THREE_MONTH_ITEMS: readonly VerificationItem[] = ['REGISTERS', 'TRADE_REGISTER', 'TAX_DEBT', 'PENSION'];

/** За сколько дней предупреждать: «скоро истекает» и письмо. */
export const EXPIRY_WARNING_DAYS = 14;

export function isVerificationItem(value: string): value is VerificationItem {
  return (VERIFICATION_ITEMS as readonly string[]).includes(value);
}

export type ItemStatus = 'OK' | 'EXPIRING' | 'EXPIRED' | 'MISSING';

export function itemStatus(daysLeft: number | null): ItemStatus {
  if (daysLeft == null) return 'MISSING';
  if (daysLeft < 0) return 'EXPIRED';
  if (daysLeft <= EXPIRY_WARNING_DAYS) return 'EXPIRING';
  return 'OK';
}

export const itemStatusTone = {
  OK: 'ok',
  EXPIRING: 'warn',
  EXPIRED: 'danger',
  MISSING: 'neutral',
} as const;

/** ГГГГ-ММ-ДД + n месяцев; 31-е в коротком месяце — последний день месяца, как в Postgres. */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/* ── Пакет в том виде, в каком его отдаёт app.verification_package ── */

export type PackageItem = { item: VerificationItem; valid_until: string | null; source: 'PRH' | 'DOC' | null };

export type PackageDocument = {
  id: string;
  items: VerificationItem[];
  source: 'ITEM' | 'VASTUU';
  file_name: string;
  storage_path: string;
  issued_on: string;
  valid_until: string;
};

export type PackageRegistry = {
  checkedAt: string | null;
  verdict: string | null;
  officialName: string | null;
  tradeRegister: boolean | null;
  prepayment: boolean | null;
  vat: boolean | null;
  employer: boolean | null;
};

export type VerificationPackage = {
  company: { id: string; name: string; business_id: string; country: string };
  verified: boolean;
  granted_at: string | null;
  registry: PackageRegistry | null;
  items: PackageItem[];
  documents: PackageDocument[];
};

/** JSON из базы → пакет в порядке пунктов. NULL — нет доступа или не перевозчик. */
export function parsePackage(raw: unknown): VerificationPackage | null {
  if (!raw || typeof raw !== 'object') return null;
  const pkg = raw as VerificationPackage;
  if (!pkg.company) return null;
  const order = (item: string) => VERIFICATION_ITEMS.indexOf(item as VerificationItem);
  return {
    ...pkg,
    items: [...(pkg.items ?? [])].filter((i) => isVerificationItem(i.item)).sort((a, b) => order(a.item) - order(b.item)),
    documents: pkg.documents ?? [],
  };
}
