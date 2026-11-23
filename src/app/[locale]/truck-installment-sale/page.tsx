import type { Metadata } from 'next';
import { InstallmentLanding } from '@/components/domain/InstallmentLanding';
import { isLocale } from '@/lib/i18n';
import { INSTALLMENT_TEXT_LOCALES, installmentCopy } from '@/lib/landing/installment';
import { fiOrEnPath, pageMetadata } from '@/lib/seo';

/*
 * Калькулятор рассрочки техники. Финский слаг; английский —
 * /truck-installment-sale. Текст — на всех десяти языках сайта.
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

/* Страна расчёта — ?country= (24.11.2026); в metadata строки запроса нет: canonical и hreflang без неё. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string | string[] }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  return <InstallmentLanding locale={locale} country={query.country} />;
}
