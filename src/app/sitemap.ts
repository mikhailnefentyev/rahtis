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
const PAGES: { fi: string; en: string; priority: number }[] = [
  { fi: '', en: '', priority: 1 },
  { fi: '/apply', en: '/apply', priority: 0.8 },
  { fi: '/kayttoehdot', en: '/terms', priority: 0.3 },
  { fi: '/tilausehdot', en: '/customer-terms', priority: 0.3 },
  { fi: '/tietosuoja', en: '/privacy', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return PAGES.flatMap((page) =>
    (['fi', 'en'] as const).map((locale) => ({
      url: `${SITE_URL}/${locale}${page[locale]}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: page.priority,
      alternates: {
        languages: {
          fi: `${SITE_URL}/fi${page.fi}`,
          en: `${SITE_URL}/en${page.en}`,
        },
      },
    })),
  );
}
