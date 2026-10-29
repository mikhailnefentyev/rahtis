import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Geist_Mono, Source_Sans_3 } from 'next/font/google';
import { APP } from '@/lib/config';
import { SITE_URL } from '@/lib/seo';
import { getDictionary, isLocale, locales } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n/provider';
import { AnalyticsConsent } from '@/components/layout/AnalyticsConsent';
import { TRANSLATE_GUARD } from '@/lib/translate-guard';
import '../globals.css';

/**
 * Корневой layout приложения.
 *
 * Он живёт под сегментом [locale], а не в app/layout.tsx: язык должен быть
 * известен до отрисовки <html lang>, а узнать его можно только из URL.
 * Поэтому все маршруты RAHTIS находятся под префиксом языка, а запросы без
 * префикса перенаправляет middleware.
 */

/*
 * Source Sans 3 (29.10.2026, как в OwnerHub): спокойный северный гротеск
 * для текста и заголовков. Подмножества латиница, расширенная латиница и
 * кириллица: у Geist была только латиница, и эстонские, латышские,
 * литовские, польские и русские буквы подставлялись системным шрифтом.
 * Файлы подмножеств грузятся только под те знаки, что есть на странице.
 */
const sans = Source_Sans_3({
  variable: '--font-sans-loaded',
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  display: 'swap',
});

const mono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
    /*
     * База для относительных адресов: без неё Next оставляет og:url и
     * canonical относительными, а их читают машины, которым неоткуда
     * узнать домен.
     */
    metadataBase: new URL(SITE_URL),
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
      <head>
        {/* До React: автопереводчик браузера не роняет страницу (см. translate-guard). */}
        <script dangerouslySetInnerHTML={{ __html: TRANSLATE_GUARD }} />
      </head>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} dictionary={dictionary}>
          {children}
          <AnalyticsConsent />
        </I18nProvider>
      </body>
    </html>
  );
}
