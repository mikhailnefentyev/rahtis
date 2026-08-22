import type { Locale } from '../config';
import { ru } from './ru';

/**
 * Форма словаря выводится из русского — он эталон.
 *
 * Строки при этом расширяются до `string`. Без расширения `as const`
 * сделал бы каждое значение литеральным типом, и финское «Suomi» не
 * подошло бы к типу «Русский» — второй язык стал бы невозможен.
 *
 * Структура сохраняется: пропущенный или лишний ключ по-прежнему ошибка
 * компиляции, а это и есть главный предохранитель перевода.
 */
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof ru>;

/**
 * Реестр словарей.
 *
 * `Record<Locale, ...>` — тот самый предохранитель: добавили локаль в
 * `locales`, но забыли словарь — сборка упадёт здесь, а не у пользователя.
 *
 * Словари грузятся динамически, чтобы в бандл страницы попадал только
 * нужный язык. Пока язык один, выигрыша нет — структура готова к моменту,
 * когда языков станет несколько.
 */
const loaders: Record<Locale, () => Promise<Dictionary>> = {
  ru: async () => ru,
  fi: () => import('./fi').then((m) => m.fi),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}
