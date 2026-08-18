/**
 * Кодирование полилинии (алгоритм Google, точность 5).
 *
 * Нужно затем, что TomTom отдаёт геометрию массивом координат: маршрут
 * Hanko → Kotka это 4092 точки, около 160 КБ в JSON. Та же линия строкой
 * занимает примерно 20 КБ, а едет она в браузер на каждый показ карточки
 * заказа.
 *
 * Формат стандартный, декодировать умеют все картографические библиотеки,
 * но своя реализация в двадцать строк дешевле зависимости.
 */

function encodeSigned(value: number, out: string[]): void {
  let v = value < 0 ? ~(value << 1) : value << 1;
  while (v >= 0x20) {
    out.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63));
    v >>= 5;
  }
  out.push(String.fromCharCode(v + 63));
}

export function encodePolyline(points: { lat: number; lon: number }[]): string {
  const out: string[] = [];
  let prevLat = 0;
  let prevLon = 0;

  for (const p of points) {
    /* Округление до целых стотысячных — иначе разности накопят дрейф. */
    const lat = Math.round(p.lat * 1e5);
    const lon = Math.round(p.lon * 1e5);
    encodeSigned(lat - prevLat, out);
    encodeSigned(lon - prevLon, out);
    prevLat = lat;
    prevLon = lon;
  }

  return out.join('');
}

export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;

    /* Порядок GeoJSON: долгота, потом широта. Карта ждёт именно такой. */
    points.push([lon / 1e5, lat / 1e5]);
  }

  return points;
}

/** [minLon, minLat, maxLon, maxLat] по набору точек. */
export function boundsOf(
  points: { lat: number; lon: number }[],
): [number, number, number, number] {
  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }

  return [minLon, minLat, maxLon, maxLat];
}
