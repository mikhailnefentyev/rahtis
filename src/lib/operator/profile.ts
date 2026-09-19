import 'server-only';

import { cache } from 'react';
import { APP } from '@/lib/config';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/types/database';

/**
 * Реквизиты оператора — Aivomaa Oy.
 *
 * Источник один: строка operator_profile, которую оператор правит в
 * админке. Счёт, сводка периода, отчёт и письмо о счёте берут реквизиты
 * отсюда, а не из констант: адрес или банк меняются, а документ обязан
 * печатать действующие.
 *
 * Служебным ключом: документы выпускаются и по расписанию, без сессии.
 * Строка при этом не секретна — она печатается на каждом счёте.
 *
 * Если строки нет (база поднята без миграции), документ не падает, а
 * получает имя и Y-tunnus из config.ts — меньше, чем нужно счёту, но
 * лучше, чем документ без продавца.
 */

export type OperatorProfile = Tables<'operator_profile'>;

export const getOperatorProfile = cache(async (): Promise<OperatorProfile> => {
  const { data } = await createAdminClient().from('operator_profile').select('*').maybeSingle();

  return (
    data ?? {
      singleton: true,
      brand: APP.name,
      legal_name: APP.operator.legalName,
      business_id: APP.operator.businessId,
      vat_number: null,
      street: '',
      postal_code: '',
      city: '',
      country: APP.operator.country,
      email: APP.operator.email,
      phone: null,
      website: null,
      iban: null,
      bic: null,
      bank_name: null,
      einvoice_ovt: null,
      einvoice_operator: null,
      updated_at: new Date(0).toISOString(),
      updated_by: null,
    }
  );
});

/** IBAN группами по четыре — так его читают и переписывают без ошибок. */
export function formatIban(iban: string | null): string | null {
  return iban
    ? iban
        .replace(/\s/g, '')
        .replace(/(.{4})/g, '$1 ')
        .trim()
    : null;
}

/**
 * Реквизиты строками — для шапки документа и фактов письма.
 *
 * Подписи приходят от вызывающего: документ бывает финским и английским,
 * а сами реквизиты языка не имеют.
 */
export function operatorLines(
  p: OperatorProfile,
  labels: { businessId: string; vatNumber: string },
): string[] {
  const address = [p.street, [p.postal_code, p.city].filter(Boolean).join(' '), p.country]
    .filter(Boolean)
    .join(', ');
  const ids = [
    `${labels.businessId} ${p.business_id}`,
    p.vat_number ? `${labels.vatNumber} ${p.vat_number}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const bank = [p.iban ? `IBAN ${formatIban(p.iban)}` : null, p.bic ? `BIC ${p.bic}` : null]
    .filter(Boolean)
    .join(' · ');

  return [p.legal_name, address, ids, bank, p.email].filter((line) => line && line.trim());
}
