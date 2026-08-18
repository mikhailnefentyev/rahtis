'use client';

import { useCallback, useState } from 'react';
import { Badge, Button, Card, CardBody, EmptyState, Mono, Plate } from '@/components/ui';
import { vehicleAccessTone } from '@/components/ui/tone';
import { deleteDraftVehicleAction, submitVehicleAction } from '@/lib/fleet/actions';
import { EURO_LABEL } from '@/lib/fleet/labels';
import { useI18n } from '@/lib/i18n/provider';
import type { Vehicle } from '@/types/db';
import { VehicleForm } from './VehicleForm';

export function FleetView({
  vehicles,
  documentsOk,
}: {
  vehicles: Vehicle[];
  documentsOk: boolean;
}) {
  const { t, m, locale } = useI18n();
  const [editing, setEditing] = useState<Vehicle | null | 'new'>(null);

  const close = useCallback(() => setEditing(null), []);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-faint">
          {m('fleet.vehiclesCount', { count: vehicles.length })}
        </h2>
        {editing === null && (
          <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
            {t.fleet.addVehicle}
          </Button>
        )}
      </div>

      {editing !== null && (
        <div className="mb-4">
          <VehicleForm vehicle={editing === 'new' ? null : editing} onClose={close} />
        </div>
      )}

      {vehicles.length === 0 && editing === null ? (
        <EmptyState title={t.fleet.noVehicles} description={t.fleet.noVehiclesHint} />
      ) : (
        <div className="flex flex-col gap-3">
          {vehicles.map((vehicle) => (
            <Card key={vehicle.id} stripe={vehicleAccessTone[vehicle.access]}>
              <CardBody className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Plate className="text-[15px]">{vehicle.plate}</Plate>
                    <Badge tone={vehicleAccessTone[vehicle.access]}>
                      {t.vehicleAccess[vehicle.access]}
                    </Badge>
                    <span className="font-mono text-xs text-ink-dim">
                      {EURO_LABEL[vehicle.euro_class]}
                    </span>
                  </div>

                  <p className="mt-2 text-[13px] text-ink">
                    {vehicle.make} · {m('vehicle.axlesCount', { count: vehicle.axles })}
                  </p>
                  <p className="mt-1 text-[13px] text-ink-muted">
                    {vehicle.driver_name} · {vehicle.languages.join('/')} ·{' '}
                    <Mono>{vehicle.whatsapp}</Mono>
                  </p>
                  <p className="mt-1 text-xs text-ink-dim">{vehicle.base_city}</p>

                  {vehicle.access === 'PENDING' && (
                    <p className="mt-2 text-[13px] text-warn">{t.fleet.onReview}</p>
                  )}
                  {vehicle.access === 'REJECTED' && (
                    <p className="mt-2 text-[13px] text-danger">
                      {t.fleet.rejectedHint}
                      {vehicle.rejection_reason ? `: ${vehicle.rejection_reason}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button size="sm" onClick={() => setEditing(vehicle)}>
                    {t.action.details}
                  </Button>

                  {(vehicle.access === 'DRAFT' || vehicle.access === 'REJECTED') && (
                    <form action={submitVehicleAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={vehicle.id} />
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        className="w-full"
                        disabled={!documentsOk}
                        title={documentsOk ? undefined : t.fleet.whyClosedNoDocs}
                      >
                        {t.fleet.submitForApproval}
                      </Button>
                    </form>
                  )}

                  {vehicle.access === 'DRAFT' && (
                    <form action={deleteDraftVehicleAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={vehicle.id} />
                      <Button type="submit" variant="danger" size="sm" className="w-full">
                        {t.fleet.deleteDraft}
                      </Button>
                    </form>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
