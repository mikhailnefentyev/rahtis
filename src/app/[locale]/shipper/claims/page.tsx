import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClaimsCabinet } from '@/components/domain/claims/ClaimsCabinet';
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

export default async function ClaimsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ locale }, { status }] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  return <ClaimsCabinet locale={locale} role="SHIPPER" status={status} />;
}
