import type { Metadata } from 'next';
import { LegalPage } from '@/components/domain/LegalPage';
import { getI18n, isLocale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  /*
   * Те же четыре адреса, что у остальных документов: финский и
   * английский слаг работают в обеих локалях, canonical сводит их к
   * одному на язык.
   */
  return pageMetadata({
    locale,
    paths: { fi: '/tilausehdot', en: '/customer-terms' },
    title: t.legal.SHIPPER_AGREEMENT,
    description: t.seo.customerTermsDescription,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalPage locale={locale} kind="SHIPPER_AGREEMENT" />;
}
