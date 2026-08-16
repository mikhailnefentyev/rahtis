'use client';

import { createContext, useContext } from 'react';
import type { Locale } from './config';
import type { Dictionary } from './dictionaries';

type I18nValue = {
  locale: Locale;
  t: Dictionary;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Отдаёт словарь клиентским компонентам.
 *
 * Серверные компоненты словарь не запрашивают через контекст — они получают
 * его напрямую из `getDictionary(locale)`, без обращения к React-контексту.
 *
 * Словарь сериализуется в разметку целиком. Пока он размером в несколько
 * килобайт, это дешевле, чем дробить его по неймспейсам; когда вырастет —
 * провайдер начнёт принимать срез, а не весь объект.
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
  return (
    <I18nContext.Provider value={{ locale, t: dictionary }}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n вызван вне I18nProvider — оберните дерево в провайдер локали.');
  }
  return value;
}

/** Короткий доступ к словарю: `const t = useT()`. */
export function useT(): Dictionary {
  return useI18n().t;
}
