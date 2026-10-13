'use client';

import { useActionState, useState } from 'react';
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
import { isTransfer } from '@/lib/orders/transfer';
import { AbandonPanel } from './AbandonPanel';
import { OrderChat } from '@/components/domain/OrderChat';
import { ClosingPanel } from './ClosingPanel';
import { TripPanel } from './TripPanel';
import { OwnEditPanel } from './OwnEditPanel';
import { AmendPanel } from '../../shipper/orders/AmendPanel';
import type { Database } from '@/types/database';
import type { OrderAmendment, OrderStop, TripDocument } from '@/types/db';

type Assignment = Database['public']['Functions']['my_assignments']['Returns'][number];

/**
 * Раскрытая карточка закреплённого рейса.
 *
 * Всё, что нужно, когда рейс уже нашли: подтверждение, этапы, маршрут с
 * контактами, карта, документы, закрытие. Раньше это рисовалось сразу для
 * каждого рейса — при двадцати закреплённых единицах на странице
 * оказывалось двадцать карт, и найти среди них нужную было нельзя.
 */
export function AssignmentCard({
  order,
  documentsByOrder,
  amendmentsByOrder,
  ownClient,
}: {
  order: Assignment;
  documentsByOrder: Record<string, TripDocument[]>;
  amendmentsByOrder: Record<string, OrderAmendment[]>;
  /** Имя клиента, если это свой рейс перевозчика. */
  ownClient?: string;
}) {
  const { t, m, f, locale } = useI18n();
  /* Свой рейс отказом снимается насовсем — поэтому отказ в два шага. */
  const own = ownClient !== undefined;
  const [declining, setDeclining] = useState(false);
  const [confirmState, confirmAction, confirming] = useActionState(confirmOrderAction, { error: null });

  const stops = (order.stops ?? []) as unknown as OrderStop[];
  const waiting = order.status === 'AWAIT_DRIVER';
  /* Прямое назначение знакомой машине: ждёт без срока, отказ отправляет заказ на стол. */
  const direct = waiting && !order.deadline_at;
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
                    {isTransfer(stops) ? t.transfer.title : t.orderType[order.order_type]}
                  </h3>
                  <Badge tone={orderStatusTone[order.status]}>
                    {t.orderStatus[order.status]}
                  </Badge>
                  <HaulBadge haulKind={order.haul_kind} containerFeet={order.container_feet} ldm={order.ldm} />
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
                {own ? (
                  <p className="mt-1 text-xs text-ink-dim">
                    {t.own.clientSection}: <span className="font-semibold text-ink-muted">{ownClient}</span>
                  </p>
                ) : (
                  order.shipper_name && <p className="mt-1 text-xs text-ink-dim">{order.shipper_name}</p>
                )}

                {direct ? (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink">
                    <Badge tone="info">{own ? t.own.badge : t.direct.badge}</Badge>
                    {own ? t.own.carrierHint : t.direct.carrierHint}
                  </p>
                ) : (
                  waiting && <p className="mt-2 text-[13px] text-warn">{t.matching.chosenYouHint}</p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                {order.deadline_at && <Countdown deadline={order.deadline_at} />}

                {waiting ? (
                  <>
                    <form action={confirmAction} className="flex max-w-56 flex-col items-end gap-2">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="order_id" value={order.id} />
                      <Button type="submit" variant="primary" size="sm" className="w-full" disabled={confirming}>
                        {t.matching.confirm}
                      </Button>
                      {confirmState.error && (
                        <p role="alert" className="text-right text-xs text-danger">
                          {confirmState.error}
                        </p>
                      )}
                    </form>
                    {own && !declining ? (
                      <Button type="button" variant="danger" size="sm" className="w-full" onClick={() => setDeclining(true)}>
                        {t.matching.decline}
                      </Button>
                    ) : (
                      <form action={cancelOrderAction} className="flex max-w-56 flex-col items-end gap-2">
                        {own && <p className="text-right text-xs text-ink-muted">{t.own.declineConfirm}</p>}
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="order_id" value={order.id} />
                        <Button type="submit" variant="danger" size="sm" className="w-full">
                          {own ? t.own.declineYes : t.matching.decline}
                        </Button>
                        {own && (
                          <Button type="button" size="sm" className="w-full" onClick={() => setDeclining(false)}>
                            {t.action.cancel}
                          </Button>
                        )}
                      </form>
                    )}
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

                {/*
                  * Комментарий заказчика. На столе его нет (условия, п. 6.8:
                  * до назначения заметки не показываются), поэтому здесь —
                  * первое место, где его видит диспетчер перевозчика.
                  */}
                {order.comment && (
                  <p className="mt-4 rounded-control border border-line bg-sunken px-3 py-2 text-xs text-ink-muted">
                    {order.comment}
                  </p>
                )}
                {order.status === 'IN_PROGRESS' && (
                  <TripPanel stops={stops} haulKind={order.haul_kind} />
                )}

                {/*
                  * Свой рейс правит сам перевозчик: у его клиента входа нет.
                  * Точки — пока рейс идёт, как у заказчика; пробег и цена —
                  * до закрытия.
                  */}
                {own && order.status === 'IN_PROGRESS' && (
                  <AmendPanel orderId={order.id} stops={stops} haulKind={order.haul_kind} className="mt-4" />
                )}
                {own && (
                  <OwnEditPanel
                    orderId={order.id}
                    distanceKm={order.distance_km}
                    rateCents={order.rate_cents}
                    className="mt-4 rounded-control border border-line bg-sunken p-3"
                  />
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
                    own={own}
                  />
                )}

                <p className="mt-3 text-xs text-ink-dim">{t.matching.contactsNow}</p>

                {/* Переписка с заказчиком и водителем; диспетчер может ответить за водителя. */}
                <OrderChat orderId={order.id} lang={locale} className="mt-4" />
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
            {order.status === 'IN_PROGRESS' &&
              (stops.some((stop) => stop.completed_at) ? (
                /* После первой пройденной точки база отказ не примет — кнопку, которая всегда отвечает «нельзя», не показываем. */
                <p className="mt-4 border-t border-line pt-4 text-xs text-ink-muted">{t.lifecycle.started}</p>
              ) : (
                <AbandonPanel orderId={order.id} className="mt-4 border-t border-line pt-4" />
              ))}
          </CardBody>
        </Card>
  );
}
