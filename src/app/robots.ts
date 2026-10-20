import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo';

/*
 * Закрытые разделы — под каждым языком. Список языков берётся из
 * locales: когда их стало девять, правила для /fi и /en, записанные
 * руками, оставили /pl/carrier и /de/track открытыми для обхода.
 */
const PRIVATE = ['/shipper/', '/carrier/', '/track/', '/admin/', '/account', '/notifications', '/requisites', '/reports/', '/set-password'];

/**
 * Что можно обходить, а что нет.
 *
 * Файла не было вовсе — по адресу /robots.txt отвечала 404. Само по себе
 * это не запрещает обход, но и не говорит поисковику ничего: ни где
 * карта сайта, ни что кабинеты обходить незачем.
 *
 * Кабинеты закрыты не ради тайны — их и так закрывает RLS и проверка
 * сессии, робот увидит там только страницу входа. Закрыты они, чтобы
 * робот не тратил обход на десяток адресов, каждый из которых ответит
 * одним и тем же редиректом.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', ...locales.flatMap((l) => PRIVATE.map((path) => `/${l}${path}`))],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    /*
     * Host: убран 6.10.2026 — директива только Яндекса, а Search Console
     * показывает её как ошибку правила. Основной домен и так задают
     * постоянный редирект на www и canonical.
     */
  };
}
