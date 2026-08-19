'use client';

import { Badge, Mono } from '@/components/ui';
import { stopPlace, tripProgress, tripStageKey, type TripStop } from '@/lib/orders/progress';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Этап рейса одной строкой.
 *
 * Один компонент на все три роли: заказчик, перевозчик и оператор читают
 * этап по одним и тем же точкам (ТЗ §7, «единый статус»). Ничего своего он
 * не хранит и не запрашивает — только выводит.
 *
 * Этап всегда с местом: при двух выгрузках в рейсе «Выгрузился» без
 * названия площадки не отвечает на вопрос, где именно.
 */
export function TripStage({ stops, className }: { stops: TripStop[]; className?: string }) {
  const { t, m, f } = useI18n();

  const progress = tripProgress(stops);
  if (progress.total === 0) return null;

  const stage = t.tripStage[tripStageKey(progress)];

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone={progress.finished ? 'ok' : 'live'}>
          {progress.last ? m('trip.stageAt', { stage, place: stopPlace(progress.last) }) : stage}
        </Badge>

        <Mono className="text-xs text-ink-faint">
          {m('trip.progressCount', { done: progress.done, total: progress.total })}
        </Mono>

        {/*
         * Куда едет прямо сейчас. Это и есть «В пути» из ТЗ §7 — состояние
         * между точками, которое незачем отмечать отдельно: оно наступает
         * само, как только точка пройдена, а следующая ещё нет.
         */}
        {progress.next && progress.done > 0 && (
          <span className="text-xs text-ink-muted">
            {m('trip.enRouteTo', { place: stopPlace(progress.next) })}
          </span>
        )}
      </div>

      {/*
       * Повреждения выносятся наверх, а не прячутся в списке точек: это
       * то, ради чего заказчик открывает карточку идущего рейса.
       */}
      {progress.damaged.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {progress.damaged.map((stop) => (
            <p
              key={stop.sequence}
              className="rounded-control border border-danger/35 bg-danger/10 px-2.5 py-1.5 text-xs text-danger"
            >
              {m('trip.damageAt', { place: stopPlace(stop) })} — {stop.damage_note}
            </p>
          ))}
        </div>
      )}

      {progress.finished && (
        <p className="mt-2 text-xs text-ok">
          {t.trip.allDone}
          {progress.last?.completed_at && (
            <>
              {' · '}
              <Mono>{f.dateTime(progress.last.completed_at)}</Mono>
            </>
          )}
        </p>
      )}
    </div>
  );
}
