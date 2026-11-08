import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogCover } from '@/components/blog/BlogCover';
import { listArticles } from '@/lib/blog/heycatch';
import { blogLabels, fixText, mainLanguage, vehicleFor } from '@/lib/blog/visuals';
import { SITE_URL } from '@/lib/seo';
import { BlogFrame, formatDate } from './BlogFrame';

/* Список обновляется сам: раз в 5 минут, без выкладки. */
export const revalidate = 300;

/* Блог в основном финский (08.11.2026) — и описание списка финское. */
const TITLE = 'RAHTIS-blogi: kuljetusten hallinta ja rahtipörssi';
const DESCRIPTION =
  'Käytännön artikkeleita kuljetusyrityksille ja rahdinantajille: rahtikirjat, työajat, palautuskuormat, tarjoukset, laskutus ja maansiirto.';
const INTRO = 'Käytännön oppaita kuljetusyrittäjille ja rahdinantajille – rahtikirjoista ja työajoista laskutukseen ja palautuskuormiin.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/blog`,
    siteName: 'RAHTIS',
    locale: 'fi_FI',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
};

/**
 * /blog — все статьи HeyCatch, новые первыми, карточками: обложка с машиной
 * по теме, заголовок, дата, время чтения. Без выдержек — так требует
 * HeyCatch (описание только для поиска). Подписи — на языке большинства
 * статей. Пусто — короткая строка и ответ 200.
 */
export default async function BlogIndex() {
  const articles = await listArticles();
  const lang = mainLanguage(articles);
  const t = blogLabels(lang);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/blog`,
    inLanguage: lang,
    publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'RAHTIS' },
    blogPost: articles.slice(0, 50).map((a) => ({
      '@type': 'BlogPosting',
      headline: fixText(a.title, a.language),
      url: `${SITE_URL}/blog/${encodeURIComponent(a.slug)}`,
      datePublished: a.published,
      inLanguage: a.language || 'en',
    })),
  };

  return (
    <BlogFrame lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <h1 className="text-2xl font-semibold tracking-tight" lang={lang}>
        {t.blog}
      </h1>
      {lang === 'fi' && <p className="mt-2 max-w-[60ch] text-[15px] text-ink-muted">{INTRO}</p>}
      {articles.length === 0 ? (
        <p className="mt-6 text-[15px] text-ink-muted">{t.empty}</p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2">
          {articles.map((article, i) => (
            <li key={article.slug} lang={article.language || 'en'}>
              <Link href={`/blog/${encodeURIComponent(article.slug)}`} className="group block">
                <BlogCover vehicle={vehicleFor(article)} small priority={i < 2} />
                <span className="mt-3 block text-[17px] leading-snug font-semibold text-ink group-hover:underline">{fixText(article.title, article.language)}</span>
                <span className="mt-1.5 block text-[13px] text-ink-faint">
                  <time dateTime={article.published}>{formatDate(article.published, article.language)}</time> · {article.read_time} {blogLabels(article.language).min}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BlogFrame>
  );
}
