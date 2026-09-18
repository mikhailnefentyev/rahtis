import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PeriodReportCabinet } from '@/components/domain/PeriodReportCabinet';
import { getI18n, isLocale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.periodReport.title };
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; company?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  return <PeriodReportCabinet locale={locale} role="ADMIN" searchParams={query} />;
}
