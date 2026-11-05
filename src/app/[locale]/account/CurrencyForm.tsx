'use client';

import { useActionState } from 'react';
import { Button, Card, CardBody, Field, Select } from '@/components/ui';
import { saveCompanyCurrencyAction, type CurrencyState } from '@/lib/companies/currencyActions';
import { useI18n } from '@/lib/i18n/provider';
import { CURRENCIES } from '@/lib/money/currency';

const initial: CurrencyState = { error: null, saved: false };

/** Рабочая валюта компании: свои рейсы, расходы, топливо, зарплата; прямые заказы заказчика. */
export function CurrencyForm({ currency, kind, canEdit }: { currency: string; kind: 'CARRIER' | 'SHIPPER'; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const a = t.account;
  const [state, action, pending] = useActionState(saveCompanyCurrencyAction, initial);
  const names = new Intl.DisplayNames([locale], { type: 'currency' });

  return (
    <Card>
      <CardBody>
        <h2 className="text-[15px] font-semibold tracking-tight">{a.currencyTitle}</h2>
        <p className="mt-1 mb-4 max-w-xl text-[13px] leading-relaxed text-ink-muted">
          {kind === 'CARRIER' ? a.currencyHintCarrier : a.currencyHintShipper}
        </p>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="locale" value={locale} />
          <Field label={a.currencyLabel}>
            {(p) => (
              <Select {...p} name="currency" defaultValue={currency} disabled={!canEdit || pending}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c} · {names.of(c) ?? c}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {canEdit && (
            <Button type="submit" variant="primary" disabled={pending}>
              {a.currencySave}
            </Button>
          )}
          {state.error && <p className="w-full text-[13px] text-danger">{state.error}</p>}
          {state.saved && !pending && <p className="w-full text-[13px] text-ok">{a.currencySaved}</p>}
        </form>
      </CardBody>
    </Card>
  );
}
