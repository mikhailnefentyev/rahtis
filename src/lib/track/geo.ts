/**
 * Геометрия страницы отслеживания: расстояния, коридор маршрута, грубая
 * оценка прибытия.
 *
 * Без зависимостей и без 'server-only': модуль читают тесты (node --test).
 * Порядок полей всюду { lat, lon }, как в src/lib/routing/types.ts.
 */

export type Point = { lat: number; lon: number };

const EARTH_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Расстояние по большому кругу, метры. */
export function haversineM(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Расстояние от точки до отрезка, метры. Плоская проекция вокруг точки —
 * на отрезках в десятки километров ошибка в метрах, для «рядом с дорогой
 * или нет» этого хватает.
 */
export function segmentDistanceM(p: Point, a: Point, b: Point): number {
  const k = Math.cos(rad(p.lat));
  const ax = (a.lon - p.lon) * k;
  const ay = a.lat - p.lat;
  const bx = (b.lon - p.lon) * k;
  const by = b.lat - p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.sqrt(x * x + y * y) * rad(1) * EARTH_M;
}

/** Финляндия с запасом: Digitraffic о чужих дорогах всё равно не знает. */
export function inFinland(p: Point): boolean {
  return p.lat >= 59.6 && p.lat <= 70.2 && p.lon >= 19.0 && p.lon <= 31.7;
}

/**
 * Коридор оставшегося пути: точки не реже чем через step метров, не
 * дальше limit метров от начала. Дальний конец рейса через сутки клиенту
 * не интересен, а широкий прямоугольник запроса тянет за собой полстраны
 * дорожных работ.
 */
export function corridor(path: Point[], stepM = 2_000, limitM = 200_000): Point[] {
  if (path.length === 0) return [];
  const out: Point[] = [path[0]];
  let travelled = 0;
  let sinceLast = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const d = haversineM(a, b);
    /* Длинный прямой отрезок (план без геометрии) — дробим. */
    const parts = Math.max(1, Math.ceil(d / stepM));
    for (let j = 1; j <= parts; j++) {
      const f = j / parts;
      const p = { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
      sinceLast += d / parts;
      travelled += d / parts;
      /* Дробленый отрезок — каждая доля (она уже не длиннее шага); частые вершины — через шаг. */
      if (parts > 1 || sinceLast >= stepM || (i === path.length - 1 && j === parts)) {
        out.push(p);
        sinceLast = 0;
      }
      if (travelled >= limitM) return out;
    }
  }
  return out;
}

/** Индекс точки пути, ближайшей к заданной. */
export function nearestIndex(path: Point[], p: Point): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = haversineM(path[i], p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Ближе ли хоть одна вершина линии чем maxM к коридору (по отрезкам коридора). */
export function nearCorridor(line: Point[], route: Point[], maxM: number): boolean {
  if (route.length === 0) return false;
  for (const p of line) {
    if (route.length === 1) {
      if (haversineM(p, route[0]) <= maxM) return true;
      continue;
    }
    for (let i = 1; i < route.length; i++) {
      if (segmentDistanceM(p, route[i - 1], route[i]) <= maxM) return true;
    }
  }
  return false;
}

/** Расстояние от линии (по её отрезкам) до любой точки коридора. */
export function lineNearPoints(line: Point[], points: Point[], maxM: number): boolean {
  if (line.length === 1) return points.some((p) => haversineM(p, line[0]) <= maxM);
  for (let i = 1; i < line.length; i++) {
    for (const p of points) {
      if (segmentDistanceM(p, line[i - 1], line[i]) <= maxM) return true;
    }
  }
  return false;
}

/** [minLon, minLat, maxLon, maxLat] с запасом в градусах. */
export function bbox(points: Point[], marginDeg = 0.05): [number, number, number, number] {
  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  return [minLon - marginDeg, minLat - marginDeg, maxLon + marginDeg, maxLat + marginDeg];
}

/**
 * Позиция машины годится для оценки, пока ей не больше 20 минут: дальше
 * грузовик уже в 25+ км от точки, и «прибудет в 14:05» становится догадкой.
 */
export const GPS_FRESH_MS = 20 * 60_000;

export function isFresh(positionAt: string | null | undefined, now: number, maxMs = GPS_FRESH_MS): boolean {
  if (!positionAt) return false;
  const t = Date.parse(positionAt);
  return Number.isFinite(t) && now - t <= maxMs && t - now <= 5 * 60_000;
}

/**
 * Грубая оценка без роутера: прямая × 1,3 (извилистость дорог Финляндии
 * для грузовика) при средних 70 км/ч. Показывается с пометкой «arvio».
 */
export const ROAD_FACTOR = 1.3;
export const TRUCK_AVG_KMH = 70;

export function straightLineSeconds(from: Point, to: Point): number {
  const km = (haversineM(from, to) * ROAD_FACTOR) / 1000;
  return Math.round((km / TRUCK_AVG_KMH) * 3600);
}

/* ── Fintraffic Digitraffic (tie.digitraffic.fi) ─────────────────────

   Разбор ответов здесь же, а не в отдельном модуле: тесты (node --test)
   импортируют один файл без резолва путей. Сеть — в roads.ts.

   Тексты сообщений Fintraffic — финские. Клиенту не на финском
   показывается переведённый тип, номер дороги и муниципалитет; полное
   финское описание — только в финском интерфейсе. */

export type RoadMessageKind = 'INCIDENT' | 'ROAD_WORK';

export type RoadMessage = {
  id: string;
  kind: RoadMessageKind;
  /** Номер дороги, если известен. */
  road: number | null;
  roadName: string | null;
  municipality: string | null;
  /** Финский заголовок Fintraffic: «Tie 4, eli Lahdenväylä, Vantaa. Tietyö.» */
  titleFi: string;
  /** Финские признаки: «Ajokaista suljettu liikenteeltä». */
  featuresFi: string[];
  /** Ограничение скорости, км/ч, если объявлено. */
  speedLimit: number | null;
  /** Полностью закрыта ли дорога. */
  closed: boolean;
  until: string | null;
};

export type RoadWeatherSeverity = 'POOR' | 'EXTREMELY_POOR';

export type RoadWeather = {
  /** «Vt 1: Helsinki - Kehä III» — название участка у Fintraffic. */
  section: string;
  severity: RoadWeatherSeverity;
  /** DRY, WET, SLUSH, FROST, PARTLY_ICY, ICE, SNOW, … */
  condition: string | null;
  at: string;
};

type Geometry = { type?: string; coordinates?: unknown } | null | undefined;

/** Все вершины геометрии GeoJSON как точки (Point, LineString, Multi*). */
export function geometryPoints(geometry: Geometry): Point[] {
  const out: Point[] = [];
  const walk = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      out.push({ lon: node[0], lat: node[1] });
      return;
    }
    for (const child of node) walk(child);
  };
  walk(geometry?.coordinates);
  return out;
}

/** Каждая n-я вершина и последняя: работы на трассе описаны тысячами точек. */
function thin(points: Point[], max: number): Point[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out = points.filter((_, i) => i % step === 0);
  out.push(points[points.length - 1]);
  return out;
}

type Feature = { name?: string; quantity?: number; unit?: string };
type Announcement = {
  language?: string;
  title?: string;
  features?: Feature[];
  timeAndDuration?: { startTime?: string | null; endTime?: string | null };
  locationDetails?: {
    roadAddressLocation?: {
      primaryPoint?: { municipality?: string; roadName?: string; roadAddress?: { road?: number } };
    };
  };
};
type MessageFeature = {
  geometry?: Geometry;
  properties?: {
    situationId?: string;
    situationType?: string;
    trafficAnnouncementType?: string | null;
    announcements?: Announcement[];
  };
};

const ENDED = /ended|retracted|päättynyt|peruttu/i;

/**
 * Сообщения рядом с коридором, действующие сейчас или начинающиеся в
 * ближайшие сутки. Сначала происшествия, потом работы, в порядке пути.
 */
export function pickMessages(
  features: MessageFeature[],
  route: Point[],
  now: number,
  maxM = 1_500,
): RoadMessage[] {
  const out: (RoadMessage & { order: number })[] = [];
  const seen = new Set<string>();

  for (const f of features) {
    const p = f.properties;
    const id = p?.situationId;
    if (!p || !id || seen.has(id)) continue;
    const type = String(p.situationType ?? '').toLowerCase().replace(/_/g, ' ');
    const kind: RoadMessageKind | null =
      type === 'road work' ? 'ROAD_WORK' : type === 'traffic announcement' ? 'INCIDENT' : null;
    if (!kind) continue;
    if (ENDED.test(String(p.trafficAnnouncementType ?? ''))) continue;

    const a = p.announcements?.find((x) => String(x.language ?? '').toLowerCase() === 'fi') ?? p.announcements?.[0];
    if (!a) continue;

    const start = a.timeAndDuration?.startTime ? Date.parse(a.timeAndDuration.startTime) : NaN;
    const end = a.timeAndDuration?.endTime ? Date.parse(a.timeAndDuration.endTime) : NaN;
    if (Number.isFinite(end) && end < now) continue;
    if (Number.isFinite(start) && start > now + 24 * 3_600_000) continue;

    const line = thin(geometryPoints(f.geometry), 400);
    if (line.length === 0 || !nearCorridor(line, route, maxM)) continue;

    /* Порядок по пути: индекс первой точки коридора рядом с сообщением. */
    let order = route.length;
    for (let i = 0; i < route.length; i++) {
      if (lineNearPoints(line, [route[i]], maxM)) {
        order = i;
        break;
      }
    }

    const names = (a.features ?? []).map((x) => String(x.name ?? '').trim()).filter(Boolean);
    const limit = (a.features ?? []).find((x) => /nopeusrajoitus/i.test(String(x.name ?? '')) && typeof x.quantity === 'number');
    const where = a.locationDetails?.roadAddressLocation?.primaryPoint;

    seen.add(id);
    out.push({
      id,
      kind,
      road: typeof where?.roadAddress?.road === 'number' ? where.roadAddress.road : null,
      roadName: where?.roadName ?? null,
      municipality: where?.municipality ?? null,
      titleFi: String(a.title ?? '').trim().replace(/\s*\.\s*$/, ''),
      featuresFi: names.filter((n) => !/nopeusrajoitus/i.test(n)).slice(0, 3),
      speedLimit: limit ? Number(limit.quantity) : null,
      closed: names.some((n) => /tie on suljettu/i.test(n)),
      until: Number.isFinite(end) ? new Date(end).toISOString() : null,
      order,
    });
  }

  return out
    .sort((x, y) => (x.kind === y.kind ? x.order - y.order : x.kind === 'INCIDENT' ? -1 : 1))
    .map(({ order, ...m }) => (void order, m));
}

type SectionFeature = { id?: string; geometry?: Geometry; properties?: { id?: string; description?: string } };
type SectionForecast = {
  id?: string;
  forecasts?: { time?: string; type?: string; overallRoadCondition?: string; roadCondition?: string }[];
};

/**
 * Предупреждения о плохом ajokeli на участках у коридора: наблюдение и
 * прогноз до horizon. Худшее по каждому участку, сначала самые тяжёлые.
 */
export function pickWeather(
  sections: SectionFeature[],
  forecasts: SectionForecast[],
  route: Point[],
  now: number,
  horizonMs = 6 * 3_600_000,
  maxM = 2_000,
): RoadWeather[] {
  const near = new Map<string, string>();
  for (const s of sections) {
    const id = s.id ?? s.properties?.id;
    if (!id) continue;
    const line = geometryPoints(s.geometry);
    if (line.length > 0 && lineNearPoints(line, route, maxM)) near.set(id, s.properties?.description ?? id);
  }

  const out: RoadWeather[] = [];
  for (const f of forecasts) {
    const section = f.id ? near.get(f.id) : undefined;
    if (!section) continue;
    let worst: RoadWeather | null = null;
    for (const x of f.forecasts ?? []) {
      const at = x.time ? Date.parse(x.time) : NaN;
      if (!Number.isFinite(at) || at > now + horizonMs || at < now - 2 * 3_600_000) continue;
      const severity: RoadWeatherSeverity | null =
        x.overallRoadCondition === 'EXTREMELY_POOR_CONDITION' ? 'EXTREMELY_POOR' : x.overallRoadCondition === 'POOR_CONDITION' ? 'POOR' : null;
      if (!severity) continue;
      if (!worst || (severity === 'EXTREMELY_POOR' && worst.severity === 'POOR')) {
        worst = { section, severity, condition: x.roadCondition && x.roadCondition !== 'NOT_KNOWN' ? x.roadCondition : null, at: new Date(at).toISOString() };
      }
    }
    if (worst) out.push(worst);
  }

  return out.sort((a, b) => (a.severity === b.severity ? a.at.localeCompare(b.at) : a.severity === 'EXTREMELY_POOR' ? -1 : 1));
}
