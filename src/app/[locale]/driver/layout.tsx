import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { getDriver } from '@/lib/driverApp/session';
import { getI18n, isLocale } from '@/lib/i18n';
import { DriverNav } from './DriverNav';
import { NotLinked } from './NotLinked';
import { OutboxBanner, OutboxProvider } from './OutboxProvider';
import { ServiceWorker } from './ServiceWorker';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
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
};

/**
 * Приложение водителя.
 *
 * Своя оболочка, без шапки кабинета: телефон в кабине, большие цели,
 * навигация внизу под большим пальцем. Вход — только по приглашению, и
 * без привязанного водителя вместо приложения экран «попросите ссылку».
 */
export default async function DriverLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const driver = await getDriver();

  return (
    <div className="min-h-dvh bg-ground text-ink">
      <ServiceWorker />
      {driver ? (
        <OutboxProvider>
          <div className="mx-auto w-full max-w-lg px-4 pt-[max(env(safe-area-inset-top),16px)] pb-28">
            <OutboxBanner />
            {children}
          </div>
          <DriverNav unread={driver.unread} />
        </OutboxProvider>
      ) : (
        <NotLinked locale={locale} />
      )}
    </div>
  );
}
