'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Оценка перевозчика после закрытого рейса (ТЗ §10).
 *
 * Заказчик оценивает рейс, а не компанию: компанию-перевозчика он не
 * знает — его контрагент Aivomaa (ТЗ §1), а в откликах перевозчики
 * обезличены. Кого именно оценили, подставляет база из заказа.
 */

export type RatingState = { error: string | null; score: number | null };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

export async function rateOrderAction(
  _previous: RatingState,
  formData: FormData,
): Promise<RatingState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'SHIPPER') {
    return { error: t.error.forbidden, score: null };
  }

  const score = Number.parseInt(String(formData.get('score') ?? ''), 10);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return { error: t.rating.failed, score: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('rate_order', {
    p_order_id: String(formData.get('order_id') ?? ''),
    p_score: score,
    p_comment: String(formData.get('comment') ?? '').trim() || undefined,
  });

  if (error) {
    /*
     * 55000 приходит с объяснением от той же функции, которая отказала, —
     * «рейс ещё не закрыт», «перевозчика нет». Общая фраза вместо него
     * отняла бы у заказчика единственную подсказку.
     */
    return {
      error: error.code === '55000' ? error.message : t.rating.failed,
      score: null,
    };
  }

  revalidatePath(`/${locale}`, 'layout');
  return { error: null, score };
}
