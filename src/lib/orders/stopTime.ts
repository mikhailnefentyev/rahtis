import { stopTimeZone } from '@/lib/country';
import { stopZone, type Format } from '@/lib/format';

/**
 * Время точки маршрута — по поясу её страны.
 *
 * Плановое время точки записано местным (scheduled_date, scheduled_time):
 * «погрузка в Гданьске в 08:00» — это 08:00 по Варшаве. Прибытие, окончание
 * работ и оценка прибытия показываются в том же поясе, иначе водитель,
 * приехавший к 08:00 минута в минуту, выглядел бы опоздавшим на час.
 *
 * Где пояс точки расходится с финским, к времени добавляется «UTC+1»:
 * диспетчер в Хельсинки должен видеть, что это не его часы. Точка без
 * страны (адрес набран руками) — по финскому, как было до пакетов стран.
 */

type Country = string | null | undefined;

const withZone = (text: string, zone: string) => (zone ? `${text} ${zone}` : text);

/** «08:12» или «08:12 UTC+1». */
export function stopTime(f: Format, iso: string, country: Country): string {
  const tz = stopTimeZone(country);
  return withZone(f.time(iso, tz), stopZone(iso, tz));
}

/** «21.10.2026 08:12» или с «UTC+1». */
export function stopDateTime(f: Format, iso: string, country: Country): string {
  const tz = stopTimeZone(country);
  return withZone(f.dateTime(iso, tz), stopZone(iso, tz));
}

/**
 * Оценка прибытия: сегодня — только время, иначе дата и время; «сегодня»
 * — по поясу точки. Рейс Коувола → Стокгольм через паром прибывает
 * завтра, и «Arvio 07:30» без даты читалось бы как уже прошедшее утро.
 */
export function stopEta(f: Format, iso: string, country: Country, now: Date = new Date()): string {
  const tz = stopTimeZone(country);
  const text = f.date(iso, tz) === f.date(now, tz) ? f.time(iso, tz) : f.dateTime(iso, tz);
  return withZone(text, stopZone(iso, tz));
}

/**
 * Пометка пояса у планового времени точки. Плановое время уже местное и
 * не пересчитывается — только подписывается. Смещение берётся на дату
 * точки: летом Варшава от Хельсинки тоже на час, но в день перевода часов
 * пометка должна быть той, что в этот день.
 */
export function scheduledZone(date: string, time: string | null | undefined, country: Country): string {
  const tz = stopTimeZone(country);
  return stopZone(`${date}T${(time ?? '12:00').slice(0, 5)}:00Z`, tz);
}
