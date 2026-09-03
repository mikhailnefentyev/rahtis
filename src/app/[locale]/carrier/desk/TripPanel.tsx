'use client';

import { useActionState, useState } from 'react';
import { Button, Textarea } from '@/components/ui';
import { stopPlace, tripProgress, type TripStop } from '@/lib/orders/progress';
import { stopTitle, type HaulKind } from '@/lib/orders/haul';
import { completeStopAction, uncompleteStopAction, type TripState } from '@/lib/orders/trip';
import { useI18n } from '@/lib/i18n/provider';

const initial: TripState = { error: null };

/**
 * Отметка прохождения рейса.
 *
 * Одна кнопка на всю карточку, а не по кнопке у каждой точки. Точки
 * проходятся по порядку, значит отметить можно ровно одну — следующую, — и
 * шесть неактивных кнопок рядом с ней только мешали бы искать активную.
 *
 * Повреждения спрашиваются здесь же, в момент прохождения: тот, кто стоит
 * на точке, видит их своими глазами. Отдельная форма «сообщить о
 * повреждении» означала бы, что о нём вспомнят позже — то есть не
 * вспомнят.
 */
export function TripPanel({
  stops,
  haulKind = 'TRAILER',
}: {
  stops: TripStop[];
  /* Забор и возврат называются по единице: у контейнера прицепа нет. */
  haulKind?: HaulKind;
}) {
  const { t, m, f, locale } = useI18n();
  const [state, formAction, pending] = useActionState(completeStopAction, initial);
  const [damageOpen, setDamageOpen] = useState(false);

  const progress = tripProgress(stops);
  const next = progress.next as (TripStop & { id: string }) | null;
  const last = progress.last as (TripStop & { id: string }) | null;

  if (progress.total === 0) return null;

  return (
    <div className="mt-4 rounded-control border border-line bg-sunken p-3">
      {next ? (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="stop_id" value={next.id} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="label-micro">{t.trip.nextStop}</p>
              <p className="mt-0.5 text-[13px] text-ink">
                {next.sequence + 1} · {stopTitle(t, next.role, haulKind)} — {stopPlace(next)}
              </p>
            </div>

            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? t.trip.marking : t.trip.markDone}
            </Button>
          </div>

          {/*
           * Поле повреждения скрыто, пока его не открыли: чистый рейс —
           * обычный случай, и заставлять подтверждать отсутствие
           * повреждений на каждой точке значит приучить нажимать не глядя.
           */}
          {damageOpen ? (
            <Textarea
              name="damage_note"
              rows={2}
              placeholder={t.trip.damagePlaceholder}
              aria-label={t.trip.damageQuestion}
            />
          ) : (
            <button
              type="button"
              onClick={() => setDamageOpen(true)}
              className="self-start text-xs text-ink-faint underline underline-offset-2 hover:text-ink-muted"
            >
              {t.trip.damageQuestion}
            </button>
          )}

          {state.error && (
            <p role="alert" className="text-xs text-danger">
              {state.error}
            </p>
          )}
        </form>
      ) : (
        <p className="text-[13px] text-ok">{t.trip.allDone}</p>
      )}

      {/* Снять отметку можно только с последней — иначе в маршруте дыра. */}
      {last && (
        <form action={uncompleteStopAction} className="mt-3 border-t border-line pt-2.5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="stop_id" value={last.id} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-ink-faint">
              {stopPlace(last)}
              {last.completed_at && (
                <> · {m('trip.completedAt', { time: f.time(last.completed_at) })}</>
              )}
            </span>
            <Button type="submit" size="sm">
              {t.trip.undo}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
