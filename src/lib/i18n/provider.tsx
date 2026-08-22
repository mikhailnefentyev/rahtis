'use client';

import { createContext, useContext, useMemo } from 'react';
import { createI18n, type I18n } from './bundle';
import type { Locale } from './config';
import type { Dictionary } from './dictionaries';

const I18nContext = createContext<I18n | null>(null);

/**
 * Отдаёт язык клиентским компонентам.
 *
 * Серверные компоненты через контекст ничего не запрашивают — они берут
 * тот же набор напрямую из `getI18n(locale)`.
 *
 * Через границу сервер → клиент проходит только словарь: это обычный
 * объект, он сериализуется. Функции `m` и `f` собираются здесь заново,
 * потому что функцию в разметку не положишь.
 *
 * Словарь передаётся целиком. Пока он размером в несколько килобайт, это
 * дешевле, чем дробить его по неймспейсам; когда вырастет — провайдер
 * начнёт принимать срез, а не весь объект. *
 * Сообщения об ошибках здесь по-английски, в отличие от остального
 * src/lib. Правило «в src/lib можно по-русски» держится на том, что этих
 * строк не видит никто, кроме разработчика; для модулей, уезжающих в
 * браузер, оно неверно — код попадает в бандл вместе со строками, и
 * русский текст оказывается на финском и английском сайте.
 */
export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo(() => createI18n(locale, dictionary), [locale, dictionary]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Язык в клиентском компоненте: `const { t, m, f } = useI18n()`. */
export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n called outside I18nProvider — wrap the tree in the locale provider.');
  }
  return value;
}
