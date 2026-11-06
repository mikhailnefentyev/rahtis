'use client';

import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import { bankMarkDays } from '@/lib/trust/changes';

/*
 * «Реквизиты изменены N дней назад» — контрагенту, 30 дней после смены
 * IBAN (company_sensitive_changes). Только срок, без значений: подмена
 * счёта — главный приём мошенников, а знать новый счёт контрагенту здесь
 * незачем.
 */
export function BankChangedNote({ at, hint = false, className }: { at: string | null | undefined; hint?: boolean; className?: string }) {
  const { t } = useI18n();
  const days = bankMarkDays(at);
  if (days === null) return null;
  const tw = t.trustWins;
  const text = days === 0 ? tw.bankChangedToday : days === 1 ? tw.bankChangedOne : tw.bankChangedDays.replace('{days}', String(days));

  return (
    <span className={cn('block text-warn', className)}>
      <span aria-hidden>⚠ </span>
      {text}
      {hint && <span className="block text-xs text-ink-muted">{tw.bankChangedHint}</span>}
    </span>
  );
}
