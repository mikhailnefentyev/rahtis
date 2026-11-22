'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { parseFreightInvoice } from './schedule';

/*
 * Счёт перевозчика заказчику по прямому рейсу и отметки об оплате
 * (20261106170000_trust_quick_wins). Права, окно и стороны проверяют
 * функции базы; здесь — разбор формы и понятный текст ошибки.
 */

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

export type InvoiceFormState = { error: string | null; saved: boolean };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Перевозчик: «счёт отправлен» (или правка неоплаченного). */
export async function saveFreightInvoiceAction(_previous: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const locale = toLocale(formData.get('locale'));
  const tw = (await getDictionary(locale)).trustWins;
  const viewer = await requireRole(locale, 'CARRIER');

  const parsed = parseFreightInvoice({
    number: formData.get('number'),
    amount: formData.get('amount'),
    currency: formData.get('currency'),
    issuedOn: formData.get('issued_on'),
    dueOn: formData.get('due_on'),
    sendTo: formData.get('send_to'),
  });
  if (!parsed.ok) {
    const errors = { number: tw.errNumber, amount: tw.errAmount, currency: tw.errCurrency, dates: tw.errDates, email: tw.errEmail };
    return { error: errors[parsed.error], saved: false };
  }

  const orderId = String(formData.get('order_id') ?? '');
  /*
   * Рейс уже в недельном счёте RAHTIS (17.11.2026) — второй счёт за него был
   * бы двойным. Колонка orders.carrier_invoice_id перевозчику не выдана
   * (права на orders поимённые): чтение под сессией падало с 42501, ошибку
   * никто не смотрел, и проверка проходила всегда (22.11.2026). Читаем
   * служебным ключом и только свой рейс; главная проверка — в самой
   * save_freight_invoice (код 55006).
   */
  const { data: order, error: orderError } = await createAdminClient()
    .from('orders')
    .select('carrier_invoice_id')
    .eq('id', orderId)
    .eq('assigned_company_id', viewer.company?.id ?? '00000000-0000-0000-0000-000000000000')
    .maybeSingle();
  if (orderError) {
    console.error('счёт перевозчика: рейс не прочитан:', orderError.message);
    return { error: tw.invoiceFailed, saved: false };
  }
  if (order?.carrier_invoice_id) return { error: tw.alreadyWeekly, saved: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_freight_invoice', {
    p_order_id: orderId,
    p_number: parsed.number,
    p_amount_cents: parsed.amountCents,
    p_currency: parsed.currency,
    p_issued_on: parsed.issuedOn,
    p_due_on: parsed.dueOn,
    p_send_to: parsed.sendTo,
  });
  if (error) {
    console.error('счёт перевозчика не записан:', error.message);
    if (error.code === '55006') return { error: tw.alreadyWeekly, saved: false };
    return { error: error.code === '42501' || error.code === '55000' ? tw.invoiceClosed : tw.invoiceFailed, saved: false };
  }

  revalidatePath(`/${locale}/carrier/done`);
  revalidatePath(`/${locale}/carrier`);
  return { error: null, saved: true };
}

/** Перевозчик убирает ошибочную запись (только неоплаченный счёт). */
export async function deleteFreightInvoiceAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_freight_invoice', { p_invoice_id: String(formData.get('invoice_id') ?? '') });
  if (error) console.error('счёт перевозчика не удалён:', error.message);
  revalidatePath(`/${locale}/carrier/done`);
  revalidatePath(`/${locale}/carrier`);
}

/**
 * «Оплачен» с датой — перевозчик, заказчик или оператор (сторону решает
 * база). clear=1 — снять отметку («деньги не пришли»), только перевозчик.
 */
export async function markFreightPaidAction(_previous: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const locale = toLocale(formData.get('locale'));
  const tw = (await getDictionary(locale)).trustWins;
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return { error: tw.invoiceFailed, saved: false };

  const clear = formData.get('clear') === '1';
  const paidOn = String(formData.get('paid_on') ?? '').trim();
  if (!clear && !DATE.test(paidOn)) return { error: tw.errDates, saved: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_freight_invoice_paid', {
    p_invoice_id: String(formData.get('invoice_id') ?? ''),
    /* null снимает отметку — база это принимает; сгенерированный тип про null не знает. */
    p_paid_on: (clear ? null : paidOn) as string,
  });
  if (error) {
    console.error('оплата счёта не отмечена:', error.message);
    return { error: error.code === '22023' ? tw.errPaidDate : tw.invoiceFailed, saved: false };
  }

  revalidatePath(`/${locale}/carrier/done`);
  revalidatePath(`/${locale}/shipper/done`);
  /* Обзоры: пункт «счёт к оплате» уходит из «Требует действия». */
  revalidatePath(`/${locale}/carrier`);
  revalidatePath(`/${locale}/shipper`);
  return { error: null, saved: true };
}

/** Перевозчик подтверждает отметку заказчика «оплачен». */
export async function confirmFreightPaidAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const { error } = await supabase.rpc('confirm_freight_invoice_paid', { p_invoice_id: String(formData.get('invoice_id') ?? '') });
  if (error) console.error('оплата не подтверждена:', error.message);
  revalidatePath(`/${locale}/carrier/done`);
  revalidatePath(`/${locale}/carrier`);
}

/** Счёт объекта или счёт за перевозки (carrier_invoices): перевозчик отмечает оплату (дата) или снимает отметку. */
export async function markSiteInvoicePaidAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'CARRIER');
  const clear = formData.get('clear') === '1';
  const paidOn = String(formData.get('paid_on') ?? '').trim();
  if (!clear && !DATE.test(paidOn)) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_site_invoice_paid', {
    p_invoice_id: String(formData.get('invoice_id') ?? ''),
    /* null снимает отметку — база это принимает; сгенерированный тип про null не знает. */
    p_paid_on: (clear ? null : paidOn) as string,
  });
  if (error) console.error('оплата счёта объекта не отмечена:', error.message);
  /* Счёт за перевозки (без объекта) отмечают со страницы счетов перевозчика (22.11.2026). */
  const jobId = String(formData.get('job_id') ?? '');
  if (jobId) revalidatePath(`/${locale}/carrier/sites/${jobId}`);
  else {
    revalidatePath(`/${locale}/carrier/invoices`);
    revalidatePath(`/${locale}/carrier/done`);
  }
}
