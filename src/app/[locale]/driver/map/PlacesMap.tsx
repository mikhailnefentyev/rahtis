'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/cn';
import { isMapConfigured, maptilerKey } from '@/lib/env';
import { useI18n } from '@/lib/i18n/provider';

export type PlaceKind = 'FUEL' | 'PARKING' | 'SHOWER' | 'SERVICE';

export type Place = {
  id: string;
  country: string;
  kinds: string[];
  name: string;
  network: string | null;
  address: string | null;
  lat: number;
  lon: number;
  approx: boolean;
  hours: string | null;
  phone: string | null;
  free: boolean;
  secured: boolean;
  sauna: boolean;
  warning: boolean;
  details: Array<{ k: string; text: string }>;
};

const KINDS: PlaceKind[] = ['FUEL', 'PARKING', 'SHOWER', 'SERVICE'];

/*
 * Цвет точки по самому редкому из её видов: стоянок и душевых в разы
 * меньше, чем заправок, и среди синего моря заправок их надо видеть.
 * Hex'ами — maplibre рисует на канве и переменные CSS не читает.
 */
const COLOR: Record<PlaceKind, string> = {
  PARKING: '#4448cf',
  SHOWER: '#0e8a6a',
  SERVICE: '#8f5e0c',
  FUEL: '#0d647f',
};
const PRIORITY: PlaceKind[] = ['PARKING', 'SHOWER', 'SERVICE', 'FUEL'];
const colorOf = (kinds: string[]) => COLOR[PRIORITY.find((k) => kinds.includes(k)) ?? 'FUEL'];

/* Тот же приём, что в RouteMap: библиотека грузится из public мимо сборщика. */
const MAPLIBRE_URL = '/maplibre/maplibre-gl.mjs';

type LngLat = { lat: number; lon: number };

function km(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Навигация — в Google Maps: приложение на Android и iPhone, браузер
 * везде ещё. Точку с приблизительными координатами ищем по названию и
 * адресу: норвежскую площадку карты найдут точнее, чем центр коммуны.
 */
function navigateUrl(place: Place): string {
  const destination = place.approx
    ? encodeURIComponent([place.name, place.address].filter(Boolean).join(', '))
    : `${place.lat},${place.lon}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

type MapHandle = {
  getSource: (id: string) => { setData: (data: unknown) => void } | undefined;
  flyTo: (options: { center: [number, number]; zoom: number }) => void;
  remove: () => void;
};

/**
 * Карта точек для водителя: фильтры, карта, карточка выбранной точки и
 * ближайшие к водителю.
 *
 * Точки — один слой GeoJSON с кластерами: полтысячи маркеров DOM на
 * телефоне тормозили бы, слой на канве — нет.
 */
export function PlacesMap({ places }: { places: Place[] }) {
  const { t, m, f } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [kinds, setKinds] = useState<PlaceKind[]>(KINDS);
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlySecured, setOnlySecured] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [me, setMe] = useState<LngLat | null>(null);
  const [locating, setLocating] = useState(false);

  const visible = useMemo(
    () =>
      places.filter(
        (p) =>
          p.kinds.some((k) => kinds.includes(k as PlaceKind)) &&
          (!onlyFree || p.free) &&
          (!onlySecured || p.secured),
      ),
    [places, kinds, onlyFree, onlySecured],
  );

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: visible.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: { id: p.id, color: colorOf(p.kinds), warning: p.warning ? 1 : 0 },
      })),
    }),
    [visible],
  );

  const selected = places.find((p) => p.id === selectedId) ?? null;
  const nearest = useMemo(
    () =>
      me
        ? visible
            .map((p) => ({ place: p, distance: km(me, p) }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 12)
        : [],
    [me, visible],
  );

  const drawable = isMapConfigured();

  /* Карта создаётся один раз; данные меняются через setData ниже. */
  const initial = useRef(geojson);
  useEffect(() => {
    if (!drawable || !container.current) return;
    let cancelled = false;

    (async () => {
      try {
        const maplibre = (await import(
          /* turbopackIgnore: true */ /* webpackIgnore: true */
          MAPLIBRE_URL
        )) as unknown as typeof import('maplibre-gl');
        if (cancelled || !container.current) return;

        const map = new maplibre.Map({
          container: container.current,
          style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey()}`,
          center: [20, 62],
          zoom: 3.6,
          attributionControl: { compact: true },
        });
        mapRef.current = map as unknown as MapHandle;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

        const geolocate = new maplibre.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
        });
        map.addControl(geolocate, 'top-right');
        geolocate.on('geolocate', (e) => {
          setMe({ lat: e.coords.latitude, lon: e.coords.longitude });
        });

        map.on('load', () => {
          if (cancelled) return;
          map.addSource('places', {
            type: 'geojson',
            data: initial.current as never,
            cluster: true,
            clusterRadius: 36,
            clusterMaxZoom: 9,
          });
          map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'places',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': '#0e1619',
              'circle-opacity': 0.72,
              'circle-radius': ['step', ['get', 'point_count'], 12, 10, 16, 50, 22],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          });
          map.addLayer({
            id: 'points',
            type: 'circle',
            source: 'places',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': ['get', 'color'],
              'circle-radius': 8,
              'circle-stroke-width': ['case', ['==', ['get', 'warning'], 1], 3, 2],
              'circle-stroke-color': ['case', ['==', ['get', 'warning'], 1], '#c2410c', '#ffffff'],
            },
          });

          map.on('click', 'clusters', (e) => {
            const feature = e.features?.[0];
            if (!feature || feature.geometry.type !== 'Point') return;
            const [lon, lat] = feature.geometry.coordinates;
            map.easeTo({ center: [lon, lat], zoom: map.getZoom() + 2 });
          });
          map.on('click', 'points', (e) => {
            const id = e.features?.[0]?.properties?.id;
            if (typeof id === 'string') setSelectedId(id);
          });
          for (const layer of ['clusters', 'points']) {
            map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
            map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
          }
          setReady(true);
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [drawable]);

  /* Фильтры меняют данные слоя, а не пересоздают карту. */
  useEffect(() => {
    if (!ready) return;
    mapRef.current?.getSource('places')?.setData(geojson);
  }, [geojson, ready]);

  const focus = (place: Place) => {
    setSelectedId(place.id);
    mapRef.current?.flyTo({ center: [place.lon, place.lat], zoom: 12 });
  };

  const locate = () => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const toggleKind = (kind: PlaceKind) =>
    setKinds((current) =>
      current.includes(kind)
        ? current.length === 1
          ? current
          : current.filter((k) => k !== kind)
        : [...current, kind],
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((kind) => (
          <Chip key={kind} on={kinds.includes(kind)} color={COLOR[kind]} onClick={() => toggleKind(kind)}>
            {t.places.kind[kind]}
          </Chip>
        ))}
        <Chip on={onlyFree} onClick={() => setOnlyFree((v) => !v)}>
          {t.places.free}
        </Chip>
        <Chip on={onlySecured} onClick={() => setOnlySecured((v) => !v)}>
          {t.places.secured}
        </Chip>
      </div>

      {drawable && !failed ? (
        <div className="relative">
          <div
            ref={container}
            role="application"
            aria-label={t.driverApp.map}
            className="h-[55vh] min-h-72 w-full overflow-hidden rounded-card border border-line bg-sunken"
          />
          {!ready && <div aria-hidden className="shimmer pointer-events-none absolute inset-0 rounded-card bg-sunken" />}
        </div>
      ) : (
        <p className="rounded-card border border-line bg-surface px-4 py-3 text-[15px] text-ink-muted">
          {t.places.noMap}
        </p>
      )}

      <p className="text-[13px] text-ink-muted">{m('places.count', { count: visible.length })}</p>

      {selected && <PlaceCard place={selected} distance={me ? km(me, selected) : null} onClose={() => setSelectedId(null)} />}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold">{t.places.nearest}</h2>
          {!me && (
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="h-11 rounded-control border border-line px-4 text-[15px] font-semibold text-accent"
            >
              {locating ? t.places.locating : t.places.locate}
            </button>
          )}
        </div>
        {me ? (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {nearest.map(({ place, distance }) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => focus(place)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(place.kinds) }} />
                      <span className="truncate text-[16px] font-semibold">{place.name}</span>
                    </span>
                    <span className="block truncate text-[14px] text-ink-muted">
                      {place.kinds.map((k) => t.places.kind[k as PlaceKind]).join(' · ')}
                      {place.free && ` · ${t.places.free}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[15px]">{f.decimal(distance, distance < 10 ? 1 : 0)} km</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-ink-muted">{t.places.locateHint}</p>
        )}
      </section>
    </div>
  );
}

function Chip({
  on,
  color,
  onClick,
  children,
}: {
  on: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'flex h-10 items-center gap-2 rounded-pill border px-3.5 text-[14px] font-semibold',
        on ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-muted',
      )}
    >
      {color && <span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

function PlaceCard({ place, distance, onClose }: { place: Place; distance: number | null; onClose: () => void }) {
  const { t, f } = useI18n();
  const label = (k: string) => (t.places.detail as Record<string, string>)[k] ?? null;

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold leading-snug">{place.name}</h2>
          <p className="text-[14px] text-ink-muted">
            {place.kinds.map((k) => t.places.kind[k as PlaceKind]).join(' · ')}
            {distance != null && ` · ${f.decimal(distance, distance < 10 ? 1 : 0)} km`}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label={t.places.close} className="-mr-2 flex size-11 items-center justify-center text-2xl text-ink-muted">
          ×
        </button>
      </div>

      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {place.free && <Tag tone="ok">{t.places.free}</Tag>}
          {place.secured && <Tag tone="ok">{t.places.secured}</Tag>}
          {place.sauna && <Tag>{t.places.sauna}</Tag>}
          {place.warning && <Tag tone="warn">{t.places.warning}</Tag>}
        </div>
        {place.address && <p className="text-[15px]">{place.address}</p>}
        {place.approx && <p className="text-[13px] text-warn">{t.places.approx}</p>}
        {place.hours && (
          <p className="text-[15px]">
            <span className="text-ink-muted">{t.places.hours}: </span>
            {place.hours}
          </p>
        )}
        {place.details.map((d, i) => (
          <p key={i} className="text-[15px] leading-relaxed">
            {label(d.k) && <span className="text-ink-muted">{label(d.k)}: </span>}
            {d.text}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <a
          href={navigateUrl(place)}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'flex h-12 items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-accent-ink',
            !place.phone && 'col-span-2',
          )}
        >
          {t.places.navigate}
        </a>
        {place.phone && (
          <a
            href={`tel:${place.phone.replace(/\s+/g, '')}`}
            className="flex h-12 items-center justify-center rounded-control border border-line text-[16px] font-semibold"
          >
            {t.places.call}
          </a>
        )}
      </div>
    </article>
  );
}

function Tag({ tone, children }: { tone?: 'ok' | 'warn'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-pill border px-2.5 py-0.5 text-[13px] font-semibold',
        tone === 'ok' && 'border-ok/40 bg-ok/10 text-ok',
        tone === 'warn' && 'border-warn/40 bg-warn/10 text-warn',
        !tone && 'border-line text-ink-muted',
      )}
    >
      {children}
    </span>
  );
}
