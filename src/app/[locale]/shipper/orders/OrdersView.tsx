'use client';

import { useState } from 'react';
import { OrderRouteMap } from '@/components/domain/RouteMap';
import { RouteStops } from '@/components/domain/RouteStops';
import { Badge, Button, Card, CardBody, CardDivider, EmptyState, Mono } from '@/components/ui';
import { orderStatusTone } from '@/components/ui/tone';
import { useI18n } from '@/lib/i18n/provider';
import type { OrderStop, ShipperOffer, ShipperOrder } from '@/types/db';
import { AssignedCarrier, OffersPanel } from './OffersPanel';

export function OrdersView({
  orders,
  stopsByOrder,
  offersByOrder,
}: {
  orders: ShipperOrder[];
  stopsByOrder: Record<string, OrderStop[]>;
  offersByOrder: Record<string, ShipperOffer[]>;
}) {
  const { t, m, f } = useI18n();
  const [composing, setComposing] = useState(false);
  const [OrderForm, setOrderForm] = useState<React.ComponentType<{ onPublished: () => void }> | null>(
    null,
  );

  /*
   * Форма публикации большая и нужна не при каждом заходе, поэтому её код
   * подгружается при первом нажатии, а не вместе со списком заказов.
   */
  async function startComposing() {
    if (!OrderForm) {
      const mod = await import('./OrderForm');
      setOrderForm(() => mod.OrderForm);
    }
    setComposing(true);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-faint">
          {m('desk.ordersCount', { count: orders.length })}
        </h2>
        {!composing && (
          <Button variant="primary" size="sm" onClick={startComposing}>
            {t.orders.newOrder}
          </Button>
        )}
      </div>

      {composing && OrderForm && (
        <div className="mb-6">
          <OrderForm onPublished={() => setComposing(false)} />
        </div>
      )}

      {orders.length === 0 && !composing ? (
        <EmptyState title={t.orders.none} description={t.orders.noneHint} />
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => {
            const stops = stopsByOrder[order.id] ?? [];
            const pickup = stops.find((s) => s.role === 'PICKUP');
            const delivery = stops.find((s) => s.role === 'DELIVERY');
            const offers = offersByOrder[order.id] ?? [];
            const assigned = offers.find((o) => o.is_assigned);

            return (
              <Card
                key={order.id}
                stripe={orderStatusTone[order.status]}
                /* Дышит только то, где идёт отсчёт и решение за заказчиком. */
                attention={Boolean(order.deadline_at)}
              >
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-[15px] font-semibold tracking-tight">
                          {t.orderType[order.order_type]}
                        </h3>
                        <Badge tone={orderStatusTone[order.status]}>
                          {t.orderStatus[order.status]}
                        </Badge>
                        <Mono className="text-xs text-ink-dim">{order.ref}</Mono>
                        {order.shipper_ref && (
                          <Mono className="text-xs text-ink-dim">
                            {t.orders.shipperRefShort}: {order.shipper_ref}
                          </Mono>
                        )}
                      </div>

                      {pickup && delivery && (
                        <p className="mt-2 font-mono text-sm tracking-tight text-accent">
                          {pickup.city} → {delivery.city}
                        </p>
                      )}

                      <p className="mt-1.5 text-[13px] text-ink-muted">
                        {order.trailer ? `${order.trailer} · ` : ''}
                        <Mono>{m('order.distance', { km: order.distance_km ?? 0 })}</Mono> ·{' '}
                        <Mono className="font-bold text-ink">{f.eur(order.rate_cents ?? 0)}</Mono>{' '}
                        {order.distance_km && order.rate_cents ? (
                          <Mono className="text-ink-dim">
                            · {m('order.ratePerKm', {
                              rate: f.eurPerKm(order.rate_cents, order.distance_km) ?? '',
                            })}
                          </Mono>
                        ) : null}
                      </p>

                      {order.published_at && (
                        <p className="mt-1 text-xs text-ink-dim">
                          {m('order.publishedAt', { date: f.dateTime(order.published_at) })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Отклики требуют решения по таймеру — они выше маршрута. */}
                  {(order.status === 'REQUESTED' || order.status === 'AWAIT_DRIVER') && (
                    <OffersPanel order={order} offers={offers} />
                  )}

                  {/* Рейс идёт — выбирать не из чего, важно кто везёт. */}
                  {order.status === 'IN_PROGRESS' && assigned && (
                    <AssignedCarrier offer={assigned} />
                  )}

                  {stops.length > 0 && (
                    <>
                      <CardDivider className="my-4" />
                      <p className="label-micro mb-3">
                        {m('order.stopsCount', { count: stops.length })}
                      </p>
                      <RouteStops stops={stops} />

                      {/* Карта под списком: список — источник, карта — проверка. */}
                      <OrderRouteMap
                        geometry={order.route_geometry}
                        bounds={order.route_bounds}
                        stops={stops}
                        className="mt-4"
                      />
                    </>
                  )}

                  {order.comment && (
                    <p className="mt-4 rounded-control border border-line bg-sunken px-3 py-2 text-xs text-ink-muted">
                      {order.comment}
                    </p>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
