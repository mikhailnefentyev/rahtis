/**
 * Отметка на карте: где стоял тот, кто нажал «пройдена».
 *
 * Два разных числа с двумя разными смыслами живут у точки рядом: lat/lon
 * адреса — куда должны были приехать, completed_lat/lon — откуда сказали,
 * что приехали. Всё, что здесь есть, — про расстояние между ними.
 */

export type Position = { lat: number; lon: number; accuracyM: number | null };

/**
 * Отметка глазами читающего карточку.
 *
 * `far` считается не от красивого круглого числа, а от того, что
 * означает спор. Двести метров — это соседний подъезд, промах телефона в
 * плотной застройке и въезд с другой стороны склада; такое расхождение
 * не говорит ни о чём. Километр — это уже другой адрес.
 *
 * Погрешность самого замера при этом учитывается: браузер, сказавший
 * «здесь ±2 км», не обвиняется в промахе на километр — он честно
 * признался, что не знает.
 */
export const FAR_METERS = 1000;

export type Mark =
  | { kind: 'none' }
  | { kind: 'near'; meters: number; accuracyM: number | null }
  | { kind: 'far'; meters: number; accuracyM: number | null }
  | { kind: 'unknown'; accuracyM: number | null };

type Stop = {
  lat?: number | null;
  lon?: number | null;
  completed_at?: string | null;
  completed_lat?: number | null;
  completed_lon?: number | null;
  completed_accuracy_m?: number | null;
};

/** Расстояние по большому кругу, в метрах. */
export function metersBetween(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Что показать о точке.
 *
 * `none` — точка ещё не пройдена либо отметки нет вовсе; различать эти
 * два состояния должен вызывающий, потому что у него есть completed_at,
 * а смысл у них противоположный: «ещё не были» и «были, но не записались».
 */
export function markOf(stop: Stop): Mark {
  const { completed_lat: lat, completed_lon: lon, completed_accuracy_m: accuracy } = stop;
  if (lat == null || lon == null) return { kind: 'none' };

  const accuracyM = accuracy ?? null;

  /* Адреса без координат бывают: набранный руками не геокодируется. */
  if (stop.lat == null || stop.lon == null) return { kind: 'unknown', accuracyM };

  const meters = metersBetween({ lat: stop.lat, lon: stop.lon }, { lat, lon });

  /* Замер честно признался, что не знает, — промахом это не считается. */
  const slack = accuracyM ?? 0;
  const kind = meters - slack > FAR_METERS ? 'far' : 'near';

  return { kind, meters, accuracyM };
}

/**
 * Спросить у браузера, где мы.
 *
 * Отказ, отсутствие датчика и молчание сведены к одному ответу — null.
 * Разбирать причину здесь незачем: отметка не обязательна, и на всё
 * перечисленное реакция одна — отметить без координаты и сказать об этом
 * в карточке.
 *
 * Таймаут короткий намеренно. Курьер стоит у двери с коробкой, и десять
 * секунд ожидания спутников он ждать не станет — он нажмёт ещё раз.
 */
export async function askPosition(timeoutMs = 6000): Promise<Position | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracyM: Number.isFinite(p.coords.accuracy) ? Math.round(p.coords.accuracy) : null,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}
