'use client';

import { useActionState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { saveOperatorProfileAction, type OperatorState } from '@/lib/operator/actions';
import type { Tables } from '@/types/database';

type Profile = Tables<'operator_profile'>;

/**
 * Реквизиты Aivomaa Oy — форма оператора.
 *
 * Поля сгруппированы так, как их читают на счёте: кто, где, как платить.
 * Сохранение сразу влияет на следующие документы и письма; уже
 * выпущенные сводки лежат файлами и не переписываются.
 */
export function OperatorForm({ profile }: { profile: Profile }) {
  const { t, locale } = useI18n();
  const [state, save, pending] = useActionState<OperatorState, FormData>(
    saveOperatorProfileAction,
    {
      error: null,
      saved: false,
    },
  );

  const o = t.operator;
  const field = (name: keyof Profile, label: string, required = false, mono = false) => (
    <Field label={label} required={required}>
      {(p) => (
        <Input
          {...p}
          name={name}
          required={required}
          defaultValue={(profile[name] as string | null) ?? ''}
          className={mono ? 'font-mono' : undefined}
        />
      )}
    </Field>
  );

  return (
    <form action={save} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="label-micro mb-2">{o.company}</legend>
        {field('legal_name', o.legalName, true)}
        {field('business_id', o.businessId, true, true)}
        {field('vat_number', o.vatNumber, false, true)}
        {field('email', o.email, true)}
        {field('phone', o.phone)}
        {field('website', o.website)}
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="label-micro mb-2">{o.address}</legend>
        {field('street', o.street, true)}
        {field('postal_code', o.postalCode, true, true)}
        {field('city', o.city, true)}
        {field('country', o.country, true, true)}
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="label-micro mb-2">{o.bank}</legend>
        {field('iban', 'IBAN', false, true)}
        {field('bic', 'BIC', false, true)}
        {field('bank_name', o.bankName)}
        {field('einvoice_ovt', o.einvoiceOvt, false, true)}
        {field('einvoice_operator', o.einvoiceOperator)}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? o.saving : o.save}
        </Button>
        {state.saved && !state.error && <span className="text-xs text-ok">{o.saved}</span>}
        {state.error && (
          <span role="alert" className="text-xs text-danger">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
