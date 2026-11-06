'use client';

import { ForwarderPolicyNote, type ForwarderPolicyInfo } from '@/components/domain/ForwarderDirect';
import { ShipperTrustBadge } from '@/components/domain/ShipperTrust';
import type { ShipperTrust } from '@/lib/trust/model';
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
import { cancelOrderAction, confirmOrderAction, setTripTrailerAction } from '@/lib/orders/matching';
import { useI18n } from '@/lib/i18n/provider';
import { isTransfer } from '@/lib/orders/transfer';
import { AbandonPanel } from './AbandonPanel';
import { OrderChat } from '@/components/domain/OrderChat';
import { ClosingPanel } from './ClosingPanel';
import { TipperClosingPanel } from './TipperClosingPanel';
import { WasteLink } from '@/components/domain/WasteLink';
import { TripPanel } from './TripPanel';
import { OwnEditPanel } from './OwnEditPanel';
import { AmendPanel } from '../../shipper/orders/AmendPanel';
import { ChangeRequests, PricingNote, TripAssignmentPanel, VehicleCheckMark, type FleetOption, type OrderChangesData } from '@/components/domain/OrderChanges';
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
export type TripTrailerOption = { id: string; plate: string; kind: string; body_type: string | null; axles: number };

export function AssignmentCard({
  order,
  documentsByOrder,
  amendmentsByOrder,
  ownClient,
  currency = 'EUR',
  tripTrailerId = null,
  trailers = [],
  forwarderPolicy,
  shipperTrust,
  changes,
  fleet,
}: {
  /** Режим цены, пробег по маршруту, сообщения водителя. */
  changes?: OrderChangesData;
  /** Машины и водители компании для смены на рейсе. */
  fleet?: { vehicles: FleetOption[]; drivers: FleetOption[] };
  /** Сведения об оплате заказчика (рейс по прямому договору): справка, не гарантия. */
  shipperTrust?: ShipperTrust;
  /** Полис экспедитора-заказчика (рейс по прямому договору): справка, не гарантия оплаты. */
  forwarderPolicy?: ForwarderPolicyInfo;
  /** Валюта цены рейса (my_assignments её не отдаёт — страница читает отдельно). */
  currency?: string;
  /** Прицеп рейса перевозчика (конструктор сцепок) и прицепы компании для выбора. */
  tripTrailerId?: string | null;
  trailers?: TripTrailerOption[];
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
          /* Якорь для «Требует действия» на обзоре. */
          id={`trip-${order.id}`}
          className="scroll-mt-24"
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
                  {tripTrailerId && <Plate>+ {trailers.find((tr) => tr.id === tripTrailerId)?.plate ?? '…'}</Plate>}
                </div>

                <p className="mt-1.5 text-[13px] text-ink-muted">
                  {order.trailer ? `${order.trailer} · ` : ''}
                  {m('order.distance', { km: order.distance_km ?? 0 })} ·{' '}
                  <span className="font-semibold text-ink">{f.money(order.rate_cents ?? 0, currency)}</span>{' '}
                  {/* Рейс RAHTIS — в евро; справка в валюте компании рядом. */}
                  {order.rate_cents && f.approx(order.rate_cents, currency) ? (
                    <span className="text-ink-dim">({f.approx(order.rate_cents, currency)}) </span>
                  ) : null}
                  <span className="text-ink-dim">{t.money.addVat}</span>
                </p>
                {own ? (
                  <p className="mt-1 text-xs text-ink-dim">
                    {t.own.clientSection}: <span className="font-semibold text-ink-muted">{ownClient}</span>
                  </p>
                ) : (
                  order.shipper_name && <p className="mt-1 text-xs text-ink-dim">{order.shipper_name}</p>
                )}
                {!own && <ForwarderPolicyNote info={forwarderPolicy} className="mt-1" />}
                {!own && <ShipperTrustBadge trust={shipperTrust} className="mt-1" />}

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
            {/* Та ли машина приехала: сверка на первой погрузке. */}
            <VehicleCheckMark check={changes?.vehicleCheck} side="CARRIER" className="mt-3" />

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
              currency={currency}
              side="CARRIER"
              canAcknowledge={order.status === 'IN_PROGRESS' || order.status === 'AWAIT_DRIVER'}
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
                {/*
                  * Правки после назначения (6.11.2026): обе стороны, на любой
                  * стадии, всё в журнал. Сообщения водителя — правкой в одну кнопку.
                  */}
                {(order.status === 'IN_PROGRESS' || order.status === 'AWAIT_DRIVER') && (
                  <>
                    <p className="mt-3 rounded-control border border-line bg-sunken px-3 py-2 text-xs text-ink-muted">
                      {t.trustWins.changesRecorded}
                    </p>
                    <ChangeRequests requests={changes?.requests ?? []} className="mt-3" />
                    <PricingNote orderId={order.id} pricing={changes?.pricing} canPropose={!own} className="mt-3" />
                    {fleet && <TripAssignmentPanel orderId={order.id} vehicles={fleet.vehicles} drivers={fleet.drivers} className="mt-3" />}
                  </>
                )}
                {/* Стройка ведётся экраном объекта у водителя — точки здесь не отмечаются. */}
                {order.status === 'IN_PROGRESS' && order.haul_kind !== 'TIPPER' && (
                  <TripPanel stops={stops} haulKind={order.haul_kind} />
                )}

                {/*
                  * Свой рейс правит сам перевозчик: у его клиента входа нет.
                  * Точки — пока рейс идёт, как у заказчика; пробег и цена —
                  * до закрытия.
                  */}
                {(order.status === 'IN_PROGRESS' || order.status === 'AWAIT_DRIVER') && (
                  <AmendPanel
                    orderId={order.id}
                    stops={stops}
                    haulKind={order.haul_kind}
                    pricingMode={changes?.pricing?.mode}
                    className="mt-4"
                  />
                )}
                {own && (
                  <OwnEditPanel
                    orderId={order.id}
                    distanceKm={order.distance_km}
                    rateCents={order.rate_cents}
                    currency={currency}
                    className="mt-4 rounded-control border border-line bg-sunken p-3"
                  />
                )}

                {/*
                  * Закрытие появляется, когда пройдены все точки.
                  * Выполненного рейса здесь уже нет — он уходит во
                  * вкладку выполненных вместе с документами.
                  */}
                {/* Прицеп рейса: у отклика сцепкой — уже стоит; в своём и прямом рейсе — выбрать здесь. */}
                {(order.status === 'IN_PROGRESS' || order.status === 'AWAIT_DRIVER') && order.haul_kind !== 'TRAILER' && order.haul_kind !== 'CONTAINER' && trailers.length > 0 && (
                  <TripTrailerPicker orderId={order.id} current={tripTrailerId} trailers={trailers} />
                )}
                {order.status === 'IN_PROGRESS' && order.haul_kind === 'TIPPER' && <TipperClosingPanel orderId={order.id} />}
                {order.status === 'IN_PROGRESS' && order.haul_kind !== 'TIPPER' && (
                  <ClosingPanel
                    orderId={order.id}
                    stops={stops}
                    documents={documentsByOrder[order.id] ?? []}
                    closed={false}
                    own={own}
                  />
                )}

                <WasteLink orderId={order.id} className="mt-3 inline-block" />

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

/** Выбор прицепа рейса; подходит ли он машине и кузову заказа — решает база. */
function TripTrailerPicker({ orderId, current, trailers }: { orderId: string; current: string | null; trailers: TripTrailerOption[] }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(setTripTrailerAction, { error: null });
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-2 rounded-control border border-line bg-sunken p-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />
      <label className="flex flex-col gap-1 text-[13px]">
        <span className="label-micro">{t.combos.tripTrailer}</span>
        <select name="trailer_id" defaultValue={current ?? ''} className="h-9 rounded-control border border-line bg-surface px-2 text-[13px]">
          <option value="">{t.combos.none}</option>
          {trailers.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.plate} · {t.mass.kinds[tr.kind as keyof typeof t.mass.kinds]}
              {tr.body_type ? ` · ${t.mass.bodies[tr.body_type as keyof typeof t.mass.bodies]}` : ''}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="h-9 rounded-control border border-line bg-surface px-3 text-[13px] font-semibold">
        {t.combos.setTrailer}
      </button>
      {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
    </form>
  );
}
