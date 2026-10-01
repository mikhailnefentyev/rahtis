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
    /*
     * Заставка iPhone при запуске с экрана «Домой»: без неё iOS показывает
     * белый экран, пока грузится страница. Картинки под размеры экранов —
     * public/splash (тёмный фон, буква R), подбираются по media.
     */
    appleWebApp: { capable: true, title: 'RAHTIS', statusBarStyle: 'default', startupImage: SPLASH },
    robots: { index: false },
  };
}

/* iPhone: CSS-ширина, высота и плотность экрана — как в public/splash. */
const SPLASH = (
  [
    [440, 956, 3], [430, 932, 3], [402, 874, 3], [393, 852, 3], [390, 844, 3],
    [428, 926, 3], [414, 896, 3], [414, 896, 2], [375, 812, 3], [414, 736, 3], [375, 667, 2],
  ] as const
).map(([w, h, dpr]) => ({
  url: `/splash/iphone-${w * dpr}x${h * dpr}.png`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}));

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
        {/*
          * Экран загрузки: тот же, что заставка iPhone, — без белой вспышки
          * между заставкой и приложением. Приходит с первыми байтами
          * страницы и гаснет сам (CSS, без ожидания скриптов); при переходах
          * внутри приложения оболочка не перерисовывается, и его нет.
          */}
        <div aria-hidden className="boot-splash">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/splash/mark-dark.png" alt="" width={512} height={521} />
        </div>
        <ServiceWorker />
        {children}
      </div>
    </I18nProvider>
  );
}
