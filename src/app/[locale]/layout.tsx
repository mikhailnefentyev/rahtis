import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Geist, Geist_Mono } from 'next/font/google';
import { APP } from '@/lib/config';
import { getDictionary, isLocale, locales } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n/provider';
import '../globals.css';

/**
 * Корневой layout приложения.
 *
 * Он живёт под сегментом [locale], а не в app/layout.tsx: язык должен быть
 * известен до отрисовки <html lang>, а узнать его можно только из URL.
 * Поэтому все маршруты RAHTIS находятся под префиксом языка, а запросы без
 * префикса перенаправляет middleware.
 */

// Кириллица обязательна: интерфейс русский, дальше — финский и остальные.
const sans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

const mono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = await getDictionary(locale);

  return {
    title: {
      default: t.brand.name,
      template: `%s · ${t.brand.name}`,
    },
    description: t.brand.description,
    applicationName: APP.name,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);

  return (
    <html
      lang={dictionary.meta.htmlLang}
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} dictionary={dictionary}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
