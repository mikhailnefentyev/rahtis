import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getDriverI18n } from '@/lib/driverApp/i18n';
import { I18nProvider } from '@/lib/i18n/provider';
import { ServiceWorker } from './ServiceWorker';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getDriverI18n(locale);
  return {
    title: t.driverApp.title,
    manifest: '/driver.webmanifest',
    appleWebApp: { capable: true, title: 'RAHTIS', statusBarStyle: 'default' },
    robots: { index: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#0d647f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  /*
   * Клавиатура сжимает страницу, а не наезжает на неё: на Android иначе
   * закреплённые снизу элементы оставались за клавиатурой и всплывали
   * при прокрутке.
   */
  interactiveWidget: 'resizes-content',
};

/**
 * Оболочка приложения водителя: язык и service worker.
 *
 * Своя, без шапки кабинета: телефон в кабине, большие цели, навигация
 * внизу под большим пальцем. Кого пускать, решают вложенные раскладки:
 * задания, карта и профиль — только привязанному водителю ((app)),
 * тренажёр — и гостю (training).
 */
export default async function DriverShell({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { t } = await getDriverI18n(locale);

  return (
    <I18nProvider locale={locale} dictionary={t}>
      <div data-app="driver" className="min-h-dvh overflow-x-clip bg-ground text-ink">
        <ServiceWorker />
        {children}
      </div>
    </I18nProvider>
  );
}
