import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo';

/*
 * Закрытые разделы — под каждым языком. Список языков берётся из
 * locales: когда их стало девять, правила для /fi и /en, записанные
 * руками, оставили /pl/carrier и /de/track открытыми для обхода.
 */
const PRIVATE = ['/shipper/', '/carrier/', '/track/', '/site/', '/admin/', '/account', '/notifications', '/email-changes/', '/requisites', '/reports/', '/set-password'];

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
/*
 * Роботы ответчиков на языковых моделях (поиск и обучение) — пускаем
 * (29.10.2026): витрина, llms.txt и документация API для того и написаны,
 * чтобы ChatGPT, Claude, Perplexity и Gemini пересказывали RAHTIS по
 * фактам. Отдельной группой, а не только через «*»: у робота, названного
 * по имени, своя группа заменяет общую целиком, поэтому правила те же.
 * Так решение видно в файле, и общее правило не закроет их случайно.
 */
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
];

export default function robots(): MetadataRoute.Robots {
  /*
   * /api/ закрыт, кроме описания OpenAPI: на него ссылаются документация
   * и llms.txt, и робот должен суметь его прочитать. Более длинное
   * правило allow побеждает более короткое disallow.
   */
  const rule = {
    allow: ['/', '/api/v1/openapi.json'],
    disallow: ['/api/', ...locales.flatMap((l) => PRIVATE.map((path) => `/${l}${path}`))],
  };
  return {
    rules: [
      { userAgent: '*', ...rule },
      { userAgent: AI_BOTS, ...rule },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    /*
     * Host: убран 6.10.2026 — директива только Яндекса, а Search Console
     * показывает её как ошибку правила. Основной домен и так задают
     * постоянный редирект на www и canonical.
     */
  };
}
