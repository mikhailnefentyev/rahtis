import 'server-only';
import { locales, type Locale } from '@/lib/i18n/config';
import type { Article, ArticleSummary } from './heycatch';

/**
 * Переводы статей блога (08.11.2026).
 *
 * HeyCatch пишет статьи на одном языке (в основном финском), а у сайта их
 * девять. У каждого языка свой блог: /blog — финский, /en/blog, /de/blog
 * и т. д. Переводы лежат в content/blog-i18n/<язык>/<slug>.html и
 * собираются в src/lib/blog/i18n/<язык>.json (scripts/blog-i18n-build.mjs).
 *
 * Статья есть на языке, если она на нём написана или для неё есть перевод.
 * Файл на языке оригинала — исправленная редакция (09.11.2026: в статьях
 * HeyCatch были ошибки — графы CMR, номера законов, сроки хранения): он
 * заменяет текст HeyCatch, пока статью не перепишут там.
 * Новая статья HeyCatch без перевода видна только на своём языке, пока
 * перевод не добавят.
 */

type Translation = { title: string; description: string; updated: string; html: string };
type Table = Record<string, Translation>;

const LOADERS: Record<Locale, () => Promise<{ default: Table }>> = {
  fi: () => import('./i18n/fi.json'),
  en: () => import('./i18n/en.json'),
  sv: () => import('./i18n/sv.json'),
  et: () => import('./i18n/et.json'),
  lv: () => import('./i18n/lv.json'),
  lt: () => import('./i18n/lt.json'),
  pl: () => import('./i18n/pl.json'),
  de: () => import('./i18n/de.json'),
  ru: () => import('./i18n/ru.json'),
};

async function table(locale: Locale): Promise<Table> {
  return (await LOADERS[locale]()).default;
}

export const isBlogLocale = (value: string | undefined): value is Locale => (locales as readonly string[]).includes(value ?? '');

export { blogPath } from './paths';

/** Статьи списка, которые есть на языке, с заголовком на нём. */
export async function articlesIn(locale: Locale, articles: ArticleSummary[]): Promise<ArticleSummary[]> {
  const own = await table(locale);
  return articles.flatMap((a) => {
    const t = own[a.slug];
    if (t) return [{ ...a, title: t.title, meta_description: t.description, language: locale }];
    return (a.language || 'en') === locale ? [a] : [];
  });
}

/** Статья на языке: своя или переведённая; null — на этом языке её нет. */
export async function articleIn(locale: Locale, article: Article): Promise<Article | null> {
  const t = (await table(locale))[article.slug];
  if (!t) return (article.language || 'en') === locale ? article : null;
  return { ...article, title: t.title, meta_description: t.description, content_html: t.html, language: locale, jsonLd: null };
}

/** На каких языках есть статья: язык → адрес. Для hreflang и карты сайта. */
export async function languagesOf(article: { slug: string; language: string }): Promise<Locale[]> {
  const found: Locale[] = [];
  for (const locale of locales) {
    if ((article.language || 'en') === locale || (await table(locale))[article.slug]) found.push(locale);
  }
  return found;
}
