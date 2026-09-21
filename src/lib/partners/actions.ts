'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Постоянная работа: согласие перевозчика и пул машин заказчика.
 *
 * Проверки — в функциях базы (set_shipper_link, pool_add_vehicle):
 * машина должна быть знакомой, а согласие — действующим. Здесь только
 * вызов и пересборка страниц.
 */

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

/** Перевозчик разрешает или отзывает прямые заказы от заказчика. */
export async function setShipperLinkAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER') throw new Error('forbidden');

  const supabase = await createClient();
  await supabase.rpc('set_shipper_link', {
    p_shipper_id: String(formData.get('shipper_id') ?? ''),
    p_allow: formData.get('allow') === '1',
  });

  revalidatePath(`/${locale}/carrier/partners`);
}

/** Заказчик добавляет знакомую машину в постоянные или убирает её. */
export async function poolVehicleAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'SHIPPER') throw new Error('forbidden');

  const supabase = await createClient();
  const vehicleId = String(formData.get('vehicle_id') ?? '');

  await supabase.rpc(formData.get('add') === '1' ? 'pool_add_vehicle' : 'pool_remove_vehicle', {
    p_vehicle_id: vehicleId,
  });

  revalidatePath(`/${locale}/shipper/vehicles`);
  revalidatePath(`/${locale}/shipper/orders`);
}
