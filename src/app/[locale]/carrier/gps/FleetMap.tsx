'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import 'maplibre-gl/dist/maplibre-gl.css';
import { isMapConfigured, maptilerKey } from '@/lib/env';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Парк на карте: последняя точка каждой машины из GPS перевозчика.
 *
 * Свежая точка (до 15 мин) — тёмно-бирюзовая, старая — серая: машина
 * может стоять с выключенным трекером, и это должно быть видно сразу.
 * Страница сама обновляется раз в минуту, пока открыта.
 */

export type FleetPoint = {
  id: string;
  label: string;
  detail: string;
  lat: number;
  lon: number;
  fresh: boolean;
};

const FRESH = '#0d647f';
const STALE = '#7b8790';
const MAPLIBRE_URL = '/maplibre/maplibre-gl.mjs';

function pin(point: FleetPoint): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'padding:3px 6px',
    'border-radius:4px',
    'font:600 11px/1.2 ui-monospace,monospace',
    'color:#fff',
    `background:${point.fresh ? FRESH : STALE}`,
    'border:1.5px solid rgba(255,255,255,.9)',
    'box-shadow:0 1px 5px rgba(14,22,25,.35)',
    'white-space:nowrap',
    'cursor:pointer',
  ].join(';');
  el.textContent = point.label;
  return el;
}

export function FleetMap({ points, autoRefresh }: { points: FleetPoint[]; autoRefresh: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const mapHelp = useRef(t.mapHelp);
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const drawable = isMapConfigured() && points.length > 0;
  /* Та же картина после обновления — карту не пересоздаём. */
  const key = JSON.stringify(points);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, router]);

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
          (acc, p) => [Math.min(acc[0], p.lon), Math.min(acc[1], p.lat), Math.max(acc[2], p.lon), Math.max(acc[3], p.lat)],
          [180, 90, -180, -90],
        );

        const instance = new maplibre.Map({
          container: container.current,
          style: `https://api.maptiler.com/maps/dataviz/style.json?key=${maptilerKey()}`,
          bounds: box,
          fitBoundsOptions: { padding: 56, maxZoom: 12 },
          attributionControl: { compact: true },
          cooperativeGestures: true,
          locale: {
            'CooperativeGesturesHandler.WindowsHelpText': mapHelp.current.windows,
            'CooperativeGesturesHandler.MacHelpText': mapHelp.current.mac,
            'CooperativeGesturesHandler.MobileHelpText': mapHelp.current.mobile,
          },
        });
        map = instance;
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        instance.on('load', () => {
          if (cancelled) return;
          for (const point of points) {
            new maplibre.Marker({ element: pin(point) })
              .setLngLat([point.lon, point.lat])
              .setPopup(new maplibre.Popup({ offset: 14 }).setText(`${point.label} · ${point.detail}`))
              .addTo(instance);
          }
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawable, key]);

  if (!drawable || failed) return null;

  return (
    <div
      ref={container}
      role="img"
      aria-label={t.gps.mapLabel}
      className="h-[28rem] w-full overflow-hidden rounded-control border border-line bg-sunken"
    />
  );
}
