import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { listArticles } from '@/lib/blog/heycatch';
import { blogLabels, fixText, mainLanguage } from '@/lib/blog/visuals';
import { SITE_URL } from '@/lib/seo';
import { BLOG_SECTION, BlogFrame, formatDate } from './BlogFrame';

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
 * /blog — в стиле сайта: вверху заголовок и один грузовик без прицепа (не
 * самосвал: блог про всю отрасль), ниже — карточки статей HeyCatch, новые первыми: дата, время
 * чтения, заголовок. Картинок у статей нет — так решил владелец (08.11.2026). Без выдержек — так требует
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
      <section className="border-b border-line bg-surface">
        {/* Текст слева, справа — грузовик без прицепа: блог про всю отрасль, самосвал — только на /maansiirto. */}
        <div className={`${BLOG_SECTION} grid items-center gap-6 py-8 sm:gap-8 sm:py-16 lg:grid-cols-[1.15fr_1fr]`}>
          <div>
            <p className="label-micro" data-accent lang={lang}>
              {t.blog}
            </p>
            <h1 className="mt-3 max-w-[22ch] text-[clamp(30px,4.2vw,46px)] leading-[1.08] font-semibold tracking-tight text-balance" lang={lang}>
              {t.heading}
            </h1>
            {lang === 'fi' && <p className="mt-4 max-w-[56ch] text-[17px] leading-relaxed text-ink-muted">{INTRO}</p>}
          </div>
          <Image
            src="/media/cutout/kuorma-auto.webp"
            alt=""
            aria-hidden
            width={420}
            height={202}
            priority
            sizes="(min-width: 1024px) 420px, 300px"
            className="rise mx-auto w-full max-w-[300px] lg:max-w-[420px]"
          />
        </div>
      </section>
      <section className={`${BLOG_SECTION} py-8 sm:py-14`}>
        {articles.length === 0 ? (
          <p className="text-[15px] text-ink-muted">{t.empty}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <li key={article.slug} lang={article.language || 'en'} className="flex">
                <Link
                  href={`/blog/${encodeURIComponent(article.slug)}`}
                  className="group flex w-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-accent-line hover:shadow-lift"
                >
                  <span className="text-[13px] text-ink-faint">
                    <time dateTime={article.published}>{formatDate(article.published, article.language)}</time> · {article.read_time}{' '}
                    {blogLabels(article.language).min}
                  </span>
                  <span className="mt-2 block text-[17px] leading-snug font-semibold text-ink text-pretty">{fixText(article.title, article.language)}</span>
                  <span className="mt-auto pt-4 text-[14px] font-medium text-accent">
                    {blogLabels(article.language).read} <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </BlogFrame>
  );
}
