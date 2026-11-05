'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button, Card, CardBody, Field, Input, InputMono, Select } from '@/components/ui';
import { addFuelEntryAction, type FuelEntryState } from '@/lib/fuel/actions';
import { FUEL_PRODUCTS, fuelUnit, type FuelProduct } from '@/lib/fuel/fuel';
import { useI18n } from '@/lib/i18n/provider';
import { CURRENCIES, type Currency } from '@/lib/money/currency';

const initial: FuelEntryState = { error: null, done: false };

/** Заправка вручную: то, чего нет ни у водителя, ни в отчёте заправщика. */
export function FuelEntryForm({ vehicles }: { vehicles: { id: string; plate: string }[] }) {
  const { t, f, locale } = useI18n();
  const s = t.fuel;
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<FuelProduct>('DIESEL');
  /* Валюта чека: по умолчанию — компании; заправка за границей — местная. */
  const [currency, setCurrency] = useState<Currency>(f.currency);
  const [state, action, pending] = useActionState(addFuelEntryAction, initial);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.done) form.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardBody>
        {!open ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-[13px] font-semibold">{s.add}</h3>
            <p className="text-[12px] leading-relaxed text-ink-muted">{s.addHint}</p>
            <div>
              <Button onClick={() => setOpen(true)} disabled={vehicles.length === 0}>
                {s.add}
              </Button>
            </div>
          </div>
        ) : (
          <form ref={form} action={action} className="grid grid-cols-2 gap-3">
            <input type="hidden" name="locale" value={locale} />
            <h3 className="col-span-2 text-[13px] font-semibold">{s.add}</h3>
            <Field label={s.colVehicle} required>
              {(p) => (
                <Select {...p} name="vehicle_id" required>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={s.colDate} required>
              {(p) => <Input {...p} type="datetime-local" name="filled_at" required />}
            </Field>
            <Field label={s.colProduct} required>
              {(p) => (
                <Select {...p} name="product" value={product} onChange={(e) => setProduct(e.target.value as FuelProduct)}>
                  {FUEL_PRODUCTS.map((code) => (
                    <option key={code} value={code}>
                      {t.fuelDriver.products[code]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={`${s.colQty}, ${fuelUnit(product)}`} required>
              {(p) => <InputMono {...p} name="quantity" inputMode="decimal" required />}
            </Field>
            <div className="flex items-end gap-2">
              <Field label={f.label(s.amountVat, currency)} className="flex-1">
                {(p) => <InputMono {...p} name="amount" inputMode="decimal" />}
              </Field>
              <Select
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                aria-label={f.label(s.amountVat, currency)}
                className="w-24 font-mono"
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </div>
            <Field label={s.colOdometer}>{(p) => <InputMono {...p} name="odometer_km" inputMode="numeric" />}</Field>
            <Field label={s.colStation} className="col-span-2">
              {(p) => <Input {...p} name="station" maxLength={120} />}
            </Field>
            <label className="col-span-2 flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="full_tank" value="1" defaultChecked />
              {t.fuelDriver.fullTank}
            </label>
            {state.error && <p className="col-span-2 text-xs text-danger">{state.error}</p>}
            {state.done && <p className="col-span-2 text-xs text-ok">{t.fuelDriver.saved}</p>}
            <div className="col-span-2 flex gap-2">
              <Button type="submit" variant="primary" disabled={pending}>
                {s.save}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t.action.close}
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
