import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { listArticles } from '@/lib/blog/heycatch';
import { blogLabels, fixText, mainLanguage } from '@/lib/blog/visuals';
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
 * /blog — все статьи HeyCatch, новые первыми, простым списком: заголовок,
 * дата, время чтения. Справа от заголовка блога — одна картинка самосвала
 * (как на /maansiirto); у статей своих картинок нет — так решил владелец. Без выдержек — так требует
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
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" lang={lang}>
            {t.blog}
          </h1>
          {lang === 'fi' && <p className="mt-2 max-w-[46ch] text-[15px] text-ink-muted">{INTRO}</p>}
        </div>
        <Image
          src="/media/kippiauto.webp"
          alt=""
          aria-hidden
          width={926}
          height={445}
          priority
          sizes="260px"
          className="hidden w-[260px] shrink-0 mix-blend-multiply sm:block"
        />
      </div>
      {articles.length === 0 ? (
        <p className="mt-6 text-[15px] text-ink-muted">{t.empty}</p>
      ) : (
        <ul className="mt-8 flex flex-col divide-y divide-line border-y border-line">
          {articles.map((article) => (
            <li key={article.slug} className="py-5" lang={article.language || 'en'}>
              <Link href={`/blog/${encodeURIComponent(article.slug)}`} className="text-[17px] leading-snug font-semibold text-ink hover:underline">
                {fixText(article.title, article.language)}
              </Link>
              <p className="mt-1.5 text-[13px] text-ink-faint">
                <time dateTime={article.published}>{formatDate(article.published, article.language)}</time> · {article.read_time} {blogLabels(article.language).min}
              </p>
            </li>
          ))}
        </ul>
      )}
    </BlogFrame>
  );
}
