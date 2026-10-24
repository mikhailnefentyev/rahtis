import 'server-only';
import sanitizeHtml from 'sanitize-html';

/**
 * Статьи блога из HeyCatch (24.10.2026, по https://heycatch.ai/blog-agents.md).
 *
 * Статьи пишет HeyCatch; сайт только читает их API и рисует в своём
 * оформлении — ни базы, ни редактора. Ключ публикуемый (только чтение
 * опубликованных статей), передаётся параметром ?key=, как требует API:
 * по нему CDN кэширует ответ.
 *
 * Кэш — 5 минут: новая статья появляется сама, без выкладки. Любая ошибка
 * или таймаут не роняет страницу и сборку: список пуст, статья — 404.
 */

const API = 'https://api.heycatch.ai/v1';
const REVALIDATE = 300;

export type ArticleSummary = {
  slug: string;
  title: string;
  meta_description: string;
  published: string;
  updated: string;
  read_time: number;
  language: string;
  featured_image: string;
  hero_image_url: string;
};

export type Article = ArticleSummary & {
  content_html: string;
  jsonLd: Record<string, unknown> | null;
};

function key(): string | null {
  return process.env.HEYCATCH_API_KEY?.trim() || null;
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<{ status: number; data: T | null }> {
  const k = key();
  if (!k) return { status: 0, data: null };
  const query = new URLSearchParams({ ...params, key: k });
  try {
    const response = await fetch(`${API}${path}?${query}`, {
      next: { revalidate: REVALIDATE, tags: ['blog'] },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { status: response.status, data: null };
    return { status: response.status, data: (await response.json()) as T };
  } catch {
    return { status: 0, data: null };
  }
}

/** Все статьи, новые первыми: страницами по 50, пока не наберётся total. */
export async function listArticles(): Promise<ArticleSummary[]> {
  const all: ArticleSummary[] = [];
  for (let offset = 0; offset < 2000; offset += 50) {
    const { data } = await get<{ articles: ArticleSummary[]; total: number }>('/articles', {
      limit: '50',
      offset: String(offset),
    });
    if (!data) break;
    all.push(...data.articles);
    if (all.length >= data.total || data.articles.length === 0) break;
  }
  return all;
}

/** Есть ли хоть одна статья — от этого зависит ссылка «Блог» в меню. */
export async function hasArticles(): Promise<boolean> {
  const { data } = await get<{ total: number }>('/articles', { limit: '1' });
  return (data?.total ?? 0) > 0;
}

/** Одна статья; null — нет такой (или API недоступен). */
export async function getArticle(slug: string): Promise<Article | null> {
  const { data } = await get<{ article: Article }>(`/articles/${encodeURIComponent(slug)}`);
  return data?.article ?? null;
}

/**
 * Чистка HTML статьи: заголовки, абзацы, списки, таблицы, ссылки,
 * цитаты, выделение, код. id остаётся только у h2/h3 — на них ведёт
 * оглавление. Скрипты, стили, iframe, on*-атрибуты и javascript: — прочь.
 */
export function cleanArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'blockquote', 'strong', 'em', 'b', 'i', 'code', 'pre', 'br', 'hr'],
    allowedAttributes: { h2: ['id'], h3: ['id'], a: ['href', 'title'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => {
        const external = /^https?:\/\//.test(attribs.href ?? '') && !attribs.href!.startsWith('https://www.rahtis.eu');
        return { tagName, attribs: external ? { ...attribs, rel: 'noopener', target: '_blank' } : attribs };
      },
    },
  });
}

/** Оглавление: h2 с id, кроме FAQ, — в том порядке, как в статье. */
export function tableOfContents(html: string): { id: string; text: string }[] {
  const items: { id: string; text: string }[] = [];
  for (const match of html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)) {
    if (match[1] === 'faq') continue;
    items.push({ id: match[1], text: decode(match[2].replace(/<[^>]+>/g, '')) });
  }
  return items;
}

/** Разрезать статью после списка «Key takeaways»: туда встаёт оглавление. */
export function splitAfterTakeaways(html: string): [string, string] {
  const start = html.search(/<h2>\s*Key takeaways\s*<\/h2>/i);
  if (start < 0) return ['', html];
  const listEnd = html.slice(start).search(/<\/(ul|ol)>/i);
  if (listEnd < 0) return ['', html];
  const cut = start + listEnd + html.slice(start + listEnd).indexOf('>') + 1;
  return [html.slice(0, cut), html.slice(cut)];
}

function decode(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
