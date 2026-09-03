'use client';

import { HaulBadge } from '@/components/domain/HaulBadge';
import { OrderAmendments } from '@/components/domain/OrderAmendments';
import { OrderRouteMap } from '@/components/domain/RouteMap';
import { TripStage } from '@/components/domain/TripProgress';
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
import { AbandonPanel } from './AbandonPanel';
import { ClosingPanel } from './ClosingPanel';
import { TripPanel } from './TripPanel';
import type { Database } from '@/types/database';
import type { OrderAmendment, OrderStop, TripDocument } from '@/types/db';

type Assignment = Database['public']['Functions']['my_assignments']['Returns'][number];

/**
 * Рейсы, закреплённые за перевозчиком.
 *
 * Здесь маршрут показывается целиком, с контактами получателя: заказ уже
 * закреплён, и они нужны для работы. До закрепления их не отдавала
 * функция стола.
 */
export function Assignments({
  assignments,
  documentsByOrder,
  amendmentsByOrder,
}: {
  assignments: Assignment[];
  documentsByOrder: Record<string, TripDocument[]>;
  amendmentsByOrder: Record<string, OrderAmendment[]>;
}) {
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
          const amendments = amendmentsByOrder[order.id] ?? [];

          return (
            <Card
              key={order.id}
              stripe={orderStatusTone[order.status]}
              /*
               * У перевозчика отсчёт идёт только в AWAIT_DRIVER: заказчик
               * его выбрал и ждёт подтверждения. Идущий рейс не дышит —
               * решать там нечего.
               */
              attention={order.status === 'AWAIT_DRIVER' && Boolean(order.deadline_at)}
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
                      <HaulBadge haulKind={order.haul_kind} containerFeet={order.container_feet} />
                      <Mono className="text-xs text-ink-dim">{order.ref}</Mono>
                      {/* Номер прицепа — по нему водитель находит железо на площадке. */}
                      {order.trailer_plate && <Plate>{order.trailer_plate}</Plate>}
                      {order.vehicle_plate && <Plate>{order.vehicle_plate}</Plate>}
                    </div>

                    <p className="mt-1.5 text-[13px] text-ink-muted">
                      {order.trailer ? `${order.trailer} · ` : ''}
                      {m('order.distance', { km: order.distance_km ?? 0 })} ·{' '}
                      <span className="font-semibold text-ink">{f.eur(order.rate_cents ?? 0)}</span>{' '}
                      <span className="text-ink-dim">{t.money.addVat}</span>
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

                {/* Этап рейса — сразу под шапкой: это главное, что здесь ищут. */}
                {order.status === 'IN_PROGRESS' && stops.length > 0 && (
                  <TripStage stops={stops} className="mt-3" />
                )}

                {/*
                  * Правки заказчика идут выше маршрута, а не в конце
                  * карточки: маршрут ниже — уже изменённый, и прочитать
                  * его, не зная об этом, значит поехать по старому плану,
                  * запомненному утром.
                  */}
                <OrderAmendments
                  amendments={amendments}
                  orderId={order.id}
                  haulKind={order.haul_kind}
                  canAcknowledge={order.status === 'IN_PROGRESS'}
                  className="mt-3"
                />

                {stops.length > 0 && (
                  <>
                    <CardDivider className="my-4" />
                    <RouteStops stops={stops} haulKind={order.haul_kind} />

                    <OrderRouteMap
                      geometry={order.route_geometry}
                      bounds={order.route_bounds}
                      stops={stops}
                      haulKind={order.haul_kind}
                      className="mt-4"
                    />
                    {order.status === 'IN_PROGRESS' && (
                      <TripPanel stops={stops} haulKind={order.haul_kind} />
                    )}

                    {/*
                      * Закрытие появляется, когда пройдены все точки.
                      * Выполненного рейса здесь уже нет — он уходит во
                      * вкладку выполненных вместе с документами.
                      */}
                    {order.status === 'IN_PROGRESS' && (
                      <ClosingPanel
                        orderId={order.id}
                        stops={stops}
                        documents={documentsByOrder[order.id] ?? []}
                        closed={false}
                      />
                    )}

                    <p className="mt-3 text-xs text-ink-dim">{t.matching.contactsNow}</p>
                  </>
                )}

                {/*
                  * Отказ — в самом низу, ниже закрытия рейса.
                  *
                  * Порядок здесь означает вероятность: девяносто девять
                  * рейсов из ста заканчиваются кнопкой «сдал», и она
                  * обязана попадаться раньше. Отказ ищут те, у кого уже
                  * что-то случилось, и лишняя прокрутка им не помеха.
                  */}
                {order.status === 'IN_PROGRESS' && (
                  <AbandonPanel orderId={order.id} className="mt-4 border-t border-line pt-4" />
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
