import { test } from 'node:test';
import assert from 'node:assert/strict';

/* recentSitemapUrls — копия логики без server-only: модуль сервера тест не загрузит. */
function recentSitemapUrls(xml, since) {
  const out = new Set();
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.slice(0, 10);
    if (loc && lastmod && lastmod >= since) out.add(loc);
  }
  return [...out];
}

test('IndexNow: только адреса с lastmod не раньше даты', () => {
  const xml = `<urlset><url><loc>https://a/x</loc><lastmod>2026-11-24</lastmod></url><url><loc>https://a/y</loc><lastmod>2026-11-01</lastmod></url><url><loc>https://a/z</loc></url><url><loc>https://a/w</loc><lastmod>2026-11-22T10:00:00Z</lastmod></url></urlset>`;
  assert.deepEqual(recentSitemapUrls(xml, '2026-11-21'), ['https://a/x', 'https://a/w']);
});
