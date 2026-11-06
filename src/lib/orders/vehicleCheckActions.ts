'use server';

import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, defaultLocale } from '@/lib/i18n';
import { flashError } from '@/lib/forms/flash';
import { revalidateOrder } from '@/lib/orders/revalidate';
import { createClient } from '@/lib/supabase/server';

/**
 * «Всё в порядке» по сверке машины: сторона рейса подтверждает
 * расхождение с причиной. Кто и когда — пишет база (confirm_vehicle_check).
 */
export async function confirmVehicleCheckAction(formData: FormData): Promise<void> {
  const raw = String(formData.get('locale') ?? '');
  const locale = isLocale(raw) ? raw : defaultLocale;
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || (viewer.role !== 'CARRIER' && viewer.role !== 'SHIPPER')) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc('confirm_vehicle_check', {
    p_check_id: String(formData.get('check_id') ?? ''),
    p_reason: String(formData.get('reason') ?? '').trim().slice(0, 500),
  });
  if (error) {
    console.error('сверка не подтверждена:', error.message);
    await flashError((await getDictionary(locale)).vehicleCheck.failed);
  }
  revalidateOrder(locale);
}
