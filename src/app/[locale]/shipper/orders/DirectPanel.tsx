'use client';

import { useActionState, useState } from 'react';
import { Badge, Button, Field, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import { cancelOrderAction, directAssignAction, type DirectState } from '@/lib/orders/matching';
import type { HaulKind } from '@/lib/orders/haul';
import type { KnownVehicle } from '@/types/db';

/**
 * Прямое назначение знакомой машине — у заказчика.
 *
 * Три куска одного потока: выбор в форме публикации, ожидание
 * подтверждения на карточке и отправка со стола, пока никто не
 * откликнулся.
 */

/**
 * Какие знакомые машины вообще подходят заказу этой единицы.
 *
 * Только по ветке: тягач — для полуприцепа и контейнера, фургон и
 * грузовик — для экспресса. Размер и вес проверит база при назначении и
 * скажет словами; здесь отсекается лишь то, что заведомо не возьмёт.
 */
export function fittingVehicles(vehicles: KnownVehicle[], haulKind: HaulKind): KnownVehicle[] {
  const unit = haulKind === 'TRAILER' || haulKind === 'CONTAINER';
  return vehicles
    .filter((v) => (unit ? v.vehicle_class === 'TRACTOR' : v.vehicle_class !== 'TRACTOR'))
    .filter((v) => v.available)
    .sort((a, b) => Number(b.in_pool) - Number(a.in_pool));
}

function VehicleOptions({ vehicles }: { vehicles: KnownVehicle[] }) {
  const { t } = useI18n();
  return (
    <>
      {vehicles.map((v) => (
        <option key={v.vehicle_id} value={v.vehicle_id}>
          {v.plate} · {v.driver_name ?? '—'}
          {v.in_pool ? ` · ${t.known.pool}` : ''}
          {v.busy ? ` · ${t.known.busy}` : ''}
        </option>
      ))}
    </>
  );
}

/** Выбор потока в форме публикации: общий стол или своя машина. */
export function DispatchPicker({
  vehicles,
  haulKind,
}: {
  vehicles: KnownVehicle[];
  haulKind: HaulKind;
}) {
  const { t } = useI18n();
  const fitting = fittingVehicles(vehicles, haulKind);
  const [mode, setMode] = useState<'DESK' | 'DIRECT'>('DESK');
  const [vehicleId, setVehicleId] = useState('');

  const chosen = fitting.find((v) => v.vehicle_id === vehicleId) ?? null;
  const direct = mode === 'DIRECT' && fitting.length > 0;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="label-micro mb-1">{t.direct.dispatch}</legend>
      <input type="hidden" name="dispatch" value={direct ? 'DIRECT' : 'DESK'} />

      <div className="grid gap-2 sm:grid-cols-2">
        {(['DESK', 'DIRECT'] as const).map((value) => {
          const disabled = value === 'DIRECT' && fitting.length === 0;
          const on = (value === 'DIRECT') === direct;
          return (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer flex-col gap-1 rounded-control border px-3 py-2.5',
                on ? 'border-accent' : 'border-line hover:border-line-strong',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                <input
                  type="radio"
                  name="dispatch_choice"
                  value={value}
                  checked={on}
                  disabled={disabled}
                  onChange={() => setMode(value)}
                  className="accent-[var(--color-accent)]"
                />
                {value === 'DESK' ? t.direct.desk : t.direct.direct}
              </span>
              <span className="text-xs text-ink-muted">
                {value === 'DESK'
                  ? t.direct.deskHint
                  : disabled
                    ? t.direct.noKnown
                    : t.direct.directHint}
              </span>
            </label>
          );
        })}
      </div>

      {direct && (
        <Field label={t.direct.chooseVehicle} required>
          {(p) => (
            <Select
              {...p}
              name="direct_vehicle_id"
              required
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
            >
              <option value="">—</option>
              <VehicleOptions vehicles={fitting} />
            </Select>
          )}
        </Field>
      )}

      {direct && chosen?.busy && <p className="text-xs text-warn">{t.direct.busyWarn}</p>}
    </fieldset>
  );
}

/** Карточка заказа, который ждёт знакомую машину без срока. */
export function DirectWaiting({ orderId, plate }: { orderId: string; plate: string | null }) {
  const { t, m, locale } = useI18n();

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-control border border-accent-line bg-accent-wash px-3 py-2.5">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
          <Badge tone="info">{t.direct.badge}</Badge>
          {m('direct.waiting', { plate: plate ?? '—' })}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{t.direct.shipperHint}</p>
      </div>
      <form action={cancelOrderAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="order_id" value={orderId} />
        <Button type="submit" size="sm">
          {t.direct.toDesk}
        </Button>
      </form>
    </div>
  );
}

const idle: DirectState = { error: null, done: false };

/** Заказ на столе без откликов — отправить знакомой машине. */
export function SendDirect({
  orderId,
  vehicles,
  haulKind,
}: {
  orderId: string;
  vehicles: KnownVehicle[];
  haulKind: HaulKind;
}) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(directAssignAction, idle);
  const fitting = fittingVehicles(vehicles, haulKind);
  const [vehicleId, setVehicleId] = useState('');

  if (fitting.length === 0) return null;
  const chosen = fitting.find((v) => v.vehicle_id === vehicleId) ?? null;

  return (
    <form action={action} className="mt-3 flex flex-col gap-2 rounded-control border border-line px-3 py-2.5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="label-micro">{t.direct.sendDirect}</span>
          <Select
            name="vehicle_id"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-64"
          >
            <option value="">{t.direct.chooseVehicle}</option>
            <VehicleOptions vehicles={fitting} />
          </Select>
        </label>
        <Button type="submit" size="sm" variant="primary" disabled={pending || !vehicleId}>
          {t.direct.sendDirect}
        </Button>
      </div>
      {chosen?.busy && <p className="text-xs text-warn">{t.direct.busyWarn}</p>}
      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
