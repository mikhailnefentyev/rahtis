'use client';

import { useEffect, useState } from 'react';
import { Mono } from '@/components/ui';

/**
 * Карточка рейса на первом экране, идущая по стадиям.
 *
 * Одна карточка, а не четыре: рейс в жизни один, меняется его состояние.
 * Показать четыре карточки рядом значило бы показать четыре разных рейса
 * и потерять главное — что это один и тот же заказ от публикации до
 * выплаты.
 *
 * Клиентский компонент: здесь единственная на всей главной анимация,
 * которой нужен таймер. Все строки приходят готовыми с сервера, чтобы в
 * браузер не уезжал словарь целиком.
 */

export type CycleStage = {
  /** Надпись в бейдже: состояние заказа. */
  status: string;
  /** Строка под карточкой: что в этот момент происходит. */
  note: string;
  /** Цвет бейджа и полосы — тот же язык статусов, что в кабинете. */
  tone: 'idle' | 'warn' | 'live' | 'ok';
  /** Сколько точек маршрута уже пройдено. */
  done: number;
  /** Ждём ответа другой стороны — карточка дышит. */
  waiting: boolean;
};

export type CycleStop = { kind: string; place: string; sub: string; at: string };

export type CycleTrip = {
  title: string;
  ref: string;
  plate: string;
  stops: CycleStop[];
  distance: string;
  stopsCount: string;
  lane: string;
};

const PERIOD_MS = 2800;

export function TripCycle({
  trip,
  stages,
  stageLabel,
}: {
  trip: CycleTrip;
  stages: CycleStage[];
  /** Подпись переключателя: «Vaihe 2 / 4». Готовые строки, по одной на стадию. */
  stageLabel: string[];
}) {
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    /*
     * Просили покоя — карточка стоит на первой стадии. Первый кадр здесь
     * осмысленный: опубликованный заказ, с которого всё начинается.
     */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (held) return;

    const id = setInterval(() => setIndex((i) => (i + 1) % stages.length), PERIOD_MS);
    return () => clearInterval(id);
  }, [held, stages.length]);

  const stage = stages[index] ?? stages[0]!;

  return (
    <div>
      <div
        className="trip-preview"
        data-tone={stage.tone}
        data-waiting={stage.waiting ? '' : undefined}
      >
        <div className="trip-preview__top">
          <span className="trip-preview__title">{trip.title}</span>
          <span className="trip-preview__badge">{stage.status}</span>
        </div>

        <div className="trip-preview__ids">
          <Mono className="trip-preview__ref">{trip.ref}</Mono>
          <Mono className="trip-preview__plate">{trip.plate}</Mono>
        </div>

        <ul className="trip-preview__route">
          {trip.stops.map((stop, n) => (
            <li key={stop.place} data-done={n < stage.done ? '' : undefined}>
              <span className="trip-preview__pin" aria-hidden="true" />
              <span>
                <span className="trip-preview__stop">
                  {stop.kind} · {stop.place}
                </span>
                <span className="trip-preview__sub">{stop.sub}</span>
              </span>
              <Mono className="trip-preview__time">{stop.at}</Mono>
            </li>
          ))}
        </ul>

        <div className="trip-preview__foot">
          <Mono>{trip.distance}</Mono>
          <Mono>{trip.stopsCount}</Mono>
          <Mono>{trip.lane}</Mono>
        </div>
      </div>

      {/*
        * Точки — не украшение: по ним видно, что стадий четыре и какая
        * идёт сейчас. Нажатие останавливает прокрутку: раз человек выбрал
        * стадию сам, уезжать из-под него через две секунды нельзя.
        */}
      <p className="trip-cycle__note">
        <span className="trip-cycle__ticks">
          {stages.map((s, n) => (
            <button
              key={s.status}
              type="button"
              className="trip-cycle__tick"
              data-on={n === index ? '' : undefined}
              aria-label={stageLabel[n]}
              aria-current={n === index}
              onClick={() => {
                setIndex(n);
                setHeld(true);
              }}
            />
          ))}
        </span>
        <span className="trip-cycle__label">{stage.note}</span>
      </p>
    </div>
  );
}
