'use client';

import { useActionState, useState } from 'react';
import { OrderRouteMap } from '@/components/domain/RouteMap';
import { RouteStops } from '@/components/domain/RouteStops';
import { Badge, Button, Card, CardBody, CardDivider, EmptyState, Mono, Plate, Select } from '@/components/ui';
import { MATCHING } from '@/lib/config';
import { takeOrderAction, type MatchingState } from '@/lib/orders/matching';
import { useI18n } from '@/lib/i18n/provider';
import type { DeskOrder, DeskStop, Vehicle } from '@/types/db';

const initialTake: MatchingState = { error: null };

/**
 * Кнопка «Беру».
 *
 * Машину выбирает перевозчик: у компании их может быть несколько, а
 * отклик подаётся конкретной. С одной машиной выбирать нечего — селект
 * не показывается.
 */
function TakeButton({ orderId, vehicles }: { orderId: string; vehicles: Vehicle[] }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(takeOrderAction, initialTake);

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />

      {vehicles.length === 1 ? (
        <input type="hidden" name="vehicle_id" value={vehicles[0]!.id} />
      ) : (
        <label className="flex flex-col items-end gap-1">
          <span className="label-micro">{t.matching.chooseVehicle}</span>
          <Select name="vehicle_id" required className="w-44">
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plate}
              </option>
            ))}
          </Select>
        </label>
      )}

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? t.matching.taking : t.matching.take}
      </Button>

      {state.error && (
        <p role="alert" className="max-w-52 text-right text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

/**
 * Стол заказов.
 *
 * Маршрут приходит уже без контактов получателя — их не отдаёт функция
 * desk_orders. Об этом сказано прямо в карточке: иначе перевозчик решит,
 * что заказчик не заполнил контакт.
 */
export function DeskList({ orders, vehicles }: { orders: DeskOrder[]; vehicles: Vehicle[] }) {
  const { t, m, f } = useI18n();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (orders.length === 0) {
    return <EmptyState title={t.desk.empty} description={t.desk.emptyHint} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => {
        const stops = (order.stops ?? []) as unknown as DeskStop[];
        const open = expanded === order.id;

        return (
          <Card key={order.id} stripe="info">
            <CardBody>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-[15px] font-semibold tracking-tight">
                      {t.orderType[order.order_type]}
                    </h3>
                    <Mono className="text-xs text-ink-dim">{order.ref}</Mono>
                    {/* Номер прицепа — по нему водитель находит железо на площадке. */}
                    {order.trailer_plate && <Plate>{order.trailer_plate}</Plate>}
                  </div>

                  <p className="mt-2 font-mono text-sm tracking-tight text-accent">
                    {order.pickup_city} → {order.finish_city ?? '—'}
                  </p>

                  <p className="mt-1.5 text-[13px] text-ink-muted">
                    {order.trailer ? `${order.trailer} · ` : ''}
                    {m('order.distance', { km: order.distance_km ?? 0 })} ·{' '}
                    <span className="font-semibold text-ink">{f.eur(order.rate_cents ?? 0)}</span>{' '}
                    <span className="text-ink-dim">{t.money.addVat}</span>{' '}
                    {order.distance_km && order.rate_cents ? (
                      <span className="text-ink-dim">
                        · {m('order.ratePerKm', {
                          rate: f.eurPerKm(order.rate_cents, order.distance_km) ?? '',
                        })}
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-1 text-xs text-ink-dim">{order.shipper_name}</p>

                  {order.pickup_date && (
                    <p className="mt-1 font-mono text-xs text-ink-faint">
                      {f.date(`${order.pickup_date}T12:00:00Z`)}
                      {order.pickup_time ? ` ${order.pickup_time.slice(0, 5)}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  {order.taken_by_me ? (
                    <>
                      <Badge tone="warn">{t.matching.taken}</Badge>
                      <span className="text-xs text-ink-faint">{t.matching.waitingChoice}</span>
                    </>
                  ) : order.offers_count >= MATCHING.maxOffersPerOrder ? (
                    <Badge tone="neutral">
                      {t.matching.noSlots}{' '}
                      {m('matching.slotsTaken', {
                        count: order.offers_count,
                        max: MATCHING.maxOffersPerOrder,
                      })}
                    </Badge>
                  ) : (
                    <TakeButton orderId={order.id} vehicles={vehicles} />
                  )}

                  {order.offers_count > 0 && !order.taken_by_me && (
                    <span className="font-mono text-xs text-ink-dim">
                      {t.matching.slots}{' '}
                      {m('matching.slotsTaken', {
                        count: order.offers_count,
                        max: MATCHING.maxOffersPerOrder,
                      })}
                    </span>
                  )}

                  <Button size="sm" onClick={() => setExpanded(open ? null : order.id)}>
                    {t.desk.details}
                  </Button>
                </div>
              </div>

              {open && (
                <>
                  <CardDivider className="my-4" />
                  <p className="label-micro mb-3">
                    {m('order.stopsCount', { count: stops.length })}
                  </p>
                  <RouteStops stops={stops} />

                  {/*
                    * Карта на столе — до того, как заказ взят: по ней видно,
                    * куда на самом деле ехать. Контактов и получателя она не
                    * раскрывает, линия маршрута их не содержит.
                    */}
                  <OrderRouteMap
                    geometry={order.route_geometry}
                    bounds={order.route_bounds}
                    stops={stops}
                    className="mt-4"
                  />

                  {order.comment && (
                    <p className="mt-4 rounded-control border border-line bg-sunken px-3 py-2 text-xs text-ink-muted">
                      {order.comment}
                    </p>
                  )}

                  <p className="mt-3 text-xs text-ink-dim">{t.desk.contactsHidden}</p>
                </>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
