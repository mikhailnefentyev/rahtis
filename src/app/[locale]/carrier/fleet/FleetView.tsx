'use client';

import { useCallback, useState } from 'react';
import { Badge, Button, Card, CardBody, EmptyState, Mono, Plate } from '@/components/ui';
import { vehicleAccessTone } from '@/components/ui/tone';
import { deleteDraftVehicleAction, submitVehicleAction } from '@/lib/fleet/actions';
import { EURO_LABEL } from '@/lib/fleet/labels';
import { useI18n } from '@/lib/i18n/provider';
import type { Driver, Vehicle } from '@/types/db';
import { VehicleForm } from './VehicleForm';

export function FleetView({
  vehicles,
  drivers,
  driverByVehicle,
  documentsOk,
  today,
}: {
  vehicles: Vehicle[];
  drivers: Pick<Driver, 'id' | 'full_name' | 'phone'>[];
  /** Текущий водитель каждой машины: vehicle_id → driver_id. */
  driverByVehicle: Record<string, string>;
  documentsOk: boolean;
  /** Считается на сервере: рендер обязан быть чистым, а часы клиента могут врать. */
  today: string;
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
          <VehicleForm
            vehicle={editing === 'new' ? null : editing}
            drivers={drivers}
            currentDriverId={editing === 'new' ? null : (driverByVehicle[editing.id] ?? null)}
            onClose={close}
          />
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
                    {vehicle.adr && (
                      /* Допуск к опасным грузам виден сразу: без него машину
                         нет смысла ставить на такой заказ. */
                      <Badge tone="warn">{t.vehicle.adr}</Badge>
                    )}
                    <Badge tone={vehicleAccessTone[vehicle.access]}>
                      {t.vehicleAccess[vehicle.access]}
                    </Badge>
                    <span className="font-mono text-xs text-ink-dim">
                      {EURO_LABEL[vehicle.euro_class]}
                    </span>
                  </div>

                  {/*
                    * Строка вместимости — ответ на один вопрос: какие
                    * заказы эта машина возьмёт. У тягача его дают оси и
                    * контейнерное шасси, у фургона и грузовика —
                    * килограммы и погрузочные метры. Проверяет и то и
                    * другое одна функция в take_order, поэтому и показано
                    * это одной строкой, а не двумя блоками.
                    *
                    * Чего у машины нет, о том не пишется ничего:
                    * отсутствие строки и есть ответ, а «не возит
                    * контейнеры» у большинства парка было бы шумом в
                    * каждой карточке.
                    */}
                  <p className="mt-2 text-[13px] text-ink">
                    {vehicle.make} ·{' '}
                    {vehicle.vehicle_class === 'TRACTOR'
                      ? m('vehicle.axlesCount', { count: vehicle.axles })
                      : `${vehicle.payload_kg} kg · ${String(vehicle.ldm).replace('.', ',')} ldm`}
                    {vehicle.container_feet.length > 0 &&
                      ` · ${t.vehicle.containerFeet}: ${vehicle.container_feet
                        .slice()
                        .sort((a, b) => a - b)
                        .map((n) => m('order.containerSize', { feet: n }))
                        .join(', ')}`}
                  </p>

                  {/*
                    * Оснащение экспресса. Холодильник с просроченным
                    * техосмотром показывается предупреждением, а не
                    * прячется: заказы он не закрывает — сухой груз такая
                    * машина везёт как прежде, — но обещать холод с
                    * недействительной бумагой нельзя.
                    */}
                  {vehicle.vehicle_class !== 'TRACTOR' &&
                    (vehicle.tail_lift || vehicle.side_loading || vehicle.reefer) && (
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {vehicle.tail_lift && <Badge tone="neutral">{t.vehicle.tailLift}</Badge>}
                        {vehicle.side_loading && (
                          <Badge tone="neutral">{t.vehicle.sideLoading}</Badge>
                        )}
                        {vehicle.reefer && (
                          <Badge
                            tone={
                              vehicle.reefer_inspection_until &&
                              vehicle.reefer_inspection_until < today
                                ? 'warn'
                                : 'info'
                            }
                          >
                            {t.vehicle.reefer} · {vehicle.reefer_inspection_until}
                          </Badge>
                        )}
                      </p>
                    )}
                  {/*
                    * Водитель — из текущей привязки. Машина без водителя
                    * на рейсы не выходит, и сказано это здесь, а не
                    * обнаруживается на столе пустым списком машин.
                    */}
                  {vehicle.driver_name ? (
                    <p className="mt-1 text-[13px] text-ink-muted">
                      {vehicle.driver_name} · {vehicle.languages.join('/')} ·{' '}
                      <Mono>{vehicle.whatsapp}</Mono>
                    </p>
                  ) : (
                    <p className="mt-1 text-[13px] text-warn">{t.drivers.vehicleNoDriver}</p>
                  )}
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
