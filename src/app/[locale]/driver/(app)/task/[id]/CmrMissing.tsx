'use client';

import { useI18n } from '@/lib/i18n/provider';
import { useOutbox } from '../../../OutboxProvider';
import { ScanCapture } from './ScanCapture';

/** Есть ли накладная — на сервере или в очереди телефона. */
function useHasCmr(orderId: string, onServer: boolean): boolean {
  const { pending } = useOutbox();
  return onServer || pending.some((e) => e.kind === 'UPLOAD' && e.fields.order_id === orderId && e.fields.cmr === '1');
}

/**
 * Напоминание на последней точке: без накладной перевозчик рейс не
 * закроет. Не запрет — бывает, что накладную отдают позже, — но сказано
 * до нажатия «Tehty», а не после. Если на точке нет своего шага
 * подтверждения (отцепка), кнопка скана здесь же.
 */
export function CmrReminder({
  orderId,
  stopId,
  hasCmr,
  withScan,
}: {
  orderId: string;
  stopId: string;
  hasCmr: boolean;
  withScan: boolean;
}) {
  const { t } = useI18n();
  if (useHasCmr(orderId, hasCmr)) return null;
  return (
    <div className="rounded-card border border-warn/40 bg-warn/10 p-3">
      <p className="text-[15px] font-semibold text-warn">{t.driverApp.cmrMissing}</p>
      {withScan && <ScanCapture className="mt-2" orderId={orderId} stopId={stopId} />}
    </div>
  );
}

/**
 * Все точки пройдены, а накладной нет: скан доступен, пока рейс не
 * закрыт. Раньше снять её после последней точки было нельзя, и
 * перевозчик просил фото в мессенджере.
 */
export function CmrMissing({ orderId, stopId, hasCmr }: { orderId: string; stopId: string; hasCmr: boolean }) {
  const { t } = useI18n();
  if (useHasCmr(orderId, hasCmr)) return null;
  return (
    <section className="rounded-card border border-warn/40 bg-warn/10 p-4">
      <p className="text-[16px] font-semibold text-warn">{t.driverApp.cmrMissingTitle}</p>
      <p className="mt-1 text-[15px] text-ink-muted">{t.driverApp.cmrMissingText}</p>
      <ScanCapture className="mt-3" orderId={orderId} stopId={stopId} />
    </section>
  );
}
