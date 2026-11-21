import type { Metadata } from 'next';
import { InstallmentLanding } from '@/components/domain/InstallmentLanding';
import { isLocale } from '@/lib/i18n';
import { INSTALLMENT_TEXT_LOCALES, installmentCopy } from '@/lib/landing/installment';
import { fiOrEnPath, pageMetadata } from '@/lib/seo';

/*
 * Калькулятор рассрочки техники. Финский слаг; английский —
 * /truck-installment-sale. Текст только финский и английский.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const c = installmentCopy(locale);
  return pageMetadata({
    locale,
    paths: fiOrEnPath('/kuorma-auto-osamaksulla', '/truck-installment-sale'),
    title: c.metaTitle,
    description: c.metaDescription,
    textLocales: INSTALLMENT_TEXT_LOCALES,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <InstallmentLanding locale={locale} />;
}
