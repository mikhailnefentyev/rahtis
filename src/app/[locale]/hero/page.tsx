import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HeroPort } from '@/components/domain/HeroPort';
import { getI18n, isLocale } from '@/lib/i18n';

/**
 * Первый экран отдельно от остальной страницы.
 *
 * Нужен для сверки: видно ли текст поверх съёмки, не спорит ли карточка
 * с фоном, не превратилось ли всё в кашу. Когда сверим — этот маршрут
 * уходит, а секция встаёт на главную.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.brand.name };
}

export default async function HeroPreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <HeroPort locale={locale} />;
}
