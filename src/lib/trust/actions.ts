'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { explainAdmin, withAdminError } from '@/lib/admin/errors';
import { requireRole } from '@/lib/auth/guard';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { TablesInsert } from '@/types/database';
import { parseReport } from './model';

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

export type PaymentReportState = { error: string | null; saved: boolean };

/**
 * Отметка перевозчика об оплате прямого рейса. Право и окно 180 дней
 * проверяет база (политика и триггер direct_payment_reports); здесь —
 * разбор формы и понятный текст ошибки.
 */
export async function reportPaymentAction(_previous: PaymentReportState, formData: FormData): Promise<PaymentReportState> {
  const locale = toLocale(formData.get('locale'));
  const tr = (await getDictionary(locale)).trust;
  await requireRole(locale, 'CARRIER');

  const orderId = String(formData.get('order_id') ?? '');
  const parsed = parseReport(formData.get('status'), formData.get('days_late'), formData.get('note'));
  if (!parsed.ok) {
    return { error: parsed.error === 'days' ? tr.reportDaysError : parsed.error === 'note' ? tr.reportNoteError : tr.reportFailed, saved: false };
  }

  const supabase = await createClient();
  const values = { status: parsed.status, days_late: parsed.daysLate, note: parsed.note };
  const { data: existing } = await supabase.from('direct_payment_reports').select('id').eq('order_id', orderId).maybeSingle();
  const { error } = existing
    ? await supabase.from('direct_payment_reports').update(values).eq('id', existing.id)
    : await supabase
        .from('direct_payment_reports')
        /*
         * Перевозчика и заказчика ставит триггер базы; передать их перевозчику
         * не дают поколоночные права. Сгенерированный тип этого не знает.
         */
        .insert({ order_id: orderId, ...values } as TablesInsert<'direct_payment_reports'>);

  if (error) {
    console.error('Отметка об оплате не записана:', error.message);
    return { error: error.code === '42501' ? tr.reportClosed : tr.reportFailed, saved: false };
  }

  revalidatePath(`/${locale}/carrier/done`);
  revalidatePath(`/${locale}/carrier`);
  return { error: null, saved: true };
}

/** Оператор снимает отметку, оказавшуюся неверной, или возвращает её. */
export async function moderatePaymentReportAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') throw new Error('forbidden');

  const reportId = String(formData.get('report_id') ?? '');
  const remove = formData.get('remove') === '1';
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000);
  const back = String(formData.get('back') ?? '');
  const returnTo = back.startsWith(`/${locale}/admin`) ? back : `/${locale}/admin`;

  const supabase = await createClient();
  const { error } = await supabase.rpc('moderate_payment_report', {
    p_report_id: reportId,
    p_remove: remove,
    p_note: note || undefined,
  });

  revalidatePath(`/${locale}/admin`, 'layout');
  if (error) {
    console.error('Отметка об оплате не изменена:', error.message);
    redirect(withAdminError(returnTo, explainAdmin(error) ?? 'generic'));
  }
  redirect(returnTo);
}
