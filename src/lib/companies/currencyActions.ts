'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { isCurrency } from '@/lib/money/currency';
import { createClient } from '@/lib/supabase/server';

export type CurrencyState = { error: string | null; saved: boolean };

/**
 * Рабочая валюта компании (решение 5.11.2026): подставляется в новые суммы
 * перевозчика и в прямые заказы заказчика. Прежние суммы хранят свою
 * валюту — менять можно в любой момент. Меняет главный в компании, не
 * диспетчер: это настройка учёта, а не рейса.
 */
export async function saveCompanyCurrencyAction(_previous: CurrencyState, formData: FormData): Promise<CurrencyState> {
  const raw = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || !viewer.company || viewer.profile.member_kind === 'DISPATCHER') {
    return { error: t.account.currencyError, saved: false };
  }

  const currency = String(formData.get('currency') ?? '').trim().toUpperCase();
  if (!isCurrency(currency)) return { error: t.account.currencyError, saved: false };

  const supabase = await createClient();
  const { error } = await supabase.from('companies').update({ currency }).eq('id', viewer.company.id);
  if (error) return { error: t.account.currencyError, saved: false };

  /* Валюта видна во всём кабинете — обновляем раскладку целиком. */
  revalidatePath(`/${locale}`, 'layout');
  return { error: null, saved: true };
}
