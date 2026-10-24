import type { Metadata } from 'next';
import Link from 'next/link';
import { listArticles } from '@/lib/blog/heycatch';
import { SITE_URL } from '@/lib/seo';
import { BlogFrame, formatDate } from './BlogFrame';

/* Список обновляется сам: раз в 5 минут, без выкладки. */
export const revalidate = 300;

const TITLE = 'RAHTIS blog: transport management and freight exchange';
const DESCRIPTION =
  'Practical articles for carriers and shippers: trailer swaps, containers, express transport, consignment notes, empty return legs and working time.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: { type: 'website', url: `${SITE_URL}/blog`, siteName: 'RAHTIS', title: TITLE, description: DESCRIPTION, images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og.png'] },
};

/**
 * /blog — все статьи HeyCatch, новые первыми: заголовок, дата, время
 * чтения. Без выдержек — так требует HeyCatch (описание только для поиска).
 * Пусто — короткая строка и ответ 200.
 */
export default async function BlogIndex() {
  const articles = await listArticles();

  return (
    <BlogFrame>
      <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
      {articles.length === 0 ? (
        <p className="mt-6 text-[15px] text-ink-muted">No articles yet.</p>
      ) : (
        <ul className="mt-8 flex flex-col divide-y divide-line border-y border-line">
          {articles.map((article) => (
            <li key={article.slug} className="py-5" lang={article.language && article.language !== 'en' ? article.language : undefined}>
              <Link
                href={`/blog/${encodeURIComponent(article.slug)}`}
                className="text-[17px] leading-snug font-semibold text-ink hover:underline"
              >
                {article.title}
              </Link>
              <p className="mt-1.5 text-[13px] text-ink-faint">
                <time dateTime={article.published}>{formatDate(article.published)}</time> · {article.read_time} min read
              </p>
            </li>
          ))}
        </ul>
      )}
    </BlogFrame>
  );
}
