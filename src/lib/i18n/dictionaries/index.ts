import type { Locale } from '../config';
import { ru } from './ru';

/**
 * Форма словаря выводится из русского — он эталон.
 *
 * DeepReadonly здесь не нужен: словари объявлены через `as const`,
 * поэтому уже неизменяемы на уровне типов.
 */
export type Dictionary = typeof ru;

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
  // fi: () => import('./fi').then((m) => m.fi),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}
