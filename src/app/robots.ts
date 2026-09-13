import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

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
      disallow: [
        '/api/',
        '/fi/shipper/',
        '/en/shipper/',
        '/fi/carrier/',
        '/en/carrier/',
        '/fi/admin/',
        '/en/admin/',
        '/fi/account',
        '/en/account',
        '/fi/notifications',
        '/en/notifications',
        '/fi/requisites',
        '/en/requisites',
        '/fi/reports/',
        '/en/reports/',
        '/fi/set-password',
        '/en/set-password',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
