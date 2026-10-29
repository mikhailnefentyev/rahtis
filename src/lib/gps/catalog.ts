import type { GpsProvider } from './types';

/**
 * Провайдеры GPS для формы подключения: название, где в кабинете
 * провайдера создаётся ключ, можно ли указать свой сервер. Без серверного
 * кода — модуль читает и форма в браузере, и адаптеры (providers.ts).
 *
 * Путь к ключу — словами меню провайдера (на английском, как в их
 * документации): интерфейс провайдера бывает на разных языках.
 */

export type ProviderInfo = {
  id: GpsProvider;
  name: string;
  /** В каких странах RAHTIS распространён — подсказка в списке. */
  markets: string;
  keyPath: string;
  customHost: boolean;
  defaultHost: string;
  placeholder: string;
  docs: string;
};

export const PROVIDER_CATALOG: Record<GpsProvider, ProviderInfo> = {
  WIALON: {
    id: 'WIALON',
    name: 'Wialon',
    markets: 'FI, EE, LV, LT, PL',
    keyPath: 'Locator → New link (unlimited), or User settings → Access → Tokens',
    customHost: true,
    defaultHost: 'hst-api.wialon.com',
    placeholder: 'https://hosting.wialon.com/locator/index.html?t=…',
    docs: 'https://help.wialon.com/en/wialon-hosting/user-guide/monitoring-system/locator',
  },
  MAPON: {
    id: 'MAPON',
    name: 'Mapon',
    markets: 'FI, SE, DK, EE, LV, LT, PL',
    keyPath: 'Settings → API keys → Create (administrator)',
    customHost: false,
    defaultHost: 'mapon.com',
    placeholder: 'a1b2c3d4e5f6…',
    docs: 'https://help.mapon.com/en/articles/174904-how-to-create-api-key',
  },
  NAVIREC: {
    id: 'NAVIREC',
    name: 'Navirec',
    markets: 'FI, EE, LV, LT',
    keyPath: 'Profile → Account settings → API access',
    customHost: false,
    defaultHost: 'api.navirec.com',
    placeholder: 'navirec_live_…',
    docs: 'https://api.navirec.com/schema/',
  },
  RUPTELA: {
    id: 'RUPTELA',
    name: 'Ruptela TrustTrack',
    markets: 'LT, LV, PL',
    keyPath: 'Account settings → API Key Settings → New API key (if missing — ask Ruptela to enable it)',
    customHost: false,
    defaultHost: 'api.fm-track.com',
    placeholder: '…',
    docs: 'https://api.fm-track.com/swagger.json',
  },
  NAVIXY: {
    id: 'NAVIXY',
    name: 'Navixy',
    markets: 'EU (many local GPS services run on Navixy under their own brand)',
    keyPath: 'User settings → API keys → Create',
    customHost: true,
    defaultHost: 'api.eu.navixy.com',
    placeholder: 'abcdef0123456789…',
    docs: 'https://www.navixy.com/docs/navixy-api/user-api/backend-api/resources/tracking/tracker',
  },
  SAMSARA: {
    id: 'SAMSARA',
    name: 'Samsara',
    markets: 'EU',
    keyPath: 'Settings → API Tokens → Add API Token (read access to Vehicles)',
    customHost: true,
    defaultHost: 'api.samsara.com',
    placeholder: 'samsara_api_…',
    docs: 'https://developers.samsara.com/docs/authentication',
  },
};
