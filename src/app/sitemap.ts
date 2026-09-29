import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * Карта сайта: только то, что имеет смысл открывать из поиска.
 *
 * Публичных страниц у витрины немного, и робот нашёл бы их и по ссылкам.
 * Карта нужна для другого: в ней сразу сказано, что финская и английская
 * страницы — переводы друг друга, а не два разных документа. Без этого
 * поисковик решает сам и иногда решает не в нашу пользу.
 *
 * Условия и политика перечислены по одному адресу на язык, тому же, что
 * стоит у них в canonical. Второй слаг каждой пары отвечает и дальше,
 * но приглашать на него робота незачем.
 *
 * Вход, восстановление пароля и кабинеты сюда не попадают: из поиска
 * туда не приходят, а приходят по ссылке из письма или из шапки.
 */
/*
 * lastmod — дата последней настоящей правки страницы, а не момент запроса.
 * Раньше стояло new Date(): дата менялась при каждом обходе, и поисковик,
 * увидев «правку» без изменений, перестаёт верить lastmod вовсе. Правишь
 * витрину или активируешь редакцию документа — поправь дату здесь.
 */
const PAGES: { fi: string; en: string; priority: number; updated: string }[] = [
  { fi: '', en: '', priority: 1, updated: '2026-09-23' },
  { fi: '/apply', en: '/apply', priority: 0.8, updated: '2026-09-25' },
  { fi: '/kayttoehdot', en: '/terms', priority: 0.3, updated: '2026-09-29' },
  { fi: '/tietosuoja', en: '/privacy', priority: 0.3, updated: '2026-09-29' },
  { fi: '/api-docs', en: '/api-docs', priority: 0.4, updated: '2026-09-29' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((page) =>
    (['fi', 'en'] as const).map((locale) => ({
      url: `${SITE_URL}/${locale}${page[locale]}`,
      lastModified: page.updated,
      changeFrequency: 'monthly' as const,
      priority: page.priority,
      alternates: {
        languages: {
          fi: `${SITE_URL}/fi${page.fi}`,
          en: `${SITE_URL}/en${page.en}`,
          /* Как в разметке страниц: без языка в браузере — английская. */
          'x-default': `${SITE_URL}/en${page.en}`,
        },
      },
    })),
  );
}
