import { locales, type Locale } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo';
import { listArticles } from '@/lib/blog/heycatch';
import { blogPath, languagesOf } from '@/lib/blog/translations';

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
 * В Chrome карта выглядит одной строкой: из-за xhtml:link браузер рисует
 * файл как страницу, а не как дерево XML. Это не ошибка — поисковики
 * читают XML. Оформление через XSLT пробовали (21.10.2026) и убрали:
 * Chrome отказывается от XSLT и выводит над такой страницей предупреждение.
 *
 * lastmod — дата последней настоящей правки страницы, а не момент запроса:
 * правишь витрину или активируешь редакцию документа — поправь дату здесь.
 */
/*
 * docs — страница с текстом только по-фински и по-английски (условия,
 * политика, API): в карте только эти два языка, как и в её hreflang.
 */
const PAGES: { fi: string; en: string; priority: number; updated: string; docs?: true }[] = [
  { fi: '', en: '', priority: 1, updated: '2026-11-07' },
  { fi: '/apply', en: '/apply', priority: 0.8, updated: '2026-10-21' },
  { fi: '/maansiirto', en: '/earthworks', priority: 0.8, updated: '2026-11-11' },
  /* Посадочные для экспедиторов и для смены прицепов в портах (11.11.2026). */
  { fi: '/huolitsijoille', en: '/forwarders', priority: 0.8, updated: '2026-11-11' },
  { fi: '/peravaunun-vaihto', en: '/trailer-swap', priority: 0.8, updated: '2026-11-11' },
  { fi: '/kayttoehdot', en: '/terms', priority: 0.3, updated: '2026-10-01', docs: true },
  { fi: '/tietosuoja', en: '/privacy', priority: 0.3, updated: '2026-10-08', docs: true },
  { fi: '/api-docs', en: '/api-docs', priority: 0.4, updated: '2026-09-29', docs: true },
  /* Правила площадки — на всех языках (6.11.2026). */
  { fi: '/rules', en: '/rules', priority: 0.4, updated: '2026-11-06' },
];

/* Корень отвечает страницей (x-default главной), а не редиректом. */
const ROOT_UPDATED = '2026-11-07';

type Entry = { loc: string; lastmod: string; priority: number; links: Record<string, string> };

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function entries(): Entry[] {
  const home = { ...Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}`])), 'x-default': `${SITE_URL}/` };
  const list: Entry[] = [{ loc: `${SITE_URL}/`, lastmod: ROOT_UPDATED, priority: 1, links: home }];
  for (const page of PAGES) {
    /* Финский адрес у финского, английский — у остальных языков (как fiOrEnPath). */
    const path = (l: Locale) => (l === 'fi' ? page.fi : page.en);
    const langs = page.docs ? (['fi', 'en'] as const) : locales;
    const links = {
      ...Object.fromEntries(langs.map((l) => [l, `${SITE_URL}/${l}${path(l)}`])),
      'x-default': page.en === '' ? `${SITE_URL}/` : `${SITE_URL}/en${page.en}`,
    };
    for (const locale of langs) {
      list.push({ loc: `${SITE_URL}/${locale}${path(locale)}`, lastmod: page.updated, priority: page.priority, links });
    }
  }
  return list;
}

/*
 * Блог (статьи HeyCatch): у каждого языка свой — /blog (финский), /en/blog,
 * /de/blog… (08.11.2026). Статья попадает в карту на тех языках, на которых
 * она есть (оригинал или перевод), со ссылками hreflang друг на друга;
 * lastmod — updated статьи. Карта пересобирается раз в 5 минут, как и
 * сам блог, чтобы новая статья попала в неё без выкладки.
 */
async function blogEntries(): Promise<Entry[]> {
  const articles = await listArticles();
  const newest = articles.map((a) => a.updated || a.published).sort().at(-1) ?? ROOT_UPDATED;
  const indexLinks: Record<string, string> = Object.fromEntries([
    ...locales.map((l) => [l, `${SITE_URL}${blogPath(l)}`]),
    ['x-default', `${SITE_URL}/blog`],
  ]);
  const list: Entry[] = locales.map((l) => ({
    loc: `${SITE_URL}${blogPath(l)}`,
    lastmod: newest.slice(0, 10),
    priority: 0.6,
    links: indexLinks,
  }));
  for (const a of articles) {
    const langs = await languagesOf(a);
    const main = langs.includes('fi') ? 'fi' : langs[0];
    const links: Record<string, string> = Object.fromEntries([
      ...langs.map((l) => [l, `${SITE_URL}${blogPath(l, a.slug)}`]),
      ...(main ? [['x-default', `${SITE_URL}${blogPath(main, a.slug)}`]] : []),
    ]);
    for (const l of langs) {
      list.push({ loc: `${SITE_URL}${blogPath(l, a.slug)}`, lastmod: (a.updated || a.published).slice(0, 10), priority: 0.5, links });
    }
  }
  return list;
}

export const revalidate = 300;

export async function GET() {
  const urls = [...entries(), ...(await blogEntries())]
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
