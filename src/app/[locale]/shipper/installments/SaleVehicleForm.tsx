'use client';

import { useActionState, useState } from 'react';
import { Button, Field, Input, Select } from '@/components/ui';
import { EURO_LABEL } from '@/lib/fleet/labels';
import { useI18n } from '@/lib/i18n/provider';
import {
  SALE_EURO_CLASSES,
  SALE_VEHICLE_CLASSES,
  saleVehicleHasCargo,
  type SaleEuroClass,
  type SaleVehicleClass,
} from '@/lib/installments/access';
import { saveSaleVehicleAction, type ActionState } from '@/lib/installments/actions';

const initial: ActionState = { error: null, saved: false };

/**
 * Машина на продажу у компании без парка (23.11.2026). Спрашиваем только
 * то, что нужно объявлению, договору и строке в парке покупателя после
 * передачи: номер, марка и модель, класс, эко-класс, оси; у фургона и
 * грузовика — грузоподъёмность и погрузочные метры. Пробег — в объявлении.
 * Подписи полей — те же, что в карточке машины парка.
 */
export function SaleVehicleForm({
  locale,
  vehicle,
}: {
  locale: string;
  vehicle: {
    id: string;
    plate: string;
    make: string;
    vehicleClass: SaleVehicleClass;
    euroClass: SaleEuroClass;
    axles: number;
    payloadKg: number | null;
    ldm: number | null;
  } | null;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveSaleVehicleAction, initial);
  const [vehicleClass, setVehicleClass] = useState<SaleVehicleClass>(vehicle?.vehicleClass ?? 'TRACTOR');
  const cargo = saleVehicleHasCargo(vehicleClass);
  /* Самосвал — от трёх осей (как у машины парка). */
  const axleOptions = vehicleClass === 'TIPPER' ? [3, 4, 5] : [2, 3, 4, 5];
  const axles = vehicle && axleOptions.includes(vehicle.axles) ? vehicle.axles : axleOptions[0];

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {vehicle && <input type="hidden" name="id" value={vehicle.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.vehicle.plate} required>
          {(p) => <Input {...p} name="plate" required maxLength={12} defaultValue={vehicle?.plate ?? ''} className="font-mono uppercase" />}
        </Field>
        <Field label={t.vehicle.make} required>
          {(p) => <Input {...p} name="make" required minLength={2} maxLength={80} defaultValue={vehicle?.make ?? ''} />}
        </Field>
        <Field label={t.vehicle.class} required>
          {(p) => (
            <Select {...p} name="vehicle_class" required value={vehicleClass} onChange={(e) => setVehicleClass(e.target.value as SaleVehicleClass)}>
              {SALE_VEHICLE_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {t.vehicleClass[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.vehicle.euro} required>
          {(p) => (
            <Select {...p} name="euro_class" required defaultValue={vehicle?.euroClass ?? 'EURO_6'}>
              {SALE_EURO_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {EURO_LABEL[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.vehicle.axles} required>
          {(p) => (
            /* key: при смене класса список осей другой — поле начинается заново. */
            <Select {...p} key={vehicleClass} name="axles" required defaultValue={String(axles)}>
              {axleOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {cargo && (
          <>
            <Field label={t.vehicle.payload} hint={t.vehicle.payloadHint} required>
              {(p) => (
                <Input {...p} name="payload_kg" inputMode="numeric" required defaultValue={vehicle?.payloadKg != null ? String(vehicle.payloadKg) : ''} />
              )}
            </Field>
            <Field label={t.vehicle.ldm} hint={t.vehicle.ldmHint} required>
              {(p) => (
                <Input {...p} name="ldm" inputMode="decimal" required defaultValue={vehicle?.ldm != null ? String(vehicle.ldm).replace('.', ',') : ''} />
              )}
            </Field>
          </>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-[14px] text-danger">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="send" value="1" variant="primary" disabled={pending}>
          {t.fleet.submitForApproval}
        </Button>
        <Button type="submit" name="send" value="0" disabled={pending}>
          {t.action.save}
        </Button>
      </div>
    </form>
  );
}
