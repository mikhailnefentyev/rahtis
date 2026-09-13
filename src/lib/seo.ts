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

export function pageMetadata(input: {
  locale: Locale;
  paths: LocalePaths;
  /** Без суффикса «· RAHTIS»: его добавляет шаблон из корневого layout. */
  title?: string;
  description: string;
  /** Страницы входа и заявки поисковику не нужны. */
  noindex?: boolean;
}): Metadata {
  const { locale, paths, title, description, noindex } = input;

  const url = (l: Locale) => `${SITE_URL}/${l}${paths[l]}`;

  const languages = Object.fromEntries(locales.map((l) => [l, url(l)]));

  return {
    ...(title ? { title } : {}),
    description,
    alternates: {
      canonical: url(locale),
      languages: {
        ...languages,
        /*
         * Для читателя, чей язык не наш, — английская версия. Тем же
         * правилом, по которому его встречает proxy.
         */
        'x-default': url('en'),
      },
    },
    openGraph: {
      type: 'website',
      url: url(locale),
      siteName: 'RAHTIS',
      title,
      description,
      locale: locale === 'fi' ? 'fi_FI' : 'en_GB',
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
