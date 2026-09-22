import { getDriverI18n } from '@/lib/driverApp/i18n';
import type { Locale } from '@/lib/i18n';
import { CodeForm } from './CodeForm';

/**
 * Приложение открыто без привязанного водителя: гость, кабинетный
 * пользователь или водитель, которого отвязали. Войти можно только по
 * приглашению перевозчика: по ссылке или здесь, телефоном и кодом.
 */
export async function NotLinked({ locale }: { locale?: Locale } = {}) {
  const { t } = await getDriverI18n(locale ?? 'fi');

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.png" alt="" className="size-20 rounded-2xl" />
      <h1 className="text-2xl font-semibold tracking-tight">{t.driverApp.notLinked}</h1>
      <p className="text-[17px] leading-relaxed text-ink-muted">{t.driverApp.notLinkedHint}</p>
      <CodeForm />
    </main>
  );
}
