import type { Locale } from '../config';
import { fi } from './fi';

/**
 * Форма словаря выводится из финского — он эталон.
 *
 * Строки при этом расширяются до `string`. Без расширения `as const`
 * сделал бы каждое значение литеральным типом, и английское «English» не
 * подошло бы к типу «Suomi» — второй язык стал бы невозможен.
 *
 * Структура сохраняется: у следующего словаря пропущенный или лишний
 * ключ будет ошибкой компиляции, а это и есть главный предохранитель
 * перевода.
 */
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof fi>;

/**
 * Реестр словарей.
 *
 * `Record<Locale, ...>` — тот самый предохранитель: добавили локаль в
 * `locales`, но забыли словарь — сборка упадёт здесь, а не у пользователя.
 *
 * Эталонный словарь берётся напрямую, остальные будут грузиться
 * динамически, чтобы в бандл страницы попадал только нужный язык.
 */
const loaders: Record<Locale, () => Promise<Dictionary>> = {
  fi: async () => fi,
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}
