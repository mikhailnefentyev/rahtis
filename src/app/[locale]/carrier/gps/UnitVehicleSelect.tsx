'use client';

import { useRef } from 'react';
import { Select } from '@/components/ui';
import { mapGpsUnitAction } from '@/lib/gps/actions';
import { useI18n } from '@/lib/i18n/provider';

/** Какая машина автопарка стоит за машиной Wialon. Сохраняется сразу при выборе. */
export function UnitVehicleSelect({
  unitId,
  vehicleId,
  vehicles,
}: {
  unitId: string;
  vehicleId: string | null;
  vehicles: { id: string; plate: string }[];
}) {
  const { t, locale } = useI18n();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={mapGpsUnitAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="unit_id" value={unitId} />
      <Select
        name="vehicle_id"
        aria-label={t.gps.colVehicle}
        defaultValue={vehicleId ?? ''}
        onChange={() => form.current?.requestSubmit()}
        className="min-w-32"
      >
        <option value="">{t.gps.notLinked}</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.plate}
          </option>
        ))}
      </Select>
    </form>
  );
}
