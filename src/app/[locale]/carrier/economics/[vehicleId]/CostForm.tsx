'use client';

import { useActionState } from 'react';
import { Button, Card, CardBody, Field, Input, Select } from '@/components/ui';
import { addVehicleCostAction, type CostState } from '@/lib/economics/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: CostState = { error: null, done: false };

const CATEGORIES = ['REPAIR', 'TYRES', 'TOLLS', 'PARKING', 'WASH', 'FINE', 'OTHER'] as const;

/** Разовый расход машины: дата, вид, сумма без ALV, пометка. */
export function CostForm({ vehicleId, today }: { vehicleId: string; today: string }) {
  const { t, locale } = useI18n();
  const s = t.economics;
  const [state, action, pending] = useActionState(addVehicleCostAction, initial);

  return (
    <Card>
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="vehicle_id" value={vehicleId} />
          <h3 className="text-[13px] font-semibold">{s.costAdd}</h3>
          <div className="grid gap-3 sm:grid-cols-[10rem_12rem_9rem_minmax(0,1fr)]">
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
            <Field label={s.amount} required>
              {(p) => <Input {...p} name="amount" inputMode="decimal" required placeholder="0" />}
            </Field>
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
