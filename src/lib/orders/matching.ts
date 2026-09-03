'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

export type MatchingState = { error: string | null };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

/**
 * Превращает код ошибки из базы в понятный текст.
 *
 * Все отказы матчинга — это гонки: пока человек смотрел на экран, срок
 * вышел, места заняли или заказ забрал другой. Показывать код или
 * английское сообщение Postgres здесь бессмысленно.
 */
async function explain(locale: Locale, code: string | undefined, message: string | undefined) {
  const t = await getDictionary(locale);

  if (code === '23505') return t.matching.alreadyTaken;
  /*
   * 55001 — своя ошибка take_order: груза больше, чем берёт тягач с
   * таким числом осей. Отдельный код, а не разбор текста: сообщение из
   * базы содержит килограммы и по-русски, а перевозчику нужно сказать,
   * какая машина подойдёт.
   */
  if (code === '55001') return t.fleet.tooHeavy;
  /*
   * 55002 — контейнер не встал на шасси. Свой код, а не общий 55000, по
   * той же причине, что и вес: перевозчику нужно понять, что дело в
   * машине, а не в занятом заказе, и выбрать другую.
   */
  if (code === '55002') return t.matching.noChassis;
  if (code === '55000' && message?.includes('Мест нет')) return t.matching.noSlotsLeft;
  if (code === '55000') return t.matching.tooLate;

  return t.matching.failed;
}

/** «Беру» — отклик перевозчика конкретной машиной. */
export async function takeOrderAction(
  _previous: MatchingState,
  formData: FormData,
): Promise<MatchingState> {
  const locale = toLocale(formData.get('locale'));

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER') {
    return { error: (await getDictionary(locale)).error.forbidden };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('take_order', {
    p_order_id: String(formData.get('order_id') ?? ''),
    p_vehicle_id: String(formData.get('vehicle_id') ?? ''),
  });

  revalidatePath(`/${locale}/carrier`, 'layout');

  return { error: error ? await explain(locale, error.code, error.message) : null };
}

/** Выбор заказчиком одного отклика из трёх. */
export async function chooseOfferAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  const supabase = await createClient();
  await supabase.rpc('choose_offer', { p_offer_id: String(formData.get('offer_id') ?? '') });

  revalidatePath(`/${locale}/shipper`, 'layout');
}

/** Подтверждение работы выбранным перевозчиком. */
export async function confirmOrderAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  const supabase = await createClient();
  await supabase.rpc('confirm_order', { p_order_id: String(formData.get('order_id') ?? '') });

  revalidatePath(`/${locale}/carrier`, 'layout');
}

/** Откат до старта: доступен обеим сторонам (ТЗ §6). */
export async function cancelOrderAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  const supabase = await createClient();
  await supabase.rpc('cancel_order', { p_order_id: String(formData.get('order_id') ?? '') });

  revalidatePath(`/${locale}`, 'layout');
}
