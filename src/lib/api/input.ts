/**
 * Разбор тела запроса API и сверка адреса с ответом геокодера.
 *
 * Без серверных зависимостей, чтобы правила проверялись тестами
 * (input.test.mjs) отдельно от базы и TomTom.
 */

export type LatLon = { lat: number; lon: number };

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Непустая строка без пробелов по краям, обрезанная до max; иначе undefined. */
export const text = (v: unknown, max = 500): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

/** Значение из списка без учёта регистра, в написании списка. */
export function oneOf<T extends readonly string[]>(v: unknown, list: T): T[number] | undefined {
  return typeof v === 'string' && (list as readonly string[]).includes(v.toUpperCase()) ? (v.toUpperCase() as T[number]) : undefined;
}

/** { lat, lon } в градусах; ноль-ноль — это не место, а пустая форма. */
export function locationOf(v: unknown): LatLon | undefined {
  if (!isObj(v)) return undefined;
  const lat = Number(v.lat);
  const lon = Number(v.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  if (lat === 0 && lon === 0) return undefined;
  return { lat, lon };
}

const norm = (s: string) => s.toLocaleLowerCase('fi').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();

/** Улица с номером дома из запроса; null — номера нет, адрес точно не узнать. */
export function streetOf(address: string): string | null {
  const street = norm(address.split(',')[0]);
  return /\d/.test(street) ? street : null;
}

/*
 * Подсказка годится, если её адрес начинается той же улицей с тем же
 * номером и лежит в указанном городе. Подпись своих мест — «Имя — адрес»,
 * сверяется часть после тире. За номером не может идти цифра: «10» не
 * должен узнать себя в «101».
 */
export function sameAddress(label: string, labelCity: string | null | undefined, street: string, city?: string): boolean {
  const address = norm(label.includes(' — ') ? label.slice(label.indexOf(' — ') + 3) : label);
  if (!address.startsWith(street) || /\d/.test(address.charAt(street.length))) return false;
  return !city || norm(labelCity ?? '') === norm(city);
}
