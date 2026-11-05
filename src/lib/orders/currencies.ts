import 'server-only';

import { asCurrency, type Currency } from '@/lib/money/currency';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Валюта заказов стола по их id.
 *
 * desk_orders и backhaul_suggestions валюту не отдают, а строка orders
 * перевозчику до назначения закрыта RLS. Поэтому — служебным клиентом и
 * только колонка currency: id приходят из тех же функций стола, то есть
 * перевозчик эти заказы уже видит. Не евро бывает только у стола
 * «напрямую с перевозчиком»; ошибка чтения — евро, как у всего стола.
 */
export async function orderCurrencies(ids: readonly string[]): Promise<Record<string, Currency>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const { data } = await createAdminClient().from('orders').select('id, currency').in('id', unique);
    return Object.fromEntries((data ?? []).map((o) => [o.id, asCurrency(o.currency)]));
  } catch {
    return {};
  }
}
