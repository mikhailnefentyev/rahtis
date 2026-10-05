import { SITE_URL } from '@/lib/seo';

/**
 * Карта сайта: только то, что имеет смысл открывать из поиска.
 *
 * Собрана руками, а не через app/sitemap.ts (6.10.2026): Next ставит
 * ссылки на переводы (xhtml:link) сразу после <loc>, а схема sitemaps.org
 * разрешает чужие теги только в конце <url> — после lastmod, changefreq и
 * priority. Search Console помечал такой файл ошибками.
 *
 * Переводы — xhtml:link по каждому языку и x-default: финская и английская
 * страницы — переводы друг друга, а у главной x-default — корень сайта.
 *
 * lastmod — дата последней настоящей правки страницы, а не момент запроса:
 * правишь витрину или активируешь редакцию документа — поправь дату здесь.
 */
const PAGES: { fi: string; en: string; priority: number; updated: string }[] = [
  { fi: '', en: '', priority: 1, updated: '2026-10-01' },
  { fi: '/apply', en: '/apply', priority: 0.8, updated: '2026-09-25' },
  { fi: '/kayttoehdot', en: '/terms', priority: 0.3, updated: '2026-10-01' },
  { fi: '/tietosuoja', en: '/privacy', priority: 0.3, updated: '2026-10-01' },
  { fi: '/api-docs', en: '/api-docs', priority: 0.4, updated: '2026-09-29' },
];

/* Корень отвечает страницей (x-default главной), а не редиректом. */
const ROOT_UPDATED = '2026-10-01';

type Entry = { loc: string; lastmod: string; priority: number; links: Record<string, string> };

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function entries(): Entry[] {
  const home = { fi: `${SITE_URL}/fi`, en: `${SITE_URL}/en`, 'x-default': `${SITE_URL}/` };
  const list: Entry[] = [{ loc: `${SITE_URL}/`, lastmod: ROOT_UPDATED, priority: 1, links: home }];
  for (const page of PAGES) {
    const links = {
      fi: `${SITE_URL}/fi${page.fi}`,
      en: `${SITE_URL}/en${page.en}`,
      'x-default': page.en === '' ? `${SITE_URL}/` : `${SITE_URL}/en${page.en}`,
    };
    for (const locale of ['fi', 'en'] as const) {
      list.push({ loc: `${SITE_URL}/${locale}${page[locale]}`, lastmod: page.updated, priority: page.priority, links });
    }
  }
  return list;
}

export const dynamic = 'force-static';

export function GET() {
  const urls = entries()
    .map((e) =>
      [
        '  <url>',
        `    <loc>${esc(e.loc)}</loc>`,
        `    <lastmod>${e.lastmod}</lastmod>`,
        '    <changefreq>monthly</changefreq>',
        `    <priority>${e.priority.toFixed(1)}</priority>`,
        ...Object.entries(e.links).map(
          ([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${esc(href)}"/>`,
        ),
        '  </url>',
      ].join('\n'),
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
