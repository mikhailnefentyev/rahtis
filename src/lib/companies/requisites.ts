'use server';

import { revalidatePath } from 'next/cache';
import { stepUpRequired } from '@/lib/auth/mfa';
import { getViewer } from '@/lib/auth/viewer';
import {
  isValidBic,
  isValidEinvoiceOperator,
  isValidIban,
  isValidOvt,
  isValidVatNumber,
  normalizeIban,
} from '@/lib/banking';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { lookupCompany } from '@/lib/registry/prh';
import { deliverSensitiveChanges } from '@/lib/trust/sensitive';

/** stepUp — меняется счёт или почта для счетов при включённом двухэтапном входе: нужен код. */
export type RequisitesState = { error: string | null; done: boolean; stepUp?: boolean };

export type RegistryCompanyResult =
  | { found: true; name: string; street: string; postalCode: string; city: string }
  | { found: false };

/**
 * Название и адрес своей компании из PRH/YTJ — кнопка в карточке. Номер
 * берётся из компании вошедшего, а не из запроса: чужие номера через это
 * действие не проверить. NULL — компания не финская.
 */
export async function registryCompanyAction(): Promise<RegistryCompanyResult | null> {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || !viewer.company) return null;
  const company = viewer.company;
  if ((company.country ?? 'FI') !== 'FI' || !company.business_id) return null;
  const found = await lookupCompany(company.business_id);
  if (!found) return { found: false };
  return {
    found: true,
    name: found.name,
    street: found.address?.street ?? '',
    postalCode: found.address?.postalCode ?? '',
    city: found.address?.city ?? '',
  };
}

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
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
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

    /*
     * Язык переписки. Значение из формы принимается только известное:
     * колонка ограничена check-ограничением, и присланное браузером
     * «de» отвергла бы база отказом на весь патч — а вместе с ним и
     * реквизиты, которые человек как раз заполнял.
     */
    language: text(formData, 'language') === 'en' ? 'en' : 'fi',
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

    /*
     * Счёт сохраняется обеим сторонам. Раньше у заказчика он затирался в
     * null: считалось, что платить ему не за что. Возвраты и кредит-ноты
     * это опровергают, а электронные счета настроены не у всех.
     */
    iban: iban ? normalizeIban(iban) : null,
    bic,
  };

  /*
   * Счёт и почта для счетов — то, что меняет захватчик учётной записи
   * (схема подмены счёта). У кого включён двухэтапный вход, смену
   * подтверждают кодом не старше 15 минут; остальные поля — без кода.
   */
  const sensitive =
    (patch.iban ?? null) !== (company.iban ?? null) || (patch.billing_email ?? null) !== (company.billing_email ?? null);
  if (sensitive && (await stepUpRequired(viewer))) {
    return { error: t.twoStep.stepUpNeeded, done: false, stepUp: true };
  }

  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from('companies')
    .update(patch)
    .eq('id', company.id);

  if (updateError) {
    return { error: t.requisites.failed, done: false };
  }

  /* Смена счёта или почты: триггер записал событие — письма людям компании и на прежний адрес сразу. */
  await deliverSensitiveChanges().catch((cause: unknown) => console.error('письма о смене реквизитов:', cause));

  /*
   * Согласие записывается до активации, а не после.
   *
   * Активация без принятых условий запрещена в базе, и порядок здесь не
   * косметика: приняв обратный, мы бы получили активированную компанию,
   * у которой согласия нет — то есть ровно то состояние, которого закон
   * не допускает.
   *
   * Галочка обязательна, но проверять её здесь не нужно: без записи
   * согласия activate_company откажет сама.
   */
  if (formData.get('accept_legal') === 'on') {
    const { error: acceptError } = await supabase.rpc('accept_legal', {
      p_source: 'ACTIVATION',
    });
    if (acceptError) console.error('Согласие не записано:', acceptError.message);
  }

  const { error: activateError } = await supabase.rpc('activate_company', {
    p_company_id: company.id,
  });

  if (activateError) {
    /* 23514 — неполные реквизиты, 55008 — не приняты условия. */
    return {
      error:
        activateError.code === '23514'
          ? t.requisites.incomplete
          : activateError.code === '55008'
            ? t.legal.acceptRequired
            : t.requisites.failed,
      done: false,
    };
  }

  /*
   * Реквизиты доводят компанию до ACTIVE, а статус виден в шапке
   * кабинета и в списке у оператора. Витрина и условия к этому
   * отношения не имеют — сбрасывать их незачем.
   */
  revalidatePath(`/${locale}/shipper`, 'layout');
  revalidatePath(`/${locale}/carrier`, 'layout');
  revalidatePath(`/${locale}/admin`);
  return { error: null, done: true };
}
