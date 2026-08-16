import { notFound } from 'next/navigation';
import { getI18n, isLocale } from '@/lib/i18n';

/**
 * Временная точка входа Этапа 0.
 *
 * Здесь появится лендинг со входом и формой заявки на Этапах 1–2.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { t } = await getI18n(locale);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <h1 className="font-mono text-2xl font-bold tracking-tight">{t.brand.name}</h1>
      <p className="text-sm text-ink-muted">{t.brand.tagline}</p>
      <p className="max-w-sm text-center text-xs text-ink-dim">{t.brand.description}</p>
    </main>
  );
}
