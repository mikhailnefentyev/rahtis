import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClaimPage } from '@/components/domain/claims/ClaimPage';
import { getI18n, isLocale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.claims.title };
}

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  return <ClaimPage locale={locale} role="CARRIER" id={id} />;
}
