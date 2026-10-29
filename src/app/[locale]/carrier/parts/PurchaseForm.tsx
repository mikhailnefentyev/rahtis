'use client';

import { useActionState } from 'react';
import { Button, Card, CardBody, Field, Input, Select } from '@/components/ui';
import { addVehicleCostAction, type CostState } from '@/lib/economics/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: CostState = { error: null, done: false };

/**
 * Записать покупку: деталь, работу или шины — в журнал расходов машины,
 * откуда она сразу попадает в доходность (Kannattavuus). Поставщик — из
 * найденных или свой, в пометке — что искали (номер детали, размер шины).
 */
export function PurchaseForm({
  vehicles,
  vehicleId,
  suppliers,
  query,
  tyres,
  today,
}: {
  vehicles: { id: string; plate: string; make: string | null }[];
  vehicleId: string;
  suppliers: string[];
  query: string;
  tyres: boolean;
  today: string;
}) {
  const { t, locale } = useI18n();
  const s = t.parts;
  const e = t.economics;
  const [state, action, pending] = useActionState(addVehicleCostAction, initial);

  return (
    <Card>
      <CardBody>
        {/* key: новая форма на новый поиск — значения по умолчанию подставляются заново. */}
        <form key={`${query}|${tyres}|${vehicleId}`} action={action} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          <h3 className="text-[13px] font-semibold">{s.purchaseTitle}</h3>
          <p className="text-[12px] leading-relaxed text-ink-muted">{s.purchaseHint}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={e.colVehicle} required>
              {(p) => (
                <Select {...p} name="vehicle_id" defaultValue={vehicleId} required>
                  <option value="">—</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate}
                      {v.make ? ` · ${v.make}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={e.spentOn} required>
              {(p) => <Input {...p} name="spent_on" type="date" required defaultValue={today} />}
            </Field>
            <Field label={e.category} required>
              {(p) => (
                <Select {...p} name="category" defaultValue={tyres ? 'TYRES' : 'PARTS'}>
                  {(['PARTS', 'REPAIR', 'TYRES'] as const).map((c) => (
                    <option key={c} value={c}>
                      {e.categories[c]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)]">
            <Field label={s.supplier}>
              {(p) => <Input {...p} name="supplier" list="parts-suppliers" maxLength={120} defaultValue={suppliers[0] ?? ''} />}
            </Field>
            <datalist id="parts-suppliers">
              {suppliers.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <Field label={e.amount} required>
              {(p) => <Input {...p} name="amount" inputMode="decimal" required placeholder="0" />}
            </Field>
            <Field label={e.note}>{(p) => <Input {...p} name="note" maxLength={200} defaultValue={query} />}</Field>
          </div>
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          {state.done && (
            <p className="text-xs text-ok">
              {s.purchaseSaved}{' '}
              <a href={`/${locale}/carrier/economics`} className="text-accent underline">
                {e.title} ›
              </a>
            </p>
          )}
          <div>
            <Button type="submit" variant="primary" disabled={pending}>
              {s.purchaseSave}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
