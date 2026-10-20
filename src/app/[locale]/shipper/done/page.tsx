import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompletedCabinet } from '@/components/domain/CompletedCabinet';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.done.titleShipper };
}

export default async function DonePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <CompletedCabinet locale={locale} role="SHIPPER" />;
}
