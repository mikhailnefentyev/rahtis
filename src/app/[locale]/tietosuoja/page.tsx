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
   * Документ открывается по четырём адресам: финский и английский
   * слаг работают в обеих локалях. Canonical сводит их к одному на
   * язык, иначе поисковик видит восемь страниц вместо двух.
   */
  return pageMetadata({
    locale,
    paths: { fi: '/tietosuoja', en: '/privacy' },
    title: t.legal.PRIVACY,
    description: t.seo.privacyDescription,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalPage locale={locale} kind="PRIVACY" />;
}
