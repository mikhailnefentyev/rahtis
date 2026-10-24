import type { Metadata } from 'next';
import { locales, type Locale } from '@/lib/i18n/config';

/**
 * Метаданные страницы: адрес, переводы, картинка превью.
 *
 * Собрано в одном месте, потому что иначе одни и те же семь полей
 * пришлось бы повторить в девяти страницах и разойтись они успели бы
 * раньше, чем закончилась бы правка.
 *
 * До этого модуля в head жили только charset, viewport, одно описание на
 * весь сайт и иконки. Ни canonical, ни hreflang, ни og. Последнее стоило
 * дороже прочего: ссылку на RAHTIS пересылают в WhatsApp — диспетчер
 * перевозчику, перевозчик водителю, — и разворачивалась она голой
 * строкой без имени и картинки.
 */

/**
 * Домен с www: апекс отвечает на него постоянным редиректом, и canonical
 * обязан указывать туда же, куда ведёт редирект, иначе поисковик получит
 * два противоречащих указания.
 */
export const SITE_URL = 'https://www.rahtis.eu';

/** Картинка превью. Одна на оба языка: на ней только марка, без текста. */
const OG_IMAGE = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: 'RAHTIS',
};

/**
 * Адрес страницы на каждом языке.
 *
 * Именно словарём, а не одной строкой: у условий и политики адреса
 * разные по языкам — /fi/kayttoehdot против /en/terms. Оба варианта
 * при этом отвечают в обеих локалях, и без canonical получалось восемь
 * адресов на два документа.
 */
export type LocalePaths = Record<Locale, string>;

/** Один и тот же путь во всех локалях. */
export function samePath(path: string): LocalePaths {
  return Object.fromEntries(locales.map((l) => [l, path])) as LocalePaths;
}

/** Финский адрес у финского, английский — у остальных языков (условия, политика). */
export function fiOrEnPath(fi: string, en: string): LocalePaths {
  return Object.fromEntries(locales.map((l) => [l, l === 'fi' ? fi : en])) as LocalePaths;
}

/* Код Open Graph: язык_СТРАНА. */
const OG_LOCALE: Record<Locale, string> = {
  fi: 'fi_FI', en: 'en_GB', sv: 'sv_SE', et: 'et_EE', lv: 'lv_LV', lt: 'lt_LT', pl: 'pl_PL', de: 'de_DE', ru: 'ru_RU',
};

export function pageMetadata(input: {
  locale: Locale;
  paths: LocalePaths;
  /** Без суффикса «· RAHTIS»: его добавляет шаблон из корневого layout. */
  title?: string;
  description: string;
  /** Страницы входа и заявки поисковику не нужны. */
  noindex?: boolean;
  /** Свой адрес вместо языкового: корень сайта, отданный без редиректа. */
  canonical?: string;
  /** x-default, если не английская версия: у главной это корень сайта. */
  xDefault?: string;
  /**
   * Языки, на которых у страницы свой текст. Условия, политика и
   * документация API есть только по-фински и по-английски: на остальных
   * языках страница показывает английский текст, и её canonical — английская
   * версия, а hreflang называет только настоящие переводы. Иначе поисковик
   * видит семь копий английского документа.
   */
  textLocales?: readonly Locale[];
}): Metadata {
  const { locale, paths, title, description, noindex, canonical, xDefault, textLocales = locales } = input;

  const url = (l: Locale) => `${SITE_URL}/${l}${paths[l]}`;

  const languages = Object.fromEntries(textLocales.map((l) => [l, url(l)]));
  const own = textLocales.includes(locale) ? url(locale) : url('en');

  return {
    ...(title ? { title } : {}),
    description,
    alternates: {
      canonical: canonical ?? own,
      languages: {
        ...languages,
        /*
         * Для читателя, чей язык не наш, — английская версия. Тем же
         * правилом, по которому его встречает proxy.
         */
        'x-default': xDefault ?? url('en'),
      },
    },
    openGraph: {
      type: 'website',
      url: canonical ?? own,
      siteName: 'RAHTIS',
      title,
      description,
      locale: OG_LOCALE[locale],
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [OG_IMAGE.url],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Страницы компании в соцсетях: значки в подвале и sameAs в разметке. */
export const SOCIAL_PROFILES = [
  { name: 'Facebook', url: 'https://www.facebook.com/rahtiseu' },
  { name: 'Reddit', url: 'https://www.reddit.com/user/RAHTIS/' },
] as const;

/**
 * Профили компании для schema.org sameAs: по ним машины сверяют, что
 * RAHTIS и Aivomaa Oy — одно лицо. Запись в торговом реестре и страницы
 * в соцсетях; появится LinkedIn и т. п. — добавить в SOCIAL_PROFILES.
 */
export const ORG_SAME_AS = ['https://tietopalvelu.ytj.fi/yritys/3592993-6', ...SOCIAL_PROFILES.map((p) => p.url)];
