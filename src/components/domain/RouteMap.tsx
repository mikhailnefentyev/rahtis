'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { isMapConfigured, maptilerKey } from '@/lib/env';
import { decodePolyline } from '@/lib/routing';
import { useI18n } from '@/lib/i18n/provider';
import type { StopRole } from '@/types/db';

/**
 * Карта маршрута.
 *
 * Один компонент на все роли: карточка заказчика, стол и рейсы
 * перевозчика, позже — отслеживание. Различается только то, что в него
 * передали, а не то, как он устроен.
 *
 * Карта — дополнение к списку точек, а не замена: маршрут читается и без
 * неё, в кабине по списку это часто удобнее. Поэтому отсутствие ключа
 * или геометрии просто убирает карту, а не ломает карточку.
 *
 * Библиотека грузится по требованию. maplibre-gl со стилями весит около
 * восьмисот килобайт, и тянуть их в общий бандл ради блока, который на
 * многих карточках даже не раскрывают, незачем.
 */

export type MapStop = {
  id: string;
  sequence: number;
  role: StopRole;
  lat: number | null;
  lon: number | null;
  label: string;
  /**
   * Точка пройдена. Заполнится на Этапе 6, когда водитель начнёт
   * отмечать этапы рейса; сейчас всегда false.
   *
   * Это отметка по данным этапов, а не по координатам машины: живого GPS
   * здесь нет и не предполагается. Когда он появится, он станет ещё одним
   * слоем поверх той же карты, а не заменой этому.
   */
  passed?: boolean;
};

/** Цвета совпадают с глифами точек в списке — одна легенда на два представления. */
const ROLE_COLOR: Record<StopRole, string> = {
  PICKUP: '#54d6c6',
  DELIVERY: '#8e93ff',
  EXTRA_LOAD: '#e0a83e',
  EXTRA_UNLOAD: '#e0a83e',
  CONTINUATION: '#54d6c6',
  TRAILER_RETURN: '#7a8d93',
};

const PASSED_COLOR = '#5bc98f';

/** Маркер собирается разметкой, а не картинкой: номер должен быть текстом. */
function markerElement(index: number, color: string, passed: boolean): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'width:22px',
    'height:22px',
    'border-radius:6px',
    'font:600 11px/1 ui-monospace,monospace',
    'color:#06201e',
    `background:${passed ? PASSED_COLOR : color}`,
    `border:1.5px solid ${passed ? PASSED_COLOR : color}`,
    'box-shadow:0 1px 6px rgba(0,0,0,.6)',
    passed ? 'opacity:.85' : '',
  ].join(';');
  el.textContent = String(index + 1);
  return el;
}

export function RouteMap({
  geometry,
  bounds,
  stops,
  className,
}: {
  /** Линия маршрута закодированной полилинией. */
  geometry: string | null;
  /** [minLon, minLat, maxLon, maxLat]. */
  bounds: number[] | null;
  stops: MapStop[];
  className?: string;
}) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  /*
   * Список пересобирается только при смене точек. Без этого он был бы
   * новым объектом на каждый рендер, эффект перезапускался бы следом, и
   * карта пересоздавалась бы бесконечно.
   */
  const points = useMemo(
    () =>
      stops.filter(
        (s): s is MapStop & { lat: number; lon: number } => s.lat !== null && s.lon !== null,
      ),
    [stops],
  );

  const drawable = isMapConfigured() && (Boolean(geometry) || points.length > 0);

  useEffect(() => {
    if (!drawable || !container.current) return;

    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const maplibre = await import('maplibre-gl');
        if (cancelled || !container.current) return;

        const line = geometry ? decodePolyline(geometry) : [];

        /*
         * Границы из заказа, если они есть: их посчитал роутер по всей
         * линии. Иначе — по точкам, которых может быть всего две.
         */
        const box =
          bounds && bounds.length === 4
            ? (bounds as [number, number, number, number])
            : points.reduce<[number, number, number, number]>(
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
          /* Тёмный фон: интерфейс работает в кабине и ночью. */
          style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${maptilerKey()}`,
          bounds: box,
          fitBoundsOptions: { padding: 36, maxZoom: 13 },
          /* Карта показывает маршрут, а не изучает местность. */
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });

        map = instance;

        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

        instance.on('load', () => {
          if (cancelled) return;

          if (line.length > 1) {
            instance.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: line },
              },
            });

            /* Подложка под линией: тонкая бирюза на тёмной карте теряется. */
            instance.addLayer({
              id: 'route-casing',
              type: 'line',
              source: 'route',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': '#06201e', 'line-width': 7, 'line-opacity': 0.9 },
            });

            instance.addLayer({
              id: 'route-line',
              type: 'line',
              source: 'route',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': '#54d6c6', 'line-width': 3 },
            });
          }

          points.forEach((stop, index) => {
            new maplibre.Marker({
              element: markerElement(index, ROLE_COLOR[stop.role], stop.passed ?? false),
            })
              .setLngLat([stop.lon, stop.lat])
              .setPopup(new maplibre.Popup({ offset: 14 }).setText(stop.label))
              .addTo(instance);
          });
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [geometry, bounds, drawable, points]);

  if (!drawable || failed) return null;

  return (
    <div className={className}>
      <div
        ref={container}
        role="img"
        aria-label={t.routing.mapLabel}
        className="h-64 w-full overflow-hidden rounded-control border border-line bg-sunken"
      />
    </div>
  );
}

/**
 * Карта по точкам заказа.
 *
 * Обёртка над RouteMap для трёх мест, где показывается один и тот же
 * маршрут: карточка заказчика, стол и рейсы перевозчика. Преобразование
 * точки в маркер живёт здесь, а не трижды в вызывающих файлах.
 */
export function OrderRouteMap({
  geometry,
  bounds,
  stops,
  className,
}: {
  geometry: string | null;
  bounds: unknown;
  stops: {
    id: string;
    sequence: number;
    role: StopRole;
    lat: number | null;
    lon: number | null;
    address: string;
    place_name?: string | null;
    company_name?: string | null;
  }[];
  className?: string;
}) {
  const { t } = useI18n();

  const box = Array.isArray(bounds) && bounds.length === 4 ? (bounds as number[]) : null;

  const mapStops = useMemo(
    () =>
      stops.map((s) => ({
        id: s.id,
        sequence: s.sequence,
        role: s.role,
        lat: s.lat,
        lon: s.lon,
        /* В подсказке маркера — роль и место: номер на маркере без этого нем. */
        label: `${t.stopKind[s.role]}: ${s.place_name ?? s.company_name ?? s.address}`,
      })),
    [stops, t],
  );

  return <RouteMap geometry={geometry} bounds={box} stops={mapStops} className={className} />;
}
