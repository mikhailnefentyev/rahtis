'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

export type OperatorState = { error: string | null; saved: boolean };

const FIELDS = [
  'legal_name',
  'business_id',
  'vat_number',
  'street',
  'postal_code',
  'city',
  'country',
  'email',
  'phone',
  'website',
  'iban',
  'bic',
  'bank_name',
  'einvoice_ovt',
  'einvoice_operator',
] as const;

/**
 * Сохранить реквизиты оператора.
 *
 * Проверки формы здесь только те, без которых база ответит непонятно:
 * обязательные поля и форма Y-tunnus. IBAN проверяет база тем же
 * app.is_valid_iban, что у компаний, — второй реализации контрольной
 * суммы в приложении не нужно.
 */
export async function saveOperatorProfileAction(
  _previous: OperatorState,
  formData: FormData,
): Promise<OperatorState> {
  const raw = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') {
    return { error: t.error.forbidden, saved: false };
  }

  const payload = Object.fromEntries(
    FIELDS.map((field) => [field, String(formData.get(field) ?? '').trim()]),
  );

  for (const field of ['legal_name', 'business_id', 'street', 'postal_code', 'city', 'email']) {
    if (!payload[field]) return { error: t.validation.required, saved: false };
  }
  if (!/^\d{7}-\d$/.test(payload.business_id!))
    return { error: t.operator.businessIdShape, saved: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc('update_operator_profile', { p: payload });

  if (error) {
    console.error('operator profile not saved:', error.message);
    return {
      error: error.message.includes('operator_iban_valid')
        ? t.operator.ibanInvalid
        : t.operator.failed,
      saved: false,
    };
  }

  revalidatePath(`/${locale}/admin/operator`);
  return { error: null, saved: true };
}
