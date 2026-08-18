'use client';

import { OrderRouteMap } from '@/components/domain/RouteMap';
import { RouteStops } from '@/components/domain/RouteStops';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDivider,
  Countdown,
  Mono,
  Plate,
} from '@/components/ui';
import { orderStatusTone } from '@/components/ui/tone';
import { cancelOrderAction, confirmOrderAction } from '@/lib/orders/matching';
import { useI18n } from '@/lib/i18n/provider';
import type { Database } from '@/types/database';
import type { OrderStop } from '@/types/db';

type Assignment = Database['public']['Functions']['my_assignments']['Returns'][number];

/**
 * Рейсы, закреплённые за перевозчиком.
 *
 * Здесь маршрут показывается целиком, с контактами получателя: заказ уже
 * закреплён, и они нужны для работы. До закрепления их не отдавала
 * функция стола.
 */
export function Assignments({ assignments }: { assignments: Assignment[] }) {
  const { t, m, f, locale } = useI18n();

  if (assignments.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
        {t.matching.assignments}
      </h2>

      <div className="flex flex-col gap-3">
        {assignments.map((order) => {
          const stops = (order.stops ?? []) as unknown as OrderStop[];
          const waiting = order.status === 'AWAIT_DRIVER';

          return (
            <Card key={order.id} stripe={orderStatusTone[order.status]}>
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
                      {order.vehicle_plate && <Plate>{order.vehicle_plate}</Plate>}
                    </div>

                    <p className="mt-1.5 text-[13px] text-ink-muted">
                      {order.trailer ? `${order.trailer} · ` : ''}
                      <Mono>{m('order.distance', { km: order.distance_km ?? 0 })}</Mono> ·{' '}
                      <Mono className="font-bold text-ink">{f.eur(order.rate_cents ?? 0)}</Mono>
                    </p>
                    <p className="mt-1 text-xs text-ink-dim">{order.shipper_name}</p>

                    {waiting && (
                      <p className="mt-2 text-[13px] text-warn">{t.matching.chosenYouHint}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {order.deadline_at && <Countdown deadline={order.deadline_at} />}

                    {waiting ? (
                      <>
                        <form action={confirmOrderAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="order_id" value={order.id} />
                          <Button type="submit" variant="primary" size="sm" className="w-full">
                            {t.matching.confirm}
                          </Button>
                        </form>
                        <form action={cancelOrderAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="order_id" value={order.id} />
                          <Button type="submit" variant="danger" size="sm" className="w-full">
                            {t.matching.decline}
                          </Button>
                        </form>
                      </>
                    ) : (
                      <Badge tone="live">{t.matching.inProgress}</Badge>
                    )}
                  </div>
                </div>

                {stops.length > 0 && (
                  <>
                    <CardDivider className="my-4" />
                    <RouteStops stops={stops} />

                    <OrderRouteMap
                      geometry={order.route_geometry}
                      bounds={order.route_bounds}
                      stops={stops}
                      className="mt-4"
                    />
                    <p className="mt-3 text-xs text-ink-dim">{t.matching.contactsNow}</p>
                  </>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
