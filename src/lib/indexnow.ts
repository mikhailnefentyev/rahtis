import 'server-only';
import { SITE_URL } from '@/lib/seo';

/**
 * IndexNow (24.11.2026): Bing, Yandex, Seznam и Naver узнают о новых и
 * изменённых страницах сразу, не дожидаясь обхода. До этого Bing не знал
 * ни одной страницы сайта, а от его индекса зависят ChatGPT, Copilot и
 * DuckDuckGo.
 *
 * Ключ — публичный по протоколу: тот же файл лежит в public/<ключ>.txt.
 * Отправляются только адреса из карты сайта, у которых lastmod не старше
 * заданного числа дней: статьи блога, новые страницы, правки витрины.
 */
export const INDEXNOW_KEY = 'da873caabc25cfcd4b99269c9bf4dea9';

/** Адреса из карты сайта с lastmod не раньше `since` (YYYY-MM-DD). Чистая функция — для теста. */
export function recentSitemapUrls(xml: string, since: string): string[] {
  const out = new Set<string>();
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.slice(0, 10);
    if (loc && lastmod && lastmod >= since) out.add(loc);
  }
  return [...out];
}

export async function submitRecent(days: number): Promise<{ urls: number; status: number | null }> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const sitemap = await fetch(`${SITE_URL}/sitemap.xml`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!sitemap.ok) throw new Error(`sitemap: HTTP ${sitemap.status}`);
  const urls = recentSitemapUrls(await sitemap.text(), since).slice(0, 10_000);
  if (!urls.length) return { urls: 0, status: null };
  const host = new URL(SITE_URL).host;
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList: urls }),
    signal: AbortSignal.timeout(20_000),
  });
  return { urls: urls.length, status: response.status };
}
