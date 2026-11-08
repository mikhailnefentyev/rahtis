import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { buttonClass } from '@/components/ui';
import { cleanArticleHtml, getArticle, splitAfterTakeaways, tableOfContents } from '@/lib/blog/heycatch';
import { withCharts } from '@/lib/blog/charts';
import { blogLabels, fixText } from '@/lib/blog/visuals';
import { articleIn, blogPath, isBlogLocale, languagesOf } from '@/lib/blog/translations';
import type { Locale } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo';
import { BlogFrame, formatDate } from '../BlogFrame';

export const revalidate = 300;

type Params = { params: Promise<{ locale: string; slug: string }> };

const RTL = ['ar', 'he', 'fa', 'ur'];

const canonical = (locale: string, slug: string) => `${SITE_URL}${blogPath(locale, slug)}`;

/**
 * Статья на языке страницы. Нет её на этом языке — null (страница уводит
 * на язык оригинала).
 */
async function load(locale: string, slug: string) {
  if (!isBlogLocale(locale)) return { original: null, article: null };
  const original = await getArticle(decodeURIComponent(slug));
  return { original, article: original ? await articleIn(locale, original) : null };
}

/** hreflang статьи: языки, на которых она есть; x-default — финская (или исходная). */
async function alternates(original: { slug: string; language: string }) {
  const langs = await languagesOf(original);
  const entries: [string, string][] = langs.map((l) => [l, canonical(l, original.slug)]);
  const main = langs.includes('fi') ? 'fi' : (original.language as Locale);
  entries.push(['x-default', canonical(main, original.slug)]);
  return Object.fromEntries(entries);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const { original, article } = await load(locale, slug);
  if (!original || !article) return {};
  const url = canonical(locale, article.slug);
  const title = fixText(article.title, article.language);
  const description = fixText(article.meta_description, article.language);
  // Своей картинки HeyCatch не присылает — тогда наша: заголовок и машина по теме (api/og/blog).
  const image = article.hero_image_url || article.featured_image || `${SITE_URL}/api/og/blog/${encodeURIComponent(article.slug)}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages: await alternates(original) },
    openGraph: {
      type: 'article',
      url,
      siteName: 'RAHTIS',
      locale: OG_LOCALE[article.language] ?? 'fi_FI',
      title,
      description,
      publishedTime: article.published,
      modifiedTime: article.updated,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

const OG_LOCALE: Record<string, string> = {
  fi: 'fi_FI',
  en: 'en_GB',
  sv: 'sv_SE',
  et: 'et_EE',
  lv: 'lv_LV',
  lt: 'lt_LT',
  pl: 'pl_PL',
  de: 'de_DE',
  ru: 'ru_RU',
};

/* Вопросы раздела FAQ (h2 id="faq"): h3 — вопрос, текст до следующего h3 — ответ. Для разметки FAQPage. */
function faqOf(html: string): { q: string; a: string }[] {
  const start = html.search(/<h2 id="faq"/);
  if (start < 0) return [];
  const part = html.slice(start).split(/<\/h2>/)[1]?.split(/<h2[\s>]/)[0] ?? '';
  const plain = (x: string) =>
    x
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  return [...part.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/g)].map((m) => ({ q: plain(m[1]), a: plain(m[2]) })).filter((x) => x.q && x.a);
}

/**
 * /blog/{slug} — статья HeyCatch: заголовок, дата и время чтения, затем
 * content_html как есть (Key takeaways → текст → FAQ). Оглавление —
 * сразу после списка Key takeaways. HTML чистится перед вставкой.
 */
export default async function BlogArticle({ params }: Params) {
  const { locale, slug } = await params;
  const { original, article } = await load(locale, slug);
  if (!original) notFound();
  if (!article) {
    // На этом языке статьи нет — на язык оригинала.
    if (isBlogLocale(original.language)) permanentRedirect(blogPath(original.language, original.slug));
    notFound();
  }

  const language = locale;
  const t = blogLabels(language);
  const html = fixText(cleanArticleHtml(article.content_html ?? '', language), language);
  const toc = tableOfContents(html);
  const [rawTakeaways, rest] = splitAfterTakeaways(html);
  // HeyCatch пишет заголовки «Key takeaways» и «FAQ» по-английски и в финских статьях.
  const takeaways = rawTakeaways.replace(/<h2>\s*Key takeaways\s*<\/h2>/i, `<h2>${t.takeaways}</h2>`);
  const body = withCharts(rest, t.chart).replace(/(<h2 id="faq">)\s*(?:FAQ|Frequently asked questions)\s*(<\/h2>)/i, `$1${t.faq}$2`);
  const image = article.hero_image_url || article.featured_image;
  const title = fixText(article.title, language);
  const faq = faqOf(html);

  const url = canonical(locale, article.slug);
  // Разметка HeyCatch, дополненная (08.11.2026): автор и издатель — RAHTIS с логотипом, картинка, язык, FAQ.
  const base = article.jsonLd && typeof article.jsonLd === 'object' ? article.jsonLd : {};
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      ...base,
      headline: title,
      url,
      mainEntityOfPage: url,
      inLanguage: language,
      image: image && /^https:\/\//.test(image) ? image : `${SITE_URL}/api/og/blog/${encodeURIComponent(article.slug)}`,
      author: { '@type': 'Organization', name: 'RAHTIS', url: SITE_URL },
      publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'RAHTIS', logo: { '@type': 'ImageObject', url: `${SITE_URL}/mark.png` } },
      datePublished: article.published,
      dateModified: article.updated,
    },
    ...(faq.length > 0
      ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }]
      : []),
  ];

  return (
    <BlogFrame lang={language}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article lang={language} dir={RTL.includes(language) ? 'rtl' : undefined}>
        <header className="border-b border-line bg-surface">
          <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-14">
            <Link href={blogPath(locale)} className="label-micro hover:underline" data-accent>
              ← {t.all}
            </Link>
            <h1 className="mt-3 text-[clamp(28px,3.6vw,40px)] leading-[1.1] font-semibold tracking-tight text-balance">{title}</h1>
            <p className="mt-3 text-[14px] text-ink-faint">
              <time dateTime={article.published}>{formatDate(article.published, language)}</time> · {article.read_time} {t.min}
            </p>
          </div>
        </header>

        <div className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-5 sm:py-12">
          <div className="rounded-card border border-line bg-surface px-4 py-6 shadow-card sm:p-10">
            {image && /^https:\/\//.test(image) && (
              // eslint-disable-next-line @next/next/no-img-element -- адрес картинки задаёт HeyCatch, домен заранее неизвестен
              <img src={image} alt="" className="mb-8 w-full rounded-lg border border-line" />
            )}
            <div className="blog-article">
              {takeaways && <div dangerouslySetInnerHTML={{ __html: takeaways }} />}
              {toc.length > 0 && (
                <nav aria-labelledby="toc" className="blog-toc">
                  <h2 id="toc">{t.toc}</h2>
                  <ol>
                    {toc.map((item) => (
                      <li key={item.id}>
                        <a href={`#${item.id}`}>{item.text}</a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              <div dangerouslySetInnerHTML={{ __html: body }} />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-5 shadow-card sm:mt-8 sm:p-6">
            <Link href={blogPath(locale)} className="text-[14px] font-medium text-ink-muted hover:text-ink">
              ← {t.all}
            </Link>
            <Link href={`/${locale}/apply`} className={buttonClass({ variant: 'primary' })}>
              {t.join}
            </Link>
          </div>
        </div>
      </article>
    </BlogFrame>
  );
}
