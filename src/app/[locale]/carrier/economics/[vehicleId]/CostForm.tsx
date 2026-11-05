'use client';

import { useActionState, useState } from 'react';
import { Button, Card, CardBody, Field, Input, Select } from '@/components/ui';
import { addVehicleCostAction, type CostState } from '@/lib/economics/actions';
import { useI18n } from '@/lib/i18n/provider';
import { CURRENCIES, type Currency } from '@/lib/money/currency';

const initial: CostState = { error: null, done: false };

const CATEGORIES = ['REPAIR', 'PARTS', 'TYRES', 'TOLLS', 'PARKING', 'WASH', 'FINE', 'OTHER'] as const;

/** Разовый расход машины: дата, вид, сумма без ALV в своей валюте (по умолчанию — компании), пометка. */
export function CostForm({ vehicleId, today }: { vehicleId: string; today: string }) {
  const { t, f, locale } = useI18n();
  const s = t.economics;
  const [currency, setCurrency] = useState<Currency>(f.currency);
  const [state, action, pending] = useActionState(addVehicleCostAction, initial);

  return (
    <Card>
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="vehicle_id" value={vehicleId} />
          <h3 className="text-[13px] font-semibold">{s.costAdd}</h3>
          <div className="grid gap-3 sm:grid-cols-[10rem_12rem_15rem_minmax(0,1fr)]">
            <Field label={s.spentOn} required>
              {(p) => <Input {...p} name="spent_on" type="date" required defaultValue={today} />}
            </Field>
            <Field label={s.category} required>
              {(p) => (
                <Select {...p} name="category" defaultValue="REPAIR">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {s.categories[c]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="flex items-end gap-2">
              <Field label={f.label(s.amount, currency)} required className="flex-1">
                {(p) => <Input {...p} name="amount" inputMode="decimal" required placeholder="0" />}
              </Field>
              <Select
                name="currency"
                value={currency}
                onChange={(ev) => setCurrency(ev.target.value as Currency)}
                aria-label={t.orderForm.currency}
                className="w-24 font-mono"
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </div>
            <Field label={s.note}>{(p) => <Input {...p} name="note" maxLength={200} />}</Field>
          </div>
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          {state.done && <p className="text-xs text-ok">{s.saved}</p>}
          <div>
            <Button type="submit" disabled={pending}>
              {s.costAddButton}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
