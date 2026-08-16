'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import {
  isValidBic,
  isValidEinvoiceOperator,
  isValidIban,
  isValidOvt,
  isValidVatNumber,
  normalizeIban,
} from '@/lib/banking';
import { getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

export type RequisitesState = { error: string | null; done: boolean };

const text = (form: FormData, key: string): string | null => {
  const value = String(form.get(key) ?? '').trim();
  return value.length > 0 ? value : null;
};

/**
 * Сохранение реквизитов и активация компании.
 *
 * Два шага, и это осознанно. Реквизиты пишутся обычным UPDATE под правами
 * пользователя — колоночные гранты разрешают ровно эти колонки и не
 * разрешают статус. Активацию делает функция activate_company: она
 * проверяет полноту и переводит статус в обход грантов.
 *
 * Если между шагами что-то оборвётся, реквизиты останутся сохранёнными,
 * а компания — одобренной. Это безобидно: человек вернётся на ту же форму
 * с заполненными полями и нажмёт ещё раз.
 */
export async function saveRequisitesAction(
  _previous: RequisitesState,
  formData: FormData,
): Promise<RequisitesState> {
  const rawLocale = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'ru';
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || !viewer.company) {
    return { error: t.error.forbidden, done: false };
  }

  const company = viewer.company;
  const isCarrier = company.kind === 'CARRIER';

  const vat = text(formData, 'vat_number')?.replace(/\s+/g, '').toUpperCase() ?? null;
  const iban = text(formData, 'iban');
  const bic = text(formData, 'bic')?.replace(/\s+/g, '').toUpperCase() ?? null;
  const ovt = text(formData, 'einvoice_ovt')?.replace(/\s+/g, '') ?? null;
  const operator = text(formData, 'einvoice_operator')?.replace(/\s+/g, '') ?? null;

  /* Те же правила стоят ограничениями в таблице — здесь ради понятного текста. */
  if (vat && !isValidVatNumber(vat)) return { error: t.requisites.vatInvalid, done: false };
  if (iban && !isValidIban(iban)) return { error: t.requisites.ibanInvalid, done: false };
  if (bic && !isValidBic(bic)) return { error: t.requisites.bicInvalid, done: false };
  if (ovt && !isValidOvt(ovt)) return { error: t.requisites.ovtInvalid, done: false };
  if (operator && !isValidEinvoiceOperator(operator)) {
    return { error: t.requisites.operatorInvalid, done: false };
  }

  /* Галочка «совпадает с юридическим» означает пустой адрес для счетов. */
  const sameAddress = formData.get('billing_same') === 'on';

  const patch = {
    legal_name: text(formData, 'legal_name'),
    legal_street: text(formData, 'legal_street'),
    legal_postal_code: text(formData, 'legal_postal_code'),
    legal_city: text(formData, 'legal_city'),
    legal_country: (text(formData, 'legal_country') ?? 'FI').toUpperCase(),
    vat_number: vat,

    billing_street: isCarrier || sameAddress ? null : text(formData, 'billing_street'),
    billing_postal_code: isCarrier || sameAddress ? null : text(formData, 'billing_postal_code'),
    billing_city: isCarrier || sameAddress ? null : text(formData, 'billing_city'),
    billing_country: isCarrier || sameAddress
      ? null
      : text(formData, 'billing_country')?.toUpperCase() ?? null,
    billing_email: isCarrier
      ? null
      : text(formData, 'billing_email')?.toLowerCase() ?? null,
    billing_reference: isCarrier ? null : text(formData, 'billing_reference'),
    einvoice_ovt: isCarrier ? null : ovt,
    einvoice_operator: isCarrier ? null : operator,

    iban: isCarrier ? (iban ? normalizeIban(iban) : null) : null,
    bic: isCarrier ? bic : null,
  };

  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from('companies')
    .update(patch)
    .eq('id', company.id);

  if (updateError) {
    return { error: t.requisites.failed, done: false };
  }

  const { error: activateError } = await supabase.rpc('activate_company', {
    p_company_id: company.id,
  });

  if (activateError) {
    /* 23514 — функция сообщила о неполных реквизитах. */
    return {
      error: activateError.code === '23514' ? t.requisites.incomplete : t.requisites.failed,
      done: false,
    };
  }

  revalidatePath(`/${locale}`, 'layout');
  return { error: null, done: true };
}
