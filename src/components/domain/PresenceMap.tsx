'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/cn';
import { isMapConfigured, maptilerKey } from '@/lib/env';
import { useI18n } from '@/lib/i18n/provider';
import { presenceParts, presenceTotal } from '@/lib/presence';

/**
 * Карта транспорта: где вообще есть кому везти.
 *
 * Отдельный компонент, а не режим RouteMap. Общего у них только
 * библиотека: там линия рейса и пронумерованные точки в порядке
 * прохождения, здесь — города без порядка и без связи между собой.
 * Слитые в один компонент, они дали бы дюжину необязательных свойств, из
 * которых половина всегда пустая.
 *
 * Точка не говорит, свободна ли машина. «Свободна» живёт часами и
 * требует, чтобы перевозчик её поддерживал; устаревшая свобода хуже её
 * отсутствия, потому что на неё рассчитывают. Парк меняется месяцами и
 * не врёт.
 */

export type PresencePoint = {
  city: string;
  country: string | null;
  lat: number;
  lon: number;
  /** Тягачи: перецепы и контейнеры. */
  tractors: number;
  /** Грузовики: экспресс с кузовом. */
  trucks: number;
  /** Фургоны: экспресс поменьше. */
  vans: number;
};

/*
 * Цвета веток. Синий у единиц — тот же, что у концов рейса на карте
 * маршрута; у экспресса свой, потому что это другая половина витрины, а
 * не разновидность той же.
 *
 * Hex'ами, а не токенами темы: maplibre рисует на канве WebGL и
 * переменные CSS не читает. То же ограничение, что в RouteMap.
 */
const UNIT_COLOR = '#0d647f';
const EXPRESS_COLOR = '#8f5e0c';
const BOTH_COLOR = '#4448cf';

/* Тот же трюк с путём, что в RouteMap: импорт мимо сборщика. */
const MAPLIBRE_URL = '/maplibre/maplibre-gl.mjs';

/**
 * Размер точки растёт от числа машин, но медленно.
 *
 * Линейный размер сделал бы Хельсинки с двадцатью машинами кляксой на
 * пол-Финляндии, а Оулу с одной — невидимой пылинкой. Корень оставляет
 * разницу читаемой и держит крайности в пределах экрана.
 */
function dotSize(total: number): number {
  return Math.round(Math.min(40, 16 + Math.sqrt(total) * 6));
}

function dotElement(point: PresencePoint): HTMLElement {
  const total = presenceTotal(point);
  const size = dotSize(total);

  /* Цвет по ветке: тягачи — единицы, грузовик и фургон — экспресс. */
  const express = point.trucks + point.vans;

  const color =
    point.tractors > 0 && express > 0 ? BOTH_COLOR : express > 0 ? EXPRESS_COLOR : UNIT_COLOR;

  const el = document.createElement('div');
  el.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:999px',
    `font:600 ${size > 26 ? 12 : 11}px/1 ui-monospace,monospace`,
    'color:#ffffff',
    `background:${color}`,
    'border:2px solid rgba(255,255,255,.9)',
    'box-shadow:0 1px 6px rgba(14,22,25,.35)',
  ].join(';');
  el.textContent = String(total);
  return el;
}

export function PresenceMap({
  points,
  className,
}: {
  points: PresencePoint[];
  className?: string;
}) {
  const { t, m } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const drawable = isMapConfigured() && points.length > 0;

  useEffect(() => {
    if (!drawable || !container.current) return;

    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const maplibre = (await import(
          /* turbopackIgnore: true */ /* webpackIgnore: true */
          MAPLIBRE_URL
        )) as unknown as typeof import('maplibre-gl');

        if (cancelled || !container.current) return;

        const box = points.reduce<[number, number, number, number]>(
          (acc, p) => [
            Math.min(acc[0], p.lon),
            Math.min(acc[1], p.lat),
            Math.max(acc[2], p.lon),
            Math.max(acc[3], p.lat),
          ],
          [180, 90, -180, -90],
        );

        const instance = new maplibre.Map({
          container: container.current,
          style: `https://api.maptiler.com/maps/dataviz/style.json?key=${maptilerKey()}`,
          bounds: box,
          /*
           * Потолок приближения ниже, чем у маршрута: единственный город
           * на карте иначе развернулся бы до уровня улиц, а точка стоит
           * не на улице — она стоит на городе.
           */
          fitBoundsOptions: { padding: 48, maxZoom: 8 },
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });

        map = instance;
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

        instance.on('load', () => {
          if (cancelled) return;
          setReady(true);

          for (const point of points) {
            const label = [point.city, ...presenceParts(point, m)].join(' · ');

            new maplibre.Marker({ element: dotElement(point) })
              .setLngLat([point.lon, point.lat])
              .setPopup(new maplibre.Popup({ offset: 14 }).setText(label))
              .addTo(instance);
          }
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      setReady(false);
      map?.remove();
    };
  }, [drawable, points, m]);

  if (!drawable || failed) return null;

  return (
    <div className={cn('relative', className)}>
      <div
        ref={container}
        role="img"
        aria-label={t.presence.mapLabel}
        className="h-72 w-full overflow-hidden rounded-control border border-line bg-sunken"
      />

      {!ready && (
        <div
          aria-hidden
          className="shimmer pointer-events-none absolute inset-0 rounded-control bg-sunken"
        />
      )}
    </div>
  );
}
