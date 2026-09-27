'use server';

import { revalidatePath } from 'next/cache';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { Constants } from '@/types/database';
import type { DriverCertificateType } from '@/types/db';

/**
 * Сроки сертификатов водителя: одна пара действий для приложения и для
 * карточки водителя у перевозчика.
 *
 * Кто может писать, решает база: водитель — свои строки, перевозчик —
 * своих водителей. Дата окончания вводится, а не вычисляется (п. 6
 * задания): сроки у документов разные и меняются.
 */

export type CertificateState = { error: string | null; done: boolean };

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

function isCertificateType(value: string): value is DriverCertificateType {
  return (Constants.public.Enums.driver_certificate_type as readonly string[]).includes(value);
}

function revalidate(locale: Locale, driverId: string) {
  revalidatePath(`/${locale}/driver/profile`);
  revalidatePath(`/${locale}/carrier/drivers/${driverId}`);
}

/**
 * Добавить или продлить: одна строка на вид документа, повторный ввод
 * того же вида переписывает даты.
 */
export async function saveCertificateAction(
  _previous: CertificateState,
  formData: FormData,
): Promise<CertificateState> {
  const locale = toLocale(formData.get('locale'));
  const { certificates: t } = await getDictionary(locale);

  const driverId = str(formData, 'driver_id');
  const type = str(formData, 'type');
  const expires = str(formData, 'expires_at');
  const issued = str(formData, 'issued_at');

  if (!driverId || !isCertificateType(type) || !isDate(expires) || (issued && (!isDate(issued) || issued > expires))) {
    return { error: t.failed, done: false };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('driver_certificates')
    .upsert(
      { driver_id: driverId, type, expires_at: expires, issued_at: issued || null },
      { onConflict: 'driver_id,type' },
    );

  if (error) {
    console.error('сертификат не сохранён:', error.message);
    return { error: t.failed, done: false };
  }

  revalidate(locale, driverId);
  return { error: null, done: true };
}

export async function deleteCertificateAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const id = str(formData, 'id');
  const driverId = str(formData, 'driver_id');
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('driver_certificates').delete().eq('id', id);
  revalidate(locale, driverId);
}
