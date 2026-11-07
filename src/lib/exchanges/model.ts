/** Внешние биржи грузов, которые компания может подключить (7.11.2026). */
export const EXCHANGE_PROVIDERS = ['TRANSEU', 'TIMOCOM'] as const;
export type ExchangeProvider = (typeof EXCHANGE_PROVIDERS)[number];

export const EXCHANGE_NAMES: Record<ExchangeProvider, string> = {
  TRANSEU: 'Trans.eu',
  TIMOCOM: 'TIMOCOM',
};

export type ExchangeStatus = 'INTERESTED' | 'CONNECTED' | 'REVOKED';
export type ExchangeRow = { provider: ExchangeProvider; status: ExchangeStatus; external_account: string | null };
