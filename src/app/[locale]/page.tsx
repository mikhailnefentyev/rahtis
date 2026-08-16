import { getDictionary, isLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';

/**
 * Временная точка входа Этапа 0.
 *
 * Здесь появится лендинг со входом и формой заявки, когда будет выбрано
 * визуальное направление и собран UI-кит.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = await getDictionary(locale);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <h1 className="font-mono text-2xl font-bold tracking-tight">{t.brand.name}</h1>
      <p className="text-sm opacity-60">{t.brand.tagline}</p>
      <p className="text-xs opacity-40">Этап 0 · каркас</p>
    </main>
  );
}
