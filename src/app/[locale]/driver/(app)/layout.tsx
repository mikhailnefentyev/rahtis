import { notFound } from 'next/navigation';
import { getDriver } from '@/lib/driverApp/session';
import { isLocale } from '@/lib/i18n';
import { DriverNav } from '../DriverNav';
import { NotLinked } from '../NotLinked';
import { ScrollArea } from '../ScrollArea';
import { OutboxBanner, OutboxProvider } from '../OutboxProvider';

/**
 * Рабочая часть приложения водителя: задания, заработок, карта, сообщения,
 * профиль.
 *
 * Вход — только по приглашению, и без привязанного водителя вместо
 * приложения экран «попросите ссылку».
 */
export default async function DriverAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const driver = await getDriver();
  if (!driver) return <NotLinked locale={locale} />;

  return (
    <OutboxProvider>
      {/*
        * Экран по высоте телефона: прокручивается середина, меню — нижняя
        * строка. См. ScrollArea: на iPhone закреплённое меню уезжало.
        */}
      <div className="flex h-dvh flex-col">
        <ScrollArea>
          <div className="mx-auto w-full max-w-lg px-4 pt-[max(env(safe-area-inset-top),16px)] pb-6">
            <OutboxBanner />
            {children}
          </div>
        </ScrollArea>
        <DriverNav unread={driver.unread} />
      </div>
    </OutboxProvider>
  );
}
