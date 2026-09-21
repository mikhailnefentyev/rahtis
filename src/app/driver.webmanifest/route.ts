/**
 * Манифест приложения водителя.
 *
 * Отдельный от сайта: устанавливается только приложение водителя, а не
 * кабинеты. Путь без локали и с точкой — прокси такие пути пропускает, а
 * стартовый адрес /driver он сам переведёт на язык водителя по куке.
 *
 * Иконка — та же, что у сайта (512 и 180 px), чтобы на экране телефона
 * водитель узнавал RAHTIS.
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
      background_color: '#eef1f6',
      theme_color: '#0d647f',
      icons: [
        { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
