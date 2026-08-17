import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
};

export default nextConfig;
