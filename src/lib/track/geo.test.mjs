/*
 * Геометрия и разбор Digitraffic для страницы отслеживания. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  corridor,
  haversineM,
  inFinland,
  isFresh,
  pickMessages,
  pickWeather,
  segmentDistanceM,
  straightLineSeconds,
} from './geo.ts';

const HELSINKI = { lat: 60.1699, lon: 24.9384 };
const TAMPERE = { lat: 61.4978, lon: 23.761 };

test('расстояние Хельсинки — Тампере около 160 км', () => {
  const km = haversineM(HELSINKI, TAMPERE) / 1000;
  assert.ok(km > 155 && km < 165, String(km));
});

test('расстояние до отрезка: точка на отрезке и в стороне', () => {
  const a = { lat: 60, lon: 24 };
  const b = { lat: 60, lon: 25 };
  assert.ok(segmentDistanceM({ lat: 60, lon: 24.5 }, a, b) < 1);
  const off = segmentDistanceM({ lat: 60.01, lon: 24.5 }, a, b);
  assert.ok(off > 1_000 && off < 1_200, String(off));
});

test('грубая оценка: прямая × 1,3 при 70 км/ч', () => {
  const s = straightLineSeconds(HELSINKI, TAMPERE);
  assert.ok(s > 2.8 * 3600 && s < 3.1 * 3600, String(s));
});

test('свежесть точки GPS', () => {
  const now = Date.parse('2026-11-03T12:00:00Z');
  assert.equal(isFresh('2026-11-03T11:50:00Z', now), true);
  assert.equal(isFresh('2026-11-03T11:30:00Z', now), false);
  assert.equal(isFresh(null, now), false);
  assert.equal(isFresh('2026-11-03T13:00:00Z', now), false);
});

test('коридор: шаг и предел длины', () => {
  const c = corridor([HELSINKI, TAMPERE], 10_000, 50_000);
  assert.ok(c.length >= 6 && c.length <= 8, String(c.length));
  /* Предел — «не дальше шага за границей». */
  assert.ok(haversineM(HELSINKI, c.at(-1)) <= 60_000);
  assert.equal(corridor([]).length, 0);
});

test('Финляндия: Таллин и Стокгольм — нет', () => {
  assert.equal(inFinland(HELSINKI), true);
  assert.equal(inFinland({ lat: 59.437, lon: 24.7536 }), false);
  assert.equal(inFinland({ lat: 59.3293, lon: 18.0686 }), false);
});

const now = Date.parse('2026-11-03T12:00:00Z');
const route = corridor([HELSINKI, TAMPERE], 2_000);

const feature = (id, type, coords, extra = {}) => ({
  geometry: { type: 'LineString', coordinates: coords },
  properties: {
    situationId: id,
    situationType: type,
    trafficAnnouncementType: extra.announcementType ?? null,
    announcements: [
      {
        language: 'fi',
        title: 'Tie 3, Hämeenlinnanväylä. Tietyö. ',
        features: extra.features ?? [{ name: 'Ajokaista suljettu liikenteeltä' }, { name: 'Nopeusrajoitus', quantity: 60, unit: 'km/h' }],
        timeAndDuration: { startTime: '2026-11-01T00:00:00Z', endTime: extra.end ?? '2026-11-30T00:00:00Z' },
        locationDetails: { roadAddressLocation: { primaryPoint: { municipality: 'Vantaa', roadName: 'Hämeenlinnanväylä', roadAddress: { road: 3 } } } },
      },
    ],
  },
});

test('сообщения: рядом с путём, действующие, происшествия первыми', () => {
  const mid = route[Math.floor(route.length / 2)];
  const onRoute = [[mid.lon, mid.lat], [mid.lon + 0.001, mid.lat + 0.001]];
  const far = [[27.5, 62.9], [27.51, 62.91]];
  const picked = pickMessages(
    [
      feature('A', 'road work', onRoute),
      feature('B', 'road work', far),
      feature('C', 'road work', onRoute, { end: '2026-11-02T00:00:00Z' }),
      feature('D', 'traffic announcement', onRoute, { features: [{ name: 'Tie on suljettu liikenteeltä' }] }),
      feature('E', 'traffic announcement', onRoute, { announcementType: 'ended' }),
      feature('F', 'ROAD_WORK', onRoute),
    ],
    route,
    now,
  );
  assert.deepEqual(picked.map((m) => m.id), ['D', 'A', 'F']);
  assert.equal(picked[0].closed, true);
  assert.equal(picked[1].speedLimit, 60);
  assert.equal(picked[1].road, 3);
  assert.deepEqual(picked[1].featuresFi, ['Ajokaista suljettu liikenteeltä']);
});

test('погода: только плохой ajokeli у пути, худший по участку', () => {
  const sections = [
    { id: 'S1', geometry: { type: 'LineString', coordinates: [[24.9, 60.3, 0], [24.5, 60.6, 0]] }, properties: { description: 'Vt 3: Kehä III - Hyvinkää' } },
    { id: 'S2', geometry: { type: 'LineString', coordinates: [[27.5, 62.9, 0], [27.6, 63.0, 0]] }, properties: { description: 'Kuopio' } },
  ];
  const forecasts = [
    {
      id: 'S1',
      forecasts: [
        { time: '2026-11-03T12:00:00Z', overallRoadCondition: 'NORMAL_CONDITION', roadCondition: 'DRY' },
        { time: '2026-11-03T14:00:00Z', overallRoadCondition: 'POOR_CONDITION', roadCondition: 'FROST' },
        { time: '2026-11-03T16:00:00Z', overallRoadCondition: 'EXTREMELY_POOR_CONDITION', roadCondition: 'ICE' },
        { time: '2026-11-04T07:00:00Z', overallRoadCondition: 'EXTREMELY_POOR_CONDITION', roadCondition: 'SNOW' },
      ],
    },
    { id: 'S2', forecasts: [{ time: '2026-11-03T12:00:00Z', overallRoadCondition: 'POOR_CONDITION', roadCondition: 'ICE' }] },
  ];
  const w = pickWeather(sections, forecasts, route, now);
  assert.equal(w.length, 1);
  assert.equal(w[0].severity, 'EXTREMELY_POOR');
  assert.equal(w[0].condition, 'ICE');
  assert.equal(w[0].section, 'Vt 3: Kehä III - Hyvinkää');
});
