import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/domain/LegalDocument';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.legal.CARRIER_AGREEMENT, robots: { index: false, follow: false } };
}

/**
 * Договор перевозчика — в кабинете перевозчика.
 *
 * Редакции у него пока нет ни одной: условия использования ссылаются на
 * него как на документ, который перевозчик принимает отдельно, а самого
 * текста ещё не существует. Страница в этом случае честно говорит, что
 * документа нет, — это лучше, чем отсутствующий адрес: перевозчик,
 * которому сказали «примите договор», приходит сюда и видит состояние
 * дел, а не ошибку 404.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'CARRIER');
  const { t } = await getI18n(locale);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t.legal.CARRIER_AGREEMENT}</h1>
      <LegalDocument locale={locale} kind="CARRIER_AGREEMENT" />
    </main>
  );
}
