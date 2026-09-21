'use client';

import Link from 'next/link';
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
  Mono,
  Plate,
  Select,
  buttonClass,
} from '@/components/ui';
import {
  archiveDriverAction,
  assignDriverAction,
  saveDriverAction,
  type FormState,
} from '@/lib/drivers/actions';
import { useI18n } from '@/lib/i18n/provider';
import { DRIVER_LANGUAGES, type Driver, type PayModel } from '@/types/db';

export type DriverRow = {
  driver: Driver;
  vehicleId: string | null;
  payModel: PayModel | null;
};

type VehicleOption = { id: string; plate: string };

const initial: FormState = { error: null, done: false };

/**
 * Список водителей компании.
 *
 * Действующие — карточками с машиной и моделью оплаты; архивные —
 * свёрнутым списком ниже: они не занимают номер и не садятся на машины,
 * но их часы и рейсы остаются в отчётах.
 */
export function DriversView({ rows, vehicles }: { rows: DriverRow[]; vehicles: VehicleOption[] }) {
  const { t, m } = useI18n();
  const [editing, setEditing] = useState<Driver | null | 'new'>(null);
  const [showArchived, setShowArchived] = useState(false);

  const close = useCallback(() => setEditing(null), []);

  const active = rows.filter((r) => r.driver.status === 'ACTIVE');
  const archived = rows.filter((r) => r.driver.status === 'ARCHIVED');
  const plateOf = (id: string | null) => vehicles.find((v) => v.id === id)?.plate ?? null;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-faint">
          {m('drivers.count', { count: active.length })}
        </h2>
        {editing === null && (
          <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
            {t.drivers.add}
          </Button>
        )}
      </div>

      {editing !== null && (
        <div className="mb-4">
          <DriverForm driver={editing === 'new' ? null : editing} onClose={close} />
        </div>
      )}

      {active.length === 0 && editing === null ? (
        <EmptyState title={t.drivers.none} description={t.drivers.noneHint} />
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((row) => (
            <DriverCard
              key={row.driver.id}
              row={row}
              plate={plateOf(row.vehicleId)}
              vehicles={vehicles}
              onEdit={() => setEditing(row.driver)}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-[13px] font-semibold text-ink-faint hover:text-ink"
            aria-expanded={showArchived}
          >
            {t.drivers.archived} · {archived.length}
          </button>
          {showArchived && (
            <>
              <p className="mt-1 mb-3 text-xs text-ink-dim">{t.drivers.archivedHint}</p>
              <div className="flex flex-col gap-2">
                {archived.map((row) => (
                  <ArchivedRow key={row.driver.id} driver={row.driver} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function DriverCard({
  row,
  plate,
  vehicles,
  onEdit,
}: {
  row: DriverRow;
  plate: string | null;
  vehicles: VehicleOption[];
  onEdit: () => void;
}) {
  const { t, locale } = useI18n();
  const { driver } = row;

  return (
    <Card stripe={driver.needs_review ? 'warn' : plate ? 'ok' : 'neutral'}>
      <CardBody className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-[15px] font-semibold tracking-tight">{driver.full_name}</h3>
            {plate ? <Plate>{plate}</Plate> : <Badge tone="neutral">{t.drivers.noVehicle}</Badge>}
            {row.payModel && <Badge tone="info">{t.payModel[row.payModel]}</Badge>}
          </div>
          <p className="mt-1 text-[13px] text-ink-muted">
            <Mono>{driver.phone}</Mono> · {driver.languages.join('/')}
          </p>
          {driver.needs_review && (
            <p className="mt-2 text-[13px] text-warn">{t.drivers.needsReview}</p>
          )}

          <AssignForm driverId={driver.id} currentVehicleId={row.vehicleId} vehicles={vehicles} />
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href={`/${locale}/carrier/drivers/${driver.id}`}
            className={buttonClass({ variant: 'primary', size: 'sm' })}
          >
            {t.drivers.open}
          </Link>
          <Button size="sm" onClick={onEdit}>
            {t.drivers.edit}
          </Button>
          <form action={archiveDriverAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={driver.id} />
            <Button type="submit" variant="danger" size="sm" className="w-full">
              {t.drivers.archive}
            </Button>
          </form>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Пересадка водителя. Выбор «без машины» снимает его с текущей: функция
 * базы получает машину, с которой снять, и пустого водителя.
 */
function AssignForm({
  driverId,
  currentVehicleId,
  vehicles,
}: {
  driverId: string;
  currentVehicleId: string | null;
  vehicles: VehicleOption[];
}) {
  const { t, locale } = useI18n();
  const [choice, setChoice] = useState(currentVehicleId ?? '');

  const unchanged = choice === (currentVehicleId ?? '');
  const vehicleId = choice || currentVehicleId || '';

  return (
    <form action={assignDriverAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <input type="hidden" name="driver_id" value={choice ? driverId : ''} />
      <label className="label-micro" htmlFor={`assign-${driverId}`}>
        {t.drivers.vehicle}
      </label>
      <Select
        id={`assign-${driverId}`}
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className="w-auto min-w-40"
      >
        <option value="">{t.drivers.noVehicle}</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.plate}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" disabled={unchanged || !vehicleId}>
        {t.drivers.assign}
      </Button>
    </form>
  );
}

function ArchivedRow({ driver }: { driver: Driver }) {
  const { t, locale } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line px-3 py-2">
      <span className="text-[13px] text-ink-muted">
        {driver.full_name} · <Mono>{driver.phone}</Mono>
      </span>
      <form action={archiveDriverAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={driver.id} />
        <input type="hidden" name="restore" value="1" />
        <Button type="submit" size="sm">
          {t.drivers.restore}
        </Button>
      </form>
    </div>
  );
}

function DriverForm({ driver, onClose }: { driver: Driver | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(saveDriverAction, initial);
  const [languages, setLanguages] = useState<string[]>(driver?.languages ?? ['FI']);

  useEffect(() => {
    if (state.done) onClose();
  }, [state.done, onClose]);

  const toggle = (code: string) =>
    setLanguages((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );

  return (
    <Card stripe="info">
      <CardBody>
        <h3 className="mb-4 text-[13px] font-semibold tracking-tight">
          {driver ? driver.full_name : t.drivers.new}
        </h3>

        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          {driver && <input type="hidden" name="id" value={driver.id} />}
          {languages.map((code) => (
            <input key={code} type="hidden" name="languages" value={code} />
          ))}

          <Field label={t.drivers.name} required>
            {(p) => (
              <Input
                {...p}
                name="full_name"
                required
                defaultValue={driver?.full_name ?? ''}
                placeholder="Antti Nieminen"
              />
            )}
          </Field>

          <Field label={t.drivers.phone} hint={t.drivers.phoneHint} required>
            {(p) => (
              <InputMono
                {...p}
                name="phone"
                required
                inputMode="tel"
                defaultValue={driver?.phone ?? '+358'}
                placeholder="+358401112233"
              />
            )}
          </Field>

          <div className="sm:col-span-2">
            <span className="label-micro mb-2 block">{t.drivers.languages}</span>
            <div className="flex flex-wrap gap-1.5">
              {DRIVER_LANGUAGES.map((code) => {
                const on = languages.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(code)}
                    className={
                      on
                        ? 'cursor-pointer rounded-control border border-accent bg-accent px-2.5 py-1 font-mono text-xs font-bold text-accent-ink'
                        : 'cursor-pointer rounded-control border border-line bg-raised px-2.5 py-1 font-mono text-xs text-ink-faint transition-colors duration-150 hover:border-accent-line hover:text-ink'
                    }
                  >
                    {code}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-faint">{t.drivers.languagesHint}</p>
          </div>

          {state.error && (
            <p role="alert" className="text-[13px] text-danger sm:col-span-2">
              {state.error}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" onClick={onClose} className="flex-1">
              {t.action.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={pending || languages.length === 0}
              className="flex-[2]"
            >
              {t.action.save}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
