'use client';

import { useI18n } from '@/lib/i18n/provider';

/*
 * С 6.11.2026 полис экспедитора — отметка для перевозчика, а не допуск:
 * запрета, отсрочки и объяснений «почему закрыто» больше нет.
 */

export type ForwarderPolicyInfo = { until: string | null; cargoOwner: boolean };

/**
 * У перевозчика на рейсе по прямому договору: проверен ли полис
 * экспедитора-заказчика и до какой даты. Справка, не гарантия оплаты
 * (CARRIER_AGREEMENT, раздел 2) — так и подписано.
 */
export function ForwarderPolicyNote({ info, className }: { info: ForwarderPolicyInfo | undefined; className?: string }) {
  const { t, f } = useI18n();
  if (!info) return null;
  const fw = t.forwarder;
  /* Грузовладелец с принятым полисом ответственности — и то и другое (17.11.2026). */
  const label = info.cargoOwner
    ? info.until
      ? `${fw.cargoOwnerNote} · ${fw.policyCheckedOwner.replace('{date}', f.date(`${info.until}T12:00:00Z`))}`
      : fw.cargoOwnerNote
    : info.until
      ? fw.policyChecked.replace('{date}', f.date(`${info.until}T12:00:00Z`))
      : fw.policyNotChecked;

  return (
    <p className={`text-xs ${info.until || info.cargoOwner ? 'text-ink-muted' : 'text-warn'} ${className ?? ''}`} title={fw.infoOnly}>
      {label} <span className="text-ink-dim">· {fw.infoOnly}</span>
    </p>
  );
}
