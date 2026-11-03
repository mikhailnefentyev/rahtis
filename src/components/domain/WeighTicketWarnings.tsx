'use client';

import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import type { TicketWarning } from '@/lib/weighTicket/reading';

/**
 * Предупреждения по весовому талону — у водителя и у диспетчера одни.
 *
 * Сдвинутую запятую можно поправить одной кнопкой: форма получает
 * предложенный вес через onFix. Остальное человек правит сам или
 * сохраняет как есть («Tallenna silti»).
 */
export function WeighTicketWarnings({
  warnings,
  onFix,
  className,
}: {
  warnings: TicketWarning[];
  onFix?: (field: 'gross' | 'tare', kg: number) => void;
  className?: string;
}) {
  const { t, f } = useI18n();
  const w = t.weighTicket;
  if (warnings.length === 0) return null;

  const tonnes = (kg: number) => `${f.decimal(kg / 1000, kg % 1000 === 0 ? 0 : kg % 100 === 0 ? 1 : 2)} t`;
  const when = (iso: string | null) => (iso ? f.dateTime(iso) : '—');
  const fill = (template: string, values: Record<string, string>) =>
    Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);

  const message = (warning: TicketWarning): string => {
    switch (warning.code) {
      case 'DUPLICATE_PHOTO':
        return fill(w.warnings.DUPLICATE_PHOTO, { job: warning.job, at: when(warning.at) });
      case 'DUPLICATE_TICKET':
        return fill(w.warnings.DUPLICATE_TICKET, {
          ticket: warning.ticketNo,
          job: warning.scale ? `${warning.job} · ${warning.scale}` : warning.job,
          at: when(warning.at),
        });
      case 'PLATE_MISMATCH':
        return fill(w.warnings.PLATE_MISMATCH, { read: warning.read.join(', '), expected: warning.expected.join(' + ') });
      case 'NET_MISMATCH':
        return fill(w.warnings.NET_MISMATCH, { net: tonnes(warning.netKg), gross: tonnes(warning.grossKg), tare: tonnes(warning.tareKg) });
      case 'NET_ONLY':
        return w.warnings.NET_ONLY;
      case 'DECIMAL':
        return fill(w.warnings.DECIMAL, { field: w.fields[warning.field], value: tonnes(warning.valueKg), suggested: tonnes(warning.suggestedKg) });
      case 'IMPLAUSIBLE':
        return fill(w.warnings.IMPLAUSIBLE, { field: w.fields[warning.field], value: tonnes(warning.valueKg) });
      case 'OVER_PAYLOAD':
        return fill(w.warnings.OVER_PAYLOAD, { net: tonnes(warning.netKg), payload: tonnes(warning.payloadKg) });
      case 'LOW_CONFIDENCE':
        return w.warnings.LOW_CONFIDENCE;
    }
  };

  return (
    <div className={cn('flex flex-col gap-2 rounded-card border border-warn/40 bg-warn/10 px-3 py-3', className)} role="alert">
      <p className="text-[13px] font-semibold text-warn">{w.checkFirst}</p>
      <ul className="flex flex-col gap-1.5 text-[14px] leading-snug">
        {warnings.map((warning, i) => (
          <li key={`${warning.code}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{message(warning)}</span>
            {warning.code === 'DECIMAL' && onFix && (
              <button
                type="button"
                className="rounded-control border border-line-strong bg-surface px-2 py-0.5 text-[13px] font-semibold"
                onClick={() => onFix(warning.field, warning.suggestedKg)}
              >
                {fill(w.useSuggested, { value: tonnes(warning.suggestedKg) })}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
