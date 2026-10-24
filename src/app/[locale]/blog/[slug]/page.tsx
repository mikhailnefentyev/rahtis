import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cleanArticleHtml, getArticle, splitAfterTakeaways, tableOfContents } from '@/lib/blog/heycatch';
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
  const image = article.hero_image_url || article.featured_image || '/og.png';
  return {
    title: { absolute: article.title },
    description: article.meta_description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      siteName: 'RAHTIS',
      title: article.title,
      description: article.meta_description,
      publishedTime: article.published,
      modifiedTime: article.updated,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: article.title, description: article.meta_description, images: [image] },
  };
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

  const html = cleanArticleHtml(article.content_html ?? '');
  const toc = tableOfContents(html);
  const [takeaways, body] = splitAfterTakeaways(html);
  const image = article.hero_image_url || article.featured_image;

  const url = canonical(article.slug);
  const jsonLd =
    article.jsonLd && typeof article.jsonLd === 'object' && Object.keys(article.jsonLd).length > 0
      ? { ...article.jsonLd, ...(article.jsonLd.url ? {} : { url, mainEntityOfPage: url }) }
      : null;
  const lang = article.language && article.language !== 'en' ? article.language : undefined;

  return (
    <BlogFrame>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      )}
      <article lang={lang} dir={lang && RTL.includes(lang) ? 'rtl' : undefined}>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{article.title}</h1>
        <p className="mt-2 text-[13px] text-ink-faint">
          <time dateTime={article.published}>{formatDate(article.published)}</time> · {article.read_time} min read
        </p>

        {image && /^https:\/\//.test(image) && (
          // eslint-disable-next-line @next/next/no-img-element -- адрес картинки задаёт HeyCatch, домен заранее неизвестен
          <img src={image} alt="" className="mt-6 w-full rounded-lg border border-line" />
        )}

        <div className="blog-article mt-8">
          {takeaways && <div dangerouslySetInnerHTML={{ __html: takeaways }} />}
          {toc.length > 0 && (
            <nav aria-labelledby="toc" className="blog-toc">
              <h2 id="toc">Table of contents</h2>
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
