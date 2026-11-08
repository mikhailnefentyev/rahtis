import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cleanArticleHtml, getArticle, splitAfterTakeaways, tableOfContents } from '@/lib/blog/heycatch';
import { withCharts } from '@/lib/blog/charts';
import { blogLabels, fixText } from '@/lib/blog/visuals';
import { SITE_URL } from '@/lib/seo';
import { BlogFrame, formatDate } from '../BlogFrame';

export const revalidate = 300;

type Params = { params: Promise<{ locale: string; slug: string }> };

const RTL = ['ar', 'he', 'fa', 'ur'];

const canonical = (slug: string) => `${SITE_URL}/blog/${encodeURIComponent(slug)}`;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(decodeURIComponent(slug));
  if (!article) return {};
  const url = canonical(article.slug);
  const title = fixText(article.title, article.language);
  const description = fixText(article.meta_description, article.language);
  // Своей картинки HeyCatch не присылает — тогда наша: заголовок и машина по теме (api/og/blog).
  const image = article.hero_image_url || article.featured_image || `${SITE_URL}/api/og/blog/${encodeURIComponent(article.slug)}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
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

const OG_LOCALE: Record<string, string> = { fi: 'fi_FI', en: 'en_GB', sv: 'sv_SE', et: 'et_EE', ru: 'ru_RU' };

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
  const { slug } = await params;
  const article = await getArticle(decodeURIComponent(slug));
  if (!article) notFound();

  const language = article.language || 'en';
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

  const url = canonical(article.slug);
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
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-[13px] text-ink-faint">
          <time dateTime={article.published}>{formatDate(article.published, language)}</time> · {article.read_time} {t.min}
        </p>

        {image && /^https:\/\//.test(image) && (
          // eslint-disable-next-line @next/next/no-img-element -- адрес картинки задаёт HeyCatch, домен заранее неизвестен
          <img src={image} alt="" className="mt-6 w-full rounded-lg border border-line" />
        )}

        <div className="blog-article mt-8">
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
      </article>
    </BlogFrame>
  );
}
