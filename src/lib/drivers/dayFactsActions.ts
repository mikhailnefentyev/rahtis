'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { defaultLocale, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { asNight, normalizeMeals } from './allowanceDays';

/**
 * Правка дня водителя для суточных: страна, ночёвка, бесплатное питание.
 *
 * Под сессией перевозчика: чужого водителя не даст RLS
 * (app.owns_driver). Всё пусто — строка удаляется, и страна дня снова
 * берётся из точек рейсов.
 */

export type DayFactState = { ok: boolean; error: boolean };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveDayFactAction(_previous: DayFactState, formData: FormData): Promise<DayFactState> {
  const raw = String(formData.get('locale') ?? '');
  const locale = isLocale(raw) ? raw : defaultLocale;
  await requireRole(locale, 'CARRIER');

  const driverId = String(formData.get('driver_id') ?? '');
  const day = String(formData.get('day') ?? '');
  if (!UUID.test(driverId) || !DATE.test(day)) return { ok: false, error: true };

  const countryRaw = String(formData.get('country') ?? '')
    .trim()
    .toUpperCase();
  const country = /^[A-Z]{2}$/.test(countryRaw) ? countryRaw : null;
  const night = asNight(String(formData.get('night') ?? ''));
  const meals = normalizeMeals(formData.getAll('meals').map(String).join(''));

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { error } =
    !country && !night && !meals
      ? await supabase.from('driver_day_facts').delete().eq('driver_id', driverId).eq('day', day)
      : await supabase.from('driver_day_facts').upsert(
          {
            driver_id: driverId,
            day,
            country,
            night,
            meals,
            updated_by: auth.user?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'driver_id,day' },
        );
  if (error) return { ok: false, error: true };

  revalidatePath(`/${locale}/carrier/drivers/report`);
  revalidatePath(`/${locale}/carrier/drivers/${driverId}`);
  revalidatePath(`/${locale}/carrier/economics`);
  return { ok: true, error: false };
}
