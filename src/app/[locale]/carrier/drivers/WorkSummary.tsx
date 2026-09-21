'use client';

import { Stat, StatRow } from '@/components/ui';
import { payableKm, type DriverSummary } from '@/lib/driverPay';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Итоги водителя за период: часы, километры, рейсы и справочная сумма.
 *
 * Один компонент на карточку водителя и на отчёт — цифры одни и те же,
 * и показаны они должны быть одинаково.
 */
export function WorkSummary({
  summary,
  className,
}: {
  summary: DriverSummary;
  className?: string;
}) {
  const { t, f } = useI18n();
  const s = summary.totals;
  const hours = (minutes: number) => `${f.decimal(minutes / 60, 1)} h`;

  const hasSupplements =
    s.parts.overtimeCents + s.parts.eveningCents + s.parts.nightCents + s.parts.weekendCents > 0;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <StatRow>
        <Stat label={t.workReport.colHours} value={hours(s.workMinutes)} />
        <Stat label={t.workReport.colKm} value={f.number(payableKm(s))} />
        <Stat label={t.workReport.colTrips} value={f.number(s.trips)} />
        <Stat label={t.workReport.colStops} value={f.number(s.stops)} />
        <Stat label={t.workReport.colAmount} value={f.eur(s.amountCents)} />
      </StatRow>

      <p className="text-xs text-ink-dim">
        {t.workReport.colBreaks} {hours(s.breakMinutes)} · {t.workReport.colEvening}{' '}
        {hours(s.eveningMinutes)} · {t.workReport.colNight} {hours(s.nightMinutes)} ·{' '}
        {t.workReport.colSaturday} {hours(s.saturdayMinutes)} · {t.workReport.colSunday}{' '}
        {hours(s.sundayMinutes)} · {t.workReport.colOvertime}{' '}
        {hours(s.overtime1Minutes + s.overtime2Minutes)}
      </p>

      {/* Из чего сложилась сумма — только когда есть надбавки, иначе это одна строка. */}
      {hasSupplements && (
        <p className="text-xs text-ink-dim">
          {t.payModel.TES}: {f.eur(s.parts.baseCents)} + {t.workReport.colOvertime}{' '}
          {f.eur(s.parts.overtimeCents)} + {t.workReport.colEvening} {f.eur(s.parts.eveningCents)} +{' '}
          {t.workReport.colNight} {f.eur(s.parts.nightCents)} + {t.workReport.colSaturday}/
          {t.workReport.colSunday} {f.eur(s.parts.weekendCents)}
        </p>
      )}

      {s.missingRate && <p className="text-[13px] text-warn">{t.pay.missingRate}</p>}
    </div>
  );
}
