'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  InputMono,
  Plate,
  Select,
} from '@/components/ui';
import { deleteShiftAction, saveShiftAction, type FormState } from '@/lib/drivers/actions';
import { isoToOperationsLocal } from '@/lib/dates';
import { useI18n } from '@/lib/i18n/provider';
import type { DriverShift } from '@/types/db';

type ShiftRow = DriverShift & {
  plate: string | null;
  breaks: { started_at: string; ended_at: string | null }[];
};

const initial: FormState = { error: null, done: false };

/**
 * Смены водителя за месяц.
 *
 * Ручные смены правит и удаляет перевозчик. Смены из приложения —
 * только удаляет: править за водителя отметку, которую тот поставил
 * сам, значит подменить его слово своим. База пропускает такую правку
 * политикой, а журнал правок хранит, кто и что удалил.
 */
export function ShiftsPanel({
  driverId,
  shifts,
  vehicles,
  defaultVehicleId,
}: {
  driverId: string;
  shifts: ShiftRow[];
  vehicles: { id: string; plate: string }[];
  defaultVehicleId: string | null;
}) {
  const { t, f, locale } = useI18n();
  const [editing, setEditing] = useState<ShiftRow | null | 'new'>(null);
  const close = useCallback(() => setEditing(null), []);

  const minutes = (s: ShiftRow) =>
    s.breaks.reduce(
      (sum, b) => (b.ended_at ? sum + (Date.parse(b.ended_at) - Date.parse(b.started_at)) / 60_000 : sum),
      0,
    );

  return (
    <div className="flex flex-col gap-3">
      {editing === null ? (
        <div>
          <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
            {t.shifts.add}
          </Button>
        </div>
      ) : (
        <ShiftForm
          driverId={driverId}
          shift={editing === 'new' ? null : editing}
          vehicles={vehicles}
          defaultVehicleId={defaultVehicleId}
          onClose={close}
        />
      )}

      {shifts.length === 0 ? (
        <EmptyState title={t.shifts.none} />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {shifts.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line px-3 py-2 text-[13px]"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-semibold">{f.date(s.started_at)}</span>
                <span>
                  {f.time(s.started_at)}–{s.ended_at ? f.time(s.ended_at) : ''}
                </span>
                {!s.ended_at && <Badge tone="live">{t.shifts.running}</Badge>}
                {minutes(s) > 0 && (
                  <span className="text-ink-dim">
                    {t.workReport.colBreaks} {f.number(Math.round(minutes(s)))} min
                  </span>
                )}
                {s.plate && <Plate>{s.plate}</Plate>}
                {s.odometer_start != null && s.odometer_end != null && (
                  <span className="text-ink-dim">
                    {f.number(s.odometer_end - s.odometer_start)} km
                  </span>
                )}
                <Badge tone={s.source === 'APP' ? 'info' : 'neutral'}>{t.shiftSource[s.source]}</Badge>
                {s.note && <span className="text-ink-dim">{s.note}</span>}
              </div>

              <div className="flex gap-1.5">
                {s.source === 'MANUAL' && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                    {t.drivers.edit}
                  </Button>
                )}
                <form action={deleteShiftAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="driver_id" value={driverId} />
                  <Button type="submit" size="sm" variant="danger">
                    {t.shifts.delete}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ShiftForm({
  driverId,
  shift,
  vehicles,
  defaultVehicleId,
  onClose,
}: {
  driverId: string;
  shift: ShiftRow | null;
  vehicles: { id: string; plate: string }[];
  defaultVehicleId: string | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(saveShiftAction, initial);

  useEffect(() => {
    if (state.done) onClose();
  }, [state.done, onClose]);

  const local = (iso: string | null | undefined) => (iso ? isoToOperationsLocal(iso) : '');
  const firstBreak = shift?.breaks[0] ?? null;

  return (
    <Card stripe="info">
      <CardBody>
        <h3 className="mb-4 text-[13px] font-semibold tracking-tight">
          {shift ? t.shifts.edit : t.shifts.add}
        </h3>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="driver_id" value={driverId} />
          {shift && <input type="hidden" name="id" value={shift.id} />}

          <Field label={t.shifts.start} required>
            {(p) => (
              <Input
                {...p}
                type="datetime-local"
                name="started_at"
                required
                defaultValue={local(shift?.started_at)}
              />
            )}
          </Field>

          <Field label={t.shifts.end} hint={t.shifts.endHint}>
            {(p) => (
              <Input {...p} type="datetime-local" name="ended_at" defaultValue={local(shift?.ended_at)} />
            )}
          </Field>

          <Field label={t.shifts.breakStart} hint={t.shifts.breakHint}>
            {(p) => (
              <Input
                {...p}
                type="datetime-local"
                name="break_start"
                defaultValue={local(firstBreak?.started_at)}
              />
            )}
          </Field>

          <Field label={t.shifts.breakEnd}>
            {(p) => (
              <Input
                {...p}
                type="datetime-local"
                name="break_end"
                defaultValue={local(firstBreak?.ended_at)}
              />
            )}
          </Field>

          <Field label={t.shifts.vehicle}>
            {(p) => (
              <Select {...p} name="vehicle_id" defaultValue={shift?.vehicle_id ?? defaultVehicleId ?? ''}>
                <option value="">—</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label={t.shifts.note}>
            {(p) => <Input {...p} name="note" maxLength={500} defaultValue={shift?.note ?? ''} />}
          </Field>

          <Field label={t.shifts.odoStart}>
            {(p) => (
              <InputMono
                {...p}
                name="odometer_start"
                inputMode="numeric"
                defaultValue={shift?.odometer_start ?? ''}
              />
            )}
          </Field>

          <Field label={t.shifts.odoEnd}>
            {(p) => (
              <InputMono
                {...p}
                name="odometer_end"
                inputMode="numeric"
                defaultValue={shift?.odometer_end ?? ''}
              />
            )}
          </Field>

          {state.error && (
            <p role="alert" className="text-[13px] text-danger sm:col-span-2">
              {state.error}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" onClick={onClose} className="flex-1">
              {t.action.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={pending} className="flex-[2]">
              {t.action.save}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
