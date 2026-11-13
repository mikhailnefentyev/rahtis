import type { StatusTone } from '@/components/ui/tone';
import type { I18n } from '@/lib/i18n';
import type { DueState, DueStatus } from '@/lib/maintenance/status';

/** Подписи срока для кабинета: «20.11.2026 · через 7 дней», «501 500 km · осталось 1 500 km». */

export const dueTone: Record<DueState, StatusTone> = { OVERDUE: 'danger', SOON: 'warn', OK: 'ok', NONE: 'neutral' };

type Fmt = Pick<I18n, 't' | 'm' | 'f'>;

export function itemLabel({ t }: Fmt, item: { kind: string; title: string | null }): string {
  const kinds = t.maintenance.kinds as Record<string, string>;
  if (item.kind === 'OTHER' && item.title) return item.title;
  const base = kinds[item.kind] ?? item.kind;
  return item.title && item.title !== base ? `${base} · ${item.title}` : base;
}

export function dueParts({ m, f }: Fmt, item: { next_due_on: string | null; next_due_km: number | null }, status: DueStatus): string[] {
  const parts: string[] = [];
  if (item.next_due_on) {
    const left =
      status.daysLeft == null
        ? ''
        : status.daysLeft < 0
          ? m('maintenance.daysOverdue', { days: -status.daysLeft })
          : m('maintenance.inDays', { days: status.daysLeft });
    parts.push(`${f.date(`${item.next_due_on}T12:00:00Z`)}${left ? ` · ${left}` : ''}`);
  }
  if (item.next_due_km != null) {
    const left =
      status.kmLeft == null
        ? ''
        : status.kmLeft <= 0
          ? m('maintenance.kmOver', { km: f.number(-status.kmLeft) })
          : m('maintenance.kmLeft', { km: f.number(status.kmLeft) });
    parts.push(`${f.number(item.next_due_km)} km${left ? ` · ${left}` : ''}`);
  }
  return parts;
}

export function intervalText({ t }: Fmt, item: { interval_months: number | null; interval_km: number | null }, f: I18n['f']): string | null {
  const s = t.maintenance;
  const parts = [
    item.interval_months ? `${item.interval_months} ${s.monthsShort}` : null,
    item.interval_km ? `${f.number(item.interval_km)} km` : null,
  ].filter(Boolean);
  return parts.length ? `${s.every} ${parts.join(` ${s.or} `)}` : null;
}
