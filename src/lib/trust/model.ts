/**
 * Сведения о заказчике для перевозчика в режиме «напрямую»: разбор
 * строки из базы и то, чем интерфейс её объясняет (решение 6.11.2026).
 *
 * Без импортов из приложения: модуль читают сервер, клиент и тесты
 * (node --test). Считает база (app.shipper_trust_of) — здесь только
 * доли, флаги и проверка отметки перевозчика.
 */

import type { ShipperDocKind } from '../shipper-docs/model';

export const REPORT_STATUSES = ['ON_TIME', 'LATE', 'UNPAID'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === 'string' && (REPORT_STATUSES as readonly string[]).includes(value);
}

/** Строка public.shipper_trust / public.company_trust. */
export type TrustRow = {
  company_id: string;
  country: string;
  registered_on: string | null;
  on_platform_since: string;
  registry_verdict: string | null;
  registry_situations: string[] | null;
  registry_vat: boolean | null;
  registry_prepayment: boolean | null;
  registry_checked_at: string | null;
  invoiced_count: number;
  paid_on_time: number;
  paid_late: number;
  avg_days_late: number | null;
  overdue_count: number;
  reports_on_time: number;
  reports_late: number;
  reports_unpaid: number;
  done_12m: number;
  first_done_at: string | null;
  /* Документы заказчика (20261106150100): до миграции колонок нет. */
  register_extract_approved?: boolean | null;
  register_extract_issued_on?: string | null;
  register_extract_valid_until?: string | null;
  tax_debt_approved?: boolean | null;
  tax_debt_issued_on?: string | null;
  tax_debt_valid_until?: string | null;
  vat_certificate_approved?: boolean | null;
  vat_certificate_issued_on?: string | null;
  vat_certificate_valid_until?: string | null;
  signatory_approved?: boolean | null;
  signatory_issued_on?: string | null;
  signatory_valid_until?: string | null;
  /* Счета перевозчиков (freight_invoices) и смена счёта (20261106170000): до миграции колонок нет. */
  freight_invoices_count?: number | null;
  freight_paid_on_time?: number | null;
  freight_paid_late?: number | null;
  freight_avg_days_late?: number | null;
  freight_overdue?: number | null;
  bank_changed_at?: string | null;
};

/** Проверенный оператором документ заказчика: только даты, без файла и проверяющего. */
export type DocMark = { kind: ShipperDocKind; issuedOn: string | null; validUntil: string | null };

/* Порядок отметок и префикс колонок сводки. */
const DOC_COLUMNS: [ShipperDocKind, 'register_extract' | 'tax_debt' | 'vat_certificate' | 'signatory'][] = [
  ['REGISTER_EXTRACT', 'register_extract'],
  ['TAX_DEBT_CERTIFICATE', 'tax_debt'],
  ['VAT_CERTIFICATE', 'vat_certificate'],
  ['SIGNATORY_AUTHORITY', 'signatory'],
];

/**
 * Одобренные документы из строки сводки. Отклонённый и отсутствующий не
 * показываются вовсе: отсутствие — не красный флаг.
 */
export function docMarks(row: TrustRow): DocMark[] {
  return DOC_COLUMNS.filter(([, p]) => row[`${p}_approved`] === true).map(([kind, p]) => ({
    kind,
    issuedOn: row[`${p}_issued_on`] ?? null,
    validUntil: row[`${p}_valid_until`] ?? null,
  }));
}

/** Ситуации реестра, которые красят сводку красным. */
export type RegistryFlag = 'BANKRUPTCY' | 'RESTRUCTURING' | 'LIQUIDATION' | 'OTHER';

export type ShipperTrust = {
  country: string;
  /** Дата регистрации по реестру; нет — «в RAHTIS с». */
  registeredOn: string | null;
  onPlatformSince: string;
  registry: {
    verdict: string | null;
    flags: RegistryFlag[];
    /** Ситуации как в реестре — по-фински (оператору). */
    situations: string[];
    vat: boolean | null;
    prepayment: boolean | null;
    checkedAt: string | null;
  };
  aivomaa: {
    invoiced: number;
    onTime: number;
    late: number;
    avgDaysLate: number | null;
    overdue: number;
    /** Доля вовремя среди решённых (оплачен или просрочен), 0–100; NULL — решённых нет. */
    onTimePct: number | null;
  };
  /** Счета перевозчиков по прямым рейсам за 12 месяцев (напоминания об оплате). */
  invoices: {
    count: number;
    onTime: number;
    late: number;
    avgDaysLate: number | null;
    overdue: number;
    onTimePct: number | null;
  };
  /** Последняя смена счёта заказчика за 30 дней (только момент). */
  bankChangedAt: string | null;
  reports: { onTime: number; late: number; unpaid: number; total: number };
  done12m: number;
  firstDoneAt: string | null;
  /** Проверенные документы заказчика (выписка, налоги, право подписи). */
  documents: DocMark[];
};

/*
 * Финские названия ситуаций из снимка (prh.ts, brregVerdict.ts) и коды
 * PRH на случай неизвестного описания.
 */
export function registryFlag(situation: string): RegistryFlag {
  const s = situation.toLowerCase();
  if (s.startsWith('konkurssi') || s === 'konk') return 'BANKRUPTCY';
  if (s.startsWith('saneera') || s === 'sane') return 'RESTRUCTURING';
  if (s.includes('selvitystila') || s === 'seltila') return 'LIQUIDATION';
  return 'OTHER';
}

export function onTimePct(onTime: number, late: number, overdue: number): number | null {
  const settled = onTime + late + overdue;
  if (settled <= 0) return null;
  return Math.round((onTime / settled) * 100);
}

export function toTrust(row: TrustRow): ShipperTrust {
  const situations = (row.registry_situations ?? []).filter(Boolean);
  const reports = {
    onTime: row.reports_on_time ?? 0,
    late: row.reports_late ?? 0,
    unpaid: row.reports_unpaid ?? 0,
    total: 0,
  };
  reports.total = reports.onTime + reports.late + reports.unpaid;
  return {
    country: row.country,
    registeredOn: row.registered_on,
    onPlatformSince: row.on_platform_since,
    registry: {
      verdict: row.registry_verdict,
      flags: situations.map(registryFlag),
      situations,
      vat: row.registry_vat,
      prepayment: row.registry_prepayment,
      checkedAt: row.registry_checked_at,
    },
    aivomaa: {
      invoiced: row.invoiced_count ?? 0,
      onTime: row.paid_on_time ?? 0,
      late: row.paid_late ?? 0,
      avgDaysLate: row.avg_days_late,
      overdue: row.overdue_count ?? 0,
      onTimePct: onTimePct(row.paid_on_time ?? 0, row.paid_late ?? 0, row.overdue_count ?? 0),
    },
    invoices: {
      count: row.freight_invoices_count ?? 0,
      onTime: row.freight_paid_on_time ?? 0,
      late: row.freight_paid_late ?? 0,
      avgDaysLate: row.freight_avg_days_late ?? null,
      overdue: row.freight_overdue ?? 0,
      onTimePct: onTimePct(row.freight_paid_on_time ?? 0, row.freight_paid_late ?? 0, row.freight_overdue ?? 0),
    },
    bankChangedAt: row.bank_changed_at ?? null,
    reports,
    done12m: row.done_12m ?? 0,
    firstDoneAt: row.first_done_at,
    documents: docMarks(row),
  };
}

/**
 * Тон сводки для значка: красный — банкротство, ликвидация,
 * реструктуризация, просроченные счета (Aivomaa или перевозчиков), «не оплачен»;
 * жёлтый — опоздания и недавняя смена счёта; иначе нейтральный. Это не оценка, а подсказка,
 * куда смотреть.
 */
export type TrustTone = 'bad' | 'warn' | 'neutral';

export function trustTone(t: ShipperTrust): TrustTone {
  if (t.registry.flags.some((f) => f !== 'OTHER') || t.aivomaa.overdue > 0 || t.invoices.overdue > 0 || t.reports.unpaid > 0) return 'bad';
  if (t.aivomaa.late > 0 || t.invoices.late > 0 || t.reports.late > 0 || t.registry.flags.length > 0 || t.bankChangedAt) return 'warn';
  return 'neutral';
}

/**
 * Отметка перевозчика из формы: статус, дни опоздания (только у LATE,
 * 1–3650), заметка до 300 знаков. Ошибка — код для словаря.
 */
export type ParsedReport =
  | { ok: true; status: ReportStatus; daysLate: number | null; note: string | null }
  | { ok: false; error: 'status' | 'days' | 'note' };

export function parseReport(status: unknown, days: unknown, note: unknown): ParsedReport {
  if (!isReportStatus(status)) return { ok: false, error: 'status' };
  const text = String(note ?? '').trim();
  if (text.length > 300) return { ok: false, error: 'note' };
  let daysLate: number | null = null;
  if (status === 'LATE') {
    const raw = String(days ?? '').trim();
    if (!/^\d{1,4}$/.test(raw)) return { ok: false, error: 'days' };
    daysLate = Number(raw);
    if (daysLate < 1 || daysLate > 3650) return { ok: false, error: 'days' };
  }
  return { ok: true, status, daysLate, note: text || null };
}
