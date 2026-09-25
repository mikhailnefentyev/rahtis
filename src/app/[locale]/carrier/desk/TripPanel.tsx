'use client';

import { startTransition, useActionState, useState } from 'react';
import { Button, Input, Textarea } from '@/components/ui';
import { etaTime, showsEta, stopPlace, tripProgress, type TripStop } from '@/lib/orders/progress';
import { stopTitle, type HaulKind } from '@/lib/orders/haul';
import { askPosition } from '@/lib/orders/position';
import {
  completeStopAction,
  setStopEtaAction,
  uncompleteStopAction,
  type TripState,
} from '@/lib/orders/trip';
import { isoToOperationsLocal } from '@/lib/dates';
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
   * ПОЧЕМУ ЗДЕСЬ НЕТ СКРЫТЫХ ПОЛЕЙ И ПОВТОРНОЙ ОТПРАВКИ. Сначала было
   * так: submit останавливался, координата ложилась в состояние, поля
   * заполнялись, форма отправлялась заново. Оно не работало ни разу.
   * setState только назначает перерисовку, а requestSubmit вызывается в
   * том же такте — до того, как React успеет положить новые значения в
   * разметку. Форма уходила со старыми, то есть пустыми, и каждая
   * отметка ложилась без координаты. Снаружи это неотличимо от отказа
   * браузера: точка помечена пройденной, места у неё нет, жаловаться
   * некому.
   *
   * Теперь состав отправки собирается руками и уезжает прямо в
   * действие. Ни гонки, ни второго круга: значения кладутся в FormData,
   * а не в разметку, и между «замерили» и «отправили» ничего не стоит.
   */
  const [locating, setLocating] = useState(false);

  async function locateThenSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    /* Состав снимается до ожидания: после await у события нет цели. */
    const payload = new FormData(event.currentTarget);

    setLocating(true);
    const where = await askPosition();
    setLocating(false);

    /*
     * Отказ браузера отметку не отменяет. Точка помечается пройденной
     * без координаты, и это видно в карточке у всех трёх сторон —
     * запрет здесь заставил бы курьера звонить оператору, а оператор
     * закрыл бы точку руками, то есть доказательства не прибавилось бы.
     */
    if (where) {
      payload.set('lat', String(where.lat));
      payload.set('lon', String(where.lon));
      if (where.accuracyM !== null) payload.set('accuracy_m', String(where.accuracyM));
    }

    startTransition(() => formAction(payload));
  }

  const progress = tripProgress(stops);
  const next = progress.next as (TripStop & { id: string }) | null;
  const last = progress.last as (TripStop & { id: string }) | null;

  if (progress.total === 0) return null;

  return (
    <div className="mt-4 rounded-control border border-line bg-sunken p-3">
      {next ? (
        <form onSubmit={locateThenSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="stop_id" value={next.id} />

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

      {/* Отдельной формой: вложенная форма в HTML не существует. */}
      {next && !next.arrived_at && <EtaEditor stop={next} />}

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

/**
 * Оценка прибытия на следующую точку — посмотреть и поправить.
 *
 * Считает её платформа: после отметки точки — по маршруту, затем с
 * пробками. Поле ввода здесь для того, чего карта не знает: паром ушёл без
 * машины, водитель встал на обязательный отдых. Слово перевозчика после
 * этого пересчётом не перетирается.
 *
 * Поле скрыто, пока его не открыли: обычно оценка верна, и лишнее поле
 * в панели отметки только отвлекало бы от главной кнопки.
 */
function EtaEditor({ stop }: { stop: TripStop & { id: string } }) {
  const { t, f, locale } = useI18n();
  const [state, formAction, pending] = useActionState(setStopEtaAction, initial);
  const [open, setOpen] = useState(false);

  const current = showsEta(stop) ? stop : null;

  return (
    <div className="mt-3 border-t border-line pt-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">
          {t.trip.eta}:{' '}
          {current ? (
            <>
              <span className="text-ink">{etaTime(f, current.eta_at)}</span>
              <span className="text-ink-faint"> · {t.trip.etaSource[current.eta_source ?? 'ROUTE']}</span>
            </>
          ) : (
            '—'
          )}
        </span>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs text-ink-faint underline underline-offset-2 hover:text-ink-muted"
          >
            {t.trip.etaChange}
          </button>
        )}
      </div>

      {open && (
        <form
          action={(payload) => {
            formAction(payload);
            setOpen(false);
          }}
          className="mt-2 flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="stop_id" value={stop.id} />
          <Input
            type="datetime-local"
            name="eta"
            required
            aria-label={t.trip.eta}
            defaultValue={current ? isoToOperationsLocal(current.eta_at) : ''}
            className="w-auto"
          />
          <Button type="submit" size="sm" variant="primary" disabled={pending}>
            {t.trip.etaSave}
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            {t.trip.etaCancel}
          </Button>
        </form>
      )}

      {state.error && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}
