'use client';

import { useState } from 'react';
import { Field, Input, InputMono, Select } from '@/components/ui';
import type { HaulKind } from '@/lib/orders/haul';
import { useI18n } from '@/lib/i18n/provider';
import type { CarrierClient, OwnVehicle } from '@/types/db';

/**
 * Клиент и машина своего рейса — последним блоком формы вместо выбора
 * «стол или напрямую».
 *
 * Клиент берётся из справочника или заводится здесь же: имя обязательно,
 * Y-tunnus и почта — нет. Почта нужна только для ссылки на ход рейса.
 *
 * Машины — только подходящие единице: тягач для прицепа и контейнера,
 * фургон или грузовик для экспресса. Не выходящие на рейсы не
 * показываются, занятые — с пометкой: второй рейс в очередь бывает.
 */
export function OwnPicker({
  clients,
  vehicles,
  haulKind,
}: {
  clients: CarrierClient[];
  vehicles: OwnVehicle[];
  haulKind: HaulKind;
}) {
  const { t } = useI18n();
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const chosen = clients.find((c) => c.id === clientId) ?? null;
  const unit = haulKind === 'TRAILER' || haulKind === 'CONTAINER';
  const fitting = vehicles.filter(
    (v) => v.available && (unit ? v.vehicle_class === 'TRACTOR' : v.vehicle_class !== 'TRACTOR'),
  );
  const optional = ` (${t.own.optional})`;

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="label-micro mb-2">{t.own.clientSection}</legend>
        {clients.length > 0 && (
          <Field label={t.own.clientPick} className="sm:col-span-3">
            {(p) => (
              <Select {...p} name="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.business_id ? ` · ${c.business_id}` : ''}
                  </option>
                ))}
                <option value="">{t.own.clientNew}</option>
              </Select>
            )}
          </Field>
        )}
        {!chosen && (
          <>
            <Field label={t.own.clientName} required>
              {(p) => <Input {...p} name="client_name" required minLength={2} maxLength={200} autoComplete="organization" />}
            </Field>
            <Field label={`${t.own.clientBusinessId}${optional}`}>
              {(p) => <InputMono {...p} name="client_business_id" placeholder="1234567-8" pattern="\d{7}-\d" />}
            </Field>
          </>
        )}
        <Field
          key={clientId}
          label={`${t.own.clientEmail}${optional}`}
          hint={t.own.clientEmailHint}
          className={chosen ? 'sm:col-span-3' : undefined}
        >
          {(p) => (
            <Input {...p} name="client_email" type="email" autoComplete="email" defaultValue={chosen?.contact_email ?? ''} />
          )}
        </Field>
      </fieldset>

      <Field label={t.own.vehicle} required>
        {(p) =>
          fitting.length === 0 ? (
            <p id={p.id} className="text-[13px] text-warn" role="status">
              {t.own.noVehicles}
            </p>
          ) : (
            <Select {...p} name="own_vehicle_id" required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {fitting.map((v) => (
                <option key={v.vehicle_id} value={v.vehicle_id}>
                  {v.plate} · {v.driver_name ?? '—'}
                  {v.busy ? ` · ${t.own.busy}` : ''}
                </option>
              ))}
            </Select>
          )
        }
      </Field>
    </div>
  );
}
