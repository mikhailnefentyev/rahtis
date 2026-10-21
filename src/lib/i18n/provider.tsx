'use client';

import { createContext, useContext, useMemo } from 'react';
import { createI18n, type I18n } from './bundle';
import type { Locale } from './config';
import type { Dictionary } from './dictionaries';

const I18nContext = createContext<I18n | null>(null);
const ZoneContext = createContext<string | null>(null);
const CountryContext = createContext<string | null>(null);

/**
 * Часовой пояс компании зрителя для клиентских компонентов кабинета.
 *
 * Отдельно от I18nProvider: тот стоит в корневой раскладке, где
 * компании ещё не знают, и узнавать её там значило бы проверять вход на
 * каждой публичной странице. Пояс ставят раскладки кабинетов — они и так
 * знают зрителя.
 */
export function TimeZoneProvider({
  zone,
  country = null,
  children,
}: {
  zone: string;
  /** Страна компании зрителя — для примеров в формах и значений по умолчанию. */
  country?: string | null;
  children: React.ReactNode;
}) {
  return (
    <ZoneContext.Provider value={zone}>
      <CountryContext.Provider value={country}>{children}</CountryContext.Provider>
    </ZoneContext.Provider>
  );
}

/** Страна компании зрителя в кабинете; вне кабинета — null. */
export function useCompanyCountry(): string | null {
  return useContext(CountryContext);
}

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
  const zone = useContext(ZoneContext);
  if (!value) {
    throw new Error('useI18n called outside I18nProvider — wrap the tree in the locale provider.');
  }
  /* В кабинете — с поясом компании зрителя; форматтеры кешируются внутри createFormat. */
  return useMemo(
    () => (zone && zone !== value.f.zone ? createI18n(value.locale, value.t, zone) : value),
    [value, zone],
  );
}
