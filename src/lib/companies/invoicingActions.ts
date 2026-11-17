'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';

export type InvoicingState = { error: string | null; saved: boolean };

/**
 * Недельный счёт заказчику от имени перевозчика (17.11.2026): по
 * умолчанию RAHTIS составляет и отправляет его по понедельникам. Кто
 * выставляет счета из своей бухгалтерии, выключает — иначе заказчик
 * получил бы два счёта за одни рейсы. Меняет главный, не диспетчер.
 */
export async function saveWeeklyInvoicingAction(_previous: InvoicingState, formData: FormData): Promise<InvoicingState> {
  const raw = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);
  const viewer = await getViewer();
  if (
    viewer.status !== 'ready' ||
    !viewer.company ||
    viewer.company.kind !== 'CARRIER' ||
    viewer.profile.member_kind === 'DISPATCHER'
  ) {
    return { error: t.forwarder.roleOwnerOnly, saved: false };
  }

  const enabled = formData.get('weekly_invoicing') === '1';
  const supabase = await createClient();
  const { error } = await supabase.from('companies').update({ weekly_invoicing: enabled }).eq('id', viewer.company.id);
  if (error) return { error: t.forwarder.roleError, saved: false };

  revalidatePath(`/${locale}/account`);
  return { error: null, saved: true };
}
