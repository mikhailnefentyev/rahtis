/** Адрес блога или статьи на языке: финский — без префикса (/blog), остальные — /de/blog. */
export function blogPath(locale: string, slug?: string): string {
  const base = locale === 'fi' ? '/blog' : `/${locale}/blog`;
  return slug ? `${base}/${encodeURIComponent(slug)}` : base;
}
