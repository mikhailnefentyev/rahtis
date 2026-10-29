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
  /** Как входит перевозчик: ключ, логин с паролем и ключом (Webfleet) или вход у провайдера (ABAX, OAuth). */
  auth: 'KEY' | 'CREDENTIALS' | 'OAUTH';
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
    auth: 'KEY',
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
    auth: 'KEY',
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
    auth: 'KEY',
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
    auth: 'KEY',
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
    auth: 'KEY',
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
    auth: 'KEY',
  },
  WEBFLEET: {
    id: 'WEBFLEET',
    name: 'Webfleet',
    markets: 'DE, PL, FI, SE, NO, DK',
    keyPath: 'My Account → API key request; the user needs the WEBFLEET.connect right (Account → Users → Rights)',
    customHost: false,
    defaultHost: 'csv.webfleet.com',
    placeholder: '00000000-0000-0000-0000-000000000000',
    docs: 'https://www.webfleet.com/en_ie/fleet-management/integration/resources/',
    auth: 'CREDENTIALS',
  },
  ABAX: {
    id: 'ABAX',
    name: 'ABAX',
    markets: 'NO, SE, DK, FI, PL',
    keyPath: 'Sign in to ABAX as an administrator and approve RAHTIS',
    customHost: false,
    defaultHost: 'api.abax.cloud',
    placeholder: '',
    docs: 'https://developers.abax.cloud/getting-started',
    auth: 'OAUTH',
  },
};
