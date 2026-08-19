'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Отметки прохождения рейса.
 *
 * Отмечает перевозчик из кабинета. У водителя веб-кабинета нет — по ТЗ §7
 * он общается с платформой через WhatsApp-агента, и на Этапе 8 сюда же
 * будет ходить n8n от его имени. Функции базы для этого и рассчитаны:
 * одна точка, одно необязательное описание повреждения, — поэтому
 * появление агента не потребует переделки.
 */

export type TripState = { error: string | null };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : 'ru';
}

/**
 * Превращает код отказа в понятный текст.
 *
 * Все отказы здесь — про порядок и права: точка не та, рейс уже не идёт,
 * заказ не ваш. Показывать сообщение Postgres бессмысленно, а общее «что-то
 * пошло не так» не подсказывает, что делать.
 */
async function explain(locale: Locale, code: string | undefined, message: string | undefined) {
  const t = await getDictionary(locale);

  if (code === '42501') return t.trip.notYours;
  if (code === '55000' && message?.includes('по порядку')) return t.trip.outOfOrder;
  if (code === '55000') return message ?? t.trip.failed;

  return t.trip.failed;
}

async function guard(locale: Locale) {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER') {
    return (await getDictionary(locale)).error.forbidden;
  }
  return null;
}

/** «Пройдена» — с описанием повреждения, если оно есть. */
export async function completeStopAction(
  _previous: TripState,
  formData: FormData,
): Promise<TripState> {
  const locale = toLocale(formData.get('locale'));

  const forbidden = await guard(locale);
  if (forbidden) return { error: forbidden };

  const supabase = await createClient();
  const { error } = await supabase.rpc('complete_stop', {
    p_stop_id: String(formData.get('stop_id') ?? ''),
    p_damage_note: String(formData.get('damage_note') ?? '').trim() || undefined,
  });

  revalidatePath(`/${locale}/carrier`, 'layout');

  return { error: error ? await explain(locale, error.code, error.message) : null };
}

/** Снятие отметки с последней пройденной точки: ошибочные нажатия неизбежны. */
export async function uncompleteStopAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  if (await guard(locale)) return;

  const supabase = await createClient();
  await supabase.rpc('uncomplete_stop', {
    p_stop_id: String(formData.get('stop_id') ?? ''),
  });

  revalidatePath(`/${locale}/carrier`, 'layout');
}
