import type { Metadata } from 'next';
import { EquipmentSalePage } from '@/components/domain/EquipmentSalePage';
import { isLocale } from '@/lib/i18n';
import { equipmentSaleCopy } from '@/lib/landing/equipmentSale';
import { fiOrEnPath, pageMetadata } from '@/lib/seo';

/*
 * Открытая страница «Техника на продажу в рассрочку» (23.11.2026).
 * Финский слаг; на остальных языках — /equipment-for-sale. Текст — на
 * всех десяти языках сайта.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const c = equipmentSaleCopy(locale);
  return pageMetadata({
    locale,
    paths: fiOrEnPath('/kalusto-osamaksulla', '/equipment-for-sale'),
    title: c.metaTitle,
    description: c.metaDescription,
  });
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string | string[]; class?: string | string[] }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  return <EquipmentSalePage locale={locale} query={query} />;
}
