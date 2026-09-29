import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /*
   * Витрина UI-кита существует только в разработке.
   *
   * Раньше страница отвечала 404 проверкой в теле, но её код всё равно
   * попадал в сборку: чанк с полутора тысячами русских символов лежал в
   * .next/static и скачивался по прямому имени файла. Страницы с
   * расширением .dev.tsx в бою просто не компилируются, поэтому нет ни
   * маршрута, ни чанка.
   */
  pageExtensions:
    process.env.NODE_ENV === 'production'
      ? ['tsx', 'ts']
      : ['dev.tsx', 'dev.ts', 'tsx', 'ts'],

  experimental: {
    /*
     * Лицензия и страховка загружаются серверным действием, а не напрямую
     * в Storage: так файл и запись о нём появляются одним путём, и при
     * ошибке не остаётся файла без записи в базе.
     *
     * Платой за это идёт лимит тела запроса — по умолчанию 1 МБ, чего мало
     * даже для сканированного PDF. Значение совпадает с file_size_limit
     * бакета company-docs: смысла принимать больше, чем примет хранилище, нет.
     */
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  /*
   * Заголовки безопасности на всё (проверка 29.09.2026: стоял только HSTS).
   *
   *  · frame-ancestors 'none' и X-Frame-Options — сайт нельзя встроить в
   *    чужую страницу и подсунуть под невидимую кнопку (clickjacking);
   *  · base-uri, object-src, form-action — чужой <base>, плагины и отправка
   *    форм на чужой адрес закрыты даже при внедрённой разметке;
   *  · Permissions-Policy — камера и геолокация только своему сайту (они
   *    нужны приложению водителя), микрофон и оплата — никому.
   *
   * Полная CSP со списком источников скриптов — отдельным шагом: карта,
   * MapLibre и Next требуют выверенного списка, и ошибка в нём ломает
   * приложение водителя в кабине.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
