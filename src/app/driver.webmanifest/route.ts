/**
 * Манифест приложения водителя.
 *
 * Отдельный от сайта: устанавливается только приложение водителя, а не
 * кабинеты. Путь без локали и с точкой — прокси такие пути пропускает, а
 * стартовый адрес /driver он сам переведёт на язык водителя по куке.
 *
 * Иконки — свои, public/app-icon-*.png: буква R с полями.
 */
export const dynamic = 'force-static';

export function GET() {
  return Response.json(
    {
      name: 'RAHTIS Kuljettaja',
      short_name: 'RAHTIS',
      id: '/driver',
      start_url: '/driver',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      /* Заставка Android: тёмный фон под иконкой — как экран загрузки. */
      background_color: '#050b16',
      theme_color: '#0d647f',
      icons: [
        /*
         * Свои иконки приложения (22.11.2026): буква R занимает около 60 %
         * плитки, с полями, на светлом фоне. Прежняя /icon.png — буква во
         * весь квадрат на прозрачном фоне: на экране телефона она упиралась
         * в края плитки. maskable — для круглых и фигурных плиток Android,
         * буква там ещё меньше, чтобы обрезка её не задела.
         */
        { src: '/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/app-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
