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
  /* Итог — в валюте компании: дни в другой валюте ставки пересчитаны по курсу своего дня. */
  const money = (cents: number) => f.money(cents, s.currency);

  const hasSupplements =
    s.parts.overtimeCents + s.parts.eveningCents + s.parts.nightCents + s.parts.weekendCents + (s.parts.bonusCents ?? 0) > 0;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <StatRow>
        <Stat label={t.workReport.colHours} value={hours(s.workMinutes)} />
        <Stat label={t.workReport.colKm} value={f.number(payableKm(s))} />
        <Stat label={t.workReport.colTrips} value={f.number(s.trips)} />
        <Stat label={t.workReport.colStops} value={f.number(s.stops)} />
        <Stat label={f.label(t.workReport.colAmount, s.currency)} value={money(s.amountCents)} />
      </StatRow>

      <p className="text-xs text-ink-dim">
        {t.workReport.colBreaks} {hours(s.breakMinutes)} · {t.workReport.colEvening}{' '}
        {hours(s.eveningMinutes)} · {t.workReport.colNight} {hours(s.nightMinutes)} ·{' '}
        {t.workReport.colSaturday} {hours(s.saturdayMinutes)} · {t.workReport.colSunday}{' '}
        {hours(s.sundayMinutes)}
        {/* Праздники страны набора (Прибалтика, Польша) — только если надбавка за праздник есть. */}
        {(s.holidayMinutes ?? 0) > 0 && (
          <>
            {' '}
            · {t.dayPay.holiday} {hours(s.holidayMinutes)}
          </>
        )}{' '}
        · {t.workReport.colOvertime} {hours(s.overtime1Minutes + s.overtime2Minutes)}
      </p>

      {/* Из чего сложилась сумма — только когда есть надбавки, иначе это одна строка. */}
      {hasSupplements && (
        <p className="text-xs text-ink-dim">
          {t.payModel.TES}: {money(s.parts.baseCents)} + {t.workReport.colOvertime}{' '}
          {money(s.parts.overtimeCents)} + {t.workReport.colEvening} {money(s.parts.eveningCents)} +{' '}
          {t.workReport.colNight} {money(s.parts.nightCents)} + {t.workReport.colSaturday}/
          {t.workReport.colSunday} {money(s.parts.weekendCents)}
          {(s.parts.bonusCents ?? 0) > 0 && (
            <>
              {' '}
              + {t.dayPay.bonus} {money(s.parts.bonusCents)}
            </>
          )}
        </p>
      )}

      {s.missingRate && <p className="text-[13px] text-warn">{t.pay.missingRate}</p>}
    </div>
  );
}
