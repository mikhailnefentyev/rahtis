import type { Metadata } from 'next';
import { EarthworksPage } from '@/components/domain/EarthworksPage';
import { isLocale } from '@/lib/i18n';
import { EARTHWORKS } from '@/lib/landing/earthworks';
import { fiOrEnPath, pageMetadata } from '@/lib/seo';

/*
 * Витрина модуля объектов. Финский слаг; английский — /earthworks.
 * Оба слага работают в каждой локали, canonical сводит к одному на язык.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const c = EARTHWORKS[locale];
  return pageMetadata({ locale, paths: fiOrEnPath('/maansiirto', '/earthworks'), title: c.metaTitle, description: c.metaDescription });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <EarthworksPage locale={locale} />;
}
