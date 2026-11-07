'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { EXCHANGE_PROVIDERS, type ExchangeProvider } from './model';

/*
 * Подключённые биржи (7.11.2026): пока договоров с биржами нет — заявка
 * «хочу подключить» и её отмена. Права — в функциях базы (своя компания).
 */

export type ExchangeState = { error: string | null };

const toLocale = (value: FormDataEntryValue | null): Locale => {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
};

const toProvider = (value: FormDataEntryValue | null): ExchangeProvider | null => {
  const raw = String(value ?? '');
  return (EXCHANGE_PROVIDERS as readonly string[]).includes(raw) ? (raw as ExchangeProvider) : null;
};

export async function exchangeInterestAction(_previous: ExchangeState, formData: FormData): Promise<ExchangeState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await getViewer();
  const provider = toProvider(formData.get('provider'));
  if (viewer.status !== 'ready' || !provider) return { error: t.error.forbidden };

  const withdraw = formData.get('intent') === 'withdraw';
  const { error } = await (await createClient()).rpc(
    withdraw ? 'withdraw_exchange_connection' : 'request_exchange_connection',
    { p_provider: provider },
  );
  if (error) {
    console.error('заявка на биржу не сохранена:', error.message);
    return { error: t.exchanges.failed };
  }
  revalidatePath(`/${locale}/account`);
  return { error: null };
}
