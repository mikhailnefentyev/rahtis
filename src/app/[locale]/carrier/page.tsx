import { notFound } from 'next/navigation';
import { CabinetOverview } from '@/components/layout/CabinetOverview';
import { requireRole } from '@/lib/auth/guard';
import { isLocale } from '@/lib/i18n';

export default async function CarrierPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');

  return <CabinetOverview locale={locale} role="CARRIER" company={viewer.company} />;
}
