'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/cn';
import { isMapConfigured, maptilerKey } from '@/lib/env';
import { decodePolyline } from '@/lib/routing';
import { stopTitle, type HaulKind } from '@/lib/orders/haul';
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
 */

export type MapStop = {
  id: string;
  sequence: number;
  role: StopRole;
  lat: number | null;
  lon: number | null;
  label: string;
  /**
   * Точка пройдена — красится зелёным.
   *
   * Это отметка по данным этапов (order_stops.completed_at), а не по
   * координатам машины: живого GPS здесь нет и не предполагается. Когда
   * он появится, он станет ещё одним слоем поверх той же карты, а не
   * заменой этому.
   */
  passed?: boolean;
};

/*
 * Цвета совпадают с глифами точек в списке — одна легенда на два
 * представления. Значения продублированы hex'ами, а не токенами темы:
 * maplibre рисует на канве WebGL и переменные CSS не читает.
 *
 * Концы рейса одного цвета: перецеп это «забрали прицеп → поработали с
 * грузом → отцепили», и форма рейса должна читаться по карте так же, как
 * по списку.
 */
const ROLE_COLOR: Record<StopRole, string> = {
  PICKUP: '#0d647f',
  TRAILER_RETURN: '#0d647f',
  EXTRA_LOAD: '#8f5e0c',
  EXTRA_UNLOAD: '#8f5e0c',
  DELIVERY: '#4448cf',
  CONTINUATION: '#0d647f',
};

const PASSED_COLOR = '#1a7a48';

/** Текст номера на маркере — белый: все цвета ролей тёмные. */
const MARKER_INK = '#ffffff';

/*
 * Путь к библиотеке вынесен в переменную намеренно: с ним импорт
 * перестаёт быть статически разрешимым и для сборщика, и для TypeScript.
 * Первому это не даёт затащить maplibre в чанки, второй не пытается найти
 * файл по URL — настоящие типы возвращает приведение ниже.
 */
const MAPLIBRE_URL = '/maplibre/maplibre-gl.mjs';

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
    `color:${MARKER_INK}`,
    `background:${passed ? PASSED_COLOR : color}`,
    `border:1.5px solid ${passed ? PASSED_COLOR : color}`,
    'box-shadow:0 1px 4px rgba(14,22,25,.35)',
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
   * Пока тайлы не пришли, на месте карты пустой прямоугольник. Мерцание
   * говорит «грузится», а не «сломалось».
   */
  const [ready, setReady] = useState(false);

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
        /*
         * maplibre грузится отдельным файлом, мимо сборщика.
         *
         * Он поставляется самодостаточным набором из трёх модулей —
         * главный, общий и воркер, — связанных относительными импортами
         * и путём, который воркер вычисляет через import.meta.url.
         * Сборщик режет набор по чанкам с хешированными именами, и связи
         * рвутся: воркер либо не находит общий модуль (404), либо
         * поднимает СВОЙ экземпляр, пока главный поток работает с
         * бандловым, — протокол между двумя экземплярами не сходится.
         *
         * Ломается молча и обманчиво: карта создаётся, стиль и спрайты
         * грузятся, контроллы и атрибуция на месте — а холст пустой. Ни
         * одного запроса тайла, события load и idle не наступают, в
         * консоли чисто. Единственный внешний признак — источники
         * навсегда остаются isSourceLoaded === false.
         *
         * Здесь все три файла лежат рядом в public/maplibre/ (их кладёт
         * scripts/sync-maplibre.mjs), и maplibre сам находит соседей —
         * ровно так, как рассчитывали его авторы. Заодно из клиентского
         * бандла уходит около 950 КБ.
         */
        const maplibre = (await import(
          /* turbopackIgnore: true */ /* webpackIgnore: true */
          MAPLIBRE_URL
        )) as unknown as typeof import('maplibre-gl');

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
          /* Светлый фон в тон интерфейсу: карта не должна быть тёмным окном. */
          style: `https://api.maptiler.com/maps/dataviz/style.json?key=${maptilerKey()}`,
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
          setReady(true);

          if (line.length > 1) {
            instance.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: line },
              },
            });

            /* Белая подложка: тонкая линия теряется среди дорог карты. */
            instance.addLayer({
              id: 'route-casing',
              type: 'line',
              source: 'route',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.95 },
            });

            instance.addLayer({
              id: 'route-line',
              type: 'line',
              source: 'route',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': '#0d647f', 'line-width': 3.5 },
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
      setReady(false);
      map?.remove();
    };
  }, [geometry, bounds, drawable, points]);

  if (!drawable || failed) return null;

  return (
    <div className={cn('relative', className)}>
      <div
        ref={container}
        role="img"
        aria-label={t.routing.mapLabel}
        className="h-64 w-full overflow-hidden rounded-control border border-line bg-sunken"
      />

      {/* Заглушка поверх, а не вместо: контейнер нужен карте с самого начала. */}
      {!ready && (
        <div
          aria-hidden
          className="shimmer pointer-events-none absolute inset-0 rounded-control bg-sunken"
        />
      )}
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
  haulKind = 'TRAILER',
  className,
}: {
  geometry: string | null;
  bounds: unknown;
  /* Подпись метки называет единицу: у контейнера прицепа в рейсе нет. */
  haulKind?: HaulKind;
  stops: {
    id: string;
    sequence: number;
    role: StopRole;
    lat: number | null;
    lon: number | null;
    address: string;
    place_name?: string | null;
    company_name?: string | null;
    /* Пройденные точки красятся иначе — отметка по данным этапов. */
    completed_at?: string | null;
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
        passed: Boolean(s.completed_at),
        /* В подсказке маркера — роль и место: номер на маркере без этого нем. */
        label: `${stopTitle(t, s.role as StopRole, haulKind)}: ${s.place_name ?? s.company_name ?? s.address}`,
      })),
    [stops, t, haulKind],
  );

  return <RouteMap geometry={geometry} bounds={box} stops={mapStops} className={className} />;
}
