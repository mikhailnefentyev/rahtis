'use client';

import { useActionState, useRef, useState } from 'react';
import { Button, Textarea } from '@/components/ui';
import { stopPlace, tripProgress, type TripStop } from '@/lib/orders/progress';
import { stopTitle, type HaulKind } from '@/lib/orders/haul';
import { askPosition } from '@/lib/orders/position';
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
 *
 * По той же причине здесь же берётся координата — до отправки формы, а
 * не отдельной кнопкой «отметить место». Нажатие и место обязаны быть
 * одним событием: отметка, которую ставят вторым действием, ставится
 * тогда, когда удобно, а не там, где стоял человек.
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

  /*
   * Координата спрашивается по нажатию, а не при показе панели.
   *
   * Запрос при открытии карточки означал бы окно разрешения у каждого,
   * кто просто листает рейсы, — и отказ, данный один раз не глядя,
   * закрыл бы геолокацию для всех последующих доставок.
   *
   * Отправка формы при этом откладывается на один круг: submit
   * останавливается, замер делается, поля заполняются, форма
   * отправляется заново. Дольше шести секунд это не длится — столько
   * стоит таймаут в askPosition.
   */
  const form = useRef<HTMLFormElement>(null);
  const located = useRef(false);
  const [locating, setLocating] = useState(false);
  const [position, setPosition] = useState<{ lat: string; lon: string; accuracy: string }>({
    lat: '', lon: '', accuracy: '',
  });

  async function locateThenSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (located.current) return;

    event.preventDefault();
    setLocating(true);

    const where = await askPosition();
    if (where) {
      setPosition({
        lat: String(where.lat),
        lon: String(where.lon),
        accuracy: where.accuracyM === null ? '' : String(where.accuracyM),
      });
    }

    /*
     * Отказ браузера отметку не отменяет. Точка помечается пройденной
     * без координаты, и это видно в карточке у всех трёх сторон —
     * запрет здесь заставил бы курьера звонить оператору, а оператор
     * закрыл бы точку руками, то есть доказательства не прибавилось бы.
     */
    located.current = true;
    setLocating(false);
    form.current?.requestSubmit();
  }

  const progress = tripProgress(stops);
  const next = progress.next as (TripStop & { id: string }) | null;
  const last = progress.last as (TripStop & { id: string }) | null;

  if (progress.total === 0) return null;

  return (
    <div className="mt-4 rounded-control border border-line bg-sunken p-3">
      {next ? (
        <form
          ref={form}
          action={formAction}
          onSubmit={locateThenSubmit}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="stop_id" value={next.id} />
          <input type="hidden" name="lat" value={position.lat} />
          <input type="hidden" name="lon" value={position.lon} />
          <input type="hidden" name="accuracy_m" value={position.accuracy} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="label-micro">{t.trip.nextStop}</p>
              <p className="mt-0.5 text-[13px] text-ink">
                {next.sequence + 1} · {stopTitle(t, next.role, haulKind)} — {stopPlace(next)}
              </p>
            </div>

            <Button type="submit" variant="primary" size="sm" disabled={pending || locating}>
              {locating ? t.trip.locating : pending ? t.trip.marking : t.trip.markDone}
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
              {/*
                * Отметилась ли координата — говорится сразу, пока отметку
                * ещё можно снять и поставить заново. Узнать об этом из
                * чужой карточки через неделю уже бесполезно.
                */}
              {last.completed_at && last.completed_lat == null && (
                <> · <span className="text-warn">{t.trip.noPosition}</span></>
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
