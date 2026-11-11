import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { listArticles } from '@/lib/blog/heycatch';
import { articlesIn, blogPath, isBlogLocale } from '@/lib/blog/translations';
import { blogLabels, fixText } from '@/lib/blog/visuals';
import { locales } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo';
import { BLOG_SECTION, BlogFrame, formatDate } from './BlogFrame';

/* Список обновляется сам: раз в 5 минут, без выкладки. */
export const revalidate = 300;

type Params = { params: Promise<{ locale: string }> };

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

/** hreflang блога: у каждого языка свой список, x-default — финский /blog. */
const BLOG_LANGUAGES = Object.fromEntries([...locales.map((l) => [l, `${SITE_URL}${blogPath(l)}`]), ['x-default', `${SITE_URL}/blog`]]);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isBlogLocale(locale)) return {};
  const t = blogLabels(locale);
  const url = `${SITE_URL}${blogPath(locale)}`;
  return {
    title: { absolute: t.title },
    description: t.description,
    alternates: { canonical: url, languages: BLOG_LANGUAGES },
    openGraph: {
      type: 'website',
      url,
      siteName: 'RAHTIS',
      locale: OG_LOCALE[locale],
      title: t.title,
      description: t.description,
      images: ['/og.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: t.title,
      description: t.description,
      images: ['/og.png'],
    },
  };
}

/**
 * Блог на языке страницы (08.11.2026): /blog — финский, /de/blog — немецкий
 * и т. д. В стиле сайта: вверху заголовок и один грузовик без прицепа (не
 * самосвал: блог про всю отрасль), ниже — карточки статей HeyCatch, новые
 * первыми: дата, время чтения, заголовок. В списке — статьи, написанные на
 * этом языке или переведённые на него. Картинок у статей нет — так решил
 * владелец (08.11.2026). Без выдержек — так требует HeyCatch (описание
 * только для поиска). Пусто — короткая строка и ответ 200.
 */
export default async function BlogIndex({ params }: Params) {
  const { locale } = await params;
  if (!isBlogLocale(locale)) notFound();
  const lang = locale;
  const t = blogLabels(lang);
  const articles = await articlesIn(lang, await listArticles());
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: t.title,
    description: t.description,
    url: `${SITE_URL}${blogPath(lang)}`,
    inLanguage: lang,
    publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'RAHTIS' },
    blogPost: articles.slice(0, 50).map((a) => ({
      '@type': 'BlogPosting',
      headline: fixText(a.title, lang),
      url: `${SITE_URL}${blogPath(lang, a.slug)}`,
      datePublished: a.published,
      inLanguage: lang,
    })),
  };

  return (
    <BlogFrame lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      {/*
        Тёмный баннер: ночное фото (грузовик RAHTIS.EU + телефон) справа растворяется
        в фирменном тёмно-синем, текст белый. На светлом фоне фото выглядело вставкой.
        На телефоне фото — приглушённый фон под текстом.
      */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 -z-10 w-full opacity-30 lg:w-[56%] lg:opacity-100 lg:[mask-image:linear-gradient(to_right,transparent_0%,black_38%)]"
        >
          <Image
            src="/media/blog-hero.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 62vw, 100vw"
            className="object-cover object-[70%_center] lg:object-[center_8%]"
          />
        </div>
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
        <div className={`${BLOG_SECTION} py-14 sm:py-24 lg:py-32`}>
          <div className="max-w-[30rem]">
            <p className="label-micro text-accent-bright" lang={lang}>
              {t.blog}
            </p>
            <h1 className="mt-3 max-w-[22ch] text-[clamp(30px,4.2vw,46px)] leading-[1.08] font-semibold tracking-tight text-balance text-white" lang={lang}>
              {t.heading}
            </h1>
            <p className="mt-4 max-w-[56ch] text-[17px] leading-relaxed text-white/75">{t.intro}</p>
          </div>
        </div>
      </section>
      <section className={`${BLOG_SECTION} py-8 sm:py-14`}>
        {articles.length === 0 ? (
          <p className="text-[15px] text-ink-muted">{t.empty}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <li key={article.slug} className="flex">
                <Link
                  href={blogPath(lang, article.slug)}
                  className="group flex w-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-accent-line hover:shadow-lift"
                >
                  <span className="text-[13px] text-ink-faint">
                    <time dateTime={article.published}>{formatDate(article.published, lang)}</time> · {article.read_time} {t.min}
                  </span>
                  <span className="mt-2 block text-[17px] leading-snug font-semibold text-ink text-pretty">{fixText(article.title, lang)}</span>
                  <span className="mt-auto pt-4 text-[14px] font-medium text-accent">
                    {t.read} <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
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
