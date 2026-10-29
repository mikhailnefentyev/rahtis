'use client';

import { useActionState, useState } from 'react';
import { Button, Card, CardBody, Field, Input, Select } from '@/components/ui';
import { saveVehicleFinanceAction, type FinanceState } from '@/lib/economics/actions';
import { centsToInput } from '@/lib/economics/money';
import type { VehicleFinance } from '@/lib/economics/profit';
import { useI18n } from '@/lib/i18n/provider';

const initial: FinanceState = { error: null, done: false };

/**
 * Финансы машины: за сколько куплена, сразу или в кредит / рассрочку /
 * лизинг и платёж в месяц, страховка, каско, налог, прочее постоянное.
 * Суммы без ALV.
 */
export function FinanceForm({ vehicleId, finance }: { vehicleId: string; finance: VehicleFinance | null }) {
  const { t, locale } = useI18n();
  const s = t.economics;
  const [state, action, pending] = useActionState(saveVehicleFinanceAction, initial);
  const [financing, setFinancing] = useState(finance?.financing ?? 'CASH');
  const money = (name: string, labelText: string, cents: number | null | undefined, hint?: string) => (
    <Field label={labelText} hint={hint}>
      {(p) => <Input {...p} name={name} inputMode="decimal" defaultValue={centsToInput(cents)} placeholder="0" />}
    </Field>
  );

  return (
    <Card>
      <CardBody>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="vehicle_id" value={vehicleId} />
          <h3 className="text-[13px] font-semibold">{s.financeTitle}</h3>

          <div className="grid gap-3 sm:grid-cols-3">
            {money('purchase_price', s.purchasePrice, finance?.purchase_price_cents)}
            <Field label={s.purchasedOn}>
              {(p) => <Input {...p} name="purchased_on" type="date" defaultValue={finance?.purchased_on ?? ''} />}
            </Field>
            <Field label={s.financing}>
              {(p) => (
                <Select {...p} name="financing" value={financing} onChange={(e) => setFinancing(e.target.value as VehicleFinance['financing'])}>
                  {(['CASH', 'LOAN', 'INSTALLMENT', 'LEASING'] as const).map((k) => (
                    <option key={k} value={k}>
                      {s.financingKinds[k]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          {financing === 'CASH' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={s.usefulLife} hint={s.usefulLifeHint}>
                {(p) => <Input {...p} name="useful_life_months" inputMode="numeric" defaultValue={String(finance?.useful_life_months ?? 60)} />}
              </Field>
              {money('residual', s.residual, finance?.residual_cents, s.residualHint)}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {money('monthly_payment', s.monthlyPayment, finance?.monthly_payment_cents)}
              <Field label={s.paymentsUntil}>
                {(p) => <Input {...p} name="payments_until" type="date" defaultValue={finance?.payments_until ?? ''} />}
              </Field>
              <input type="hidden" name="useful_life_months" value={String(finance?.useful_life_months ?? 60)} />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            {money('insurance_year', s.insuranceYear, finance?.insurance_cents_year)}
            {money('kasko_year', s.kaskoYear, finance?.kasko_cents_year)}
            {money('tax_year', s.taxYear, finance?.tax_cents_year)}
            {money('other_fixed_month', s.otherFixedMonth, finance?.other_fixed_cents_month, s.otherFixedHint)}
          </div>

          <p className="text-[12px] text-ink-dim">{s.vatNote}</p>
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          {state.done && <p className="text-xs text-ok">{s.saved}</p>}
          <div>
            <Button type="submit" variant="primary" disabled={pending}>
              {s.save}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
