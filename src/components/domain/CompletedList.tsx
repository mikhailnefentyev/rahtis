'use client';

import { useMemo, useState } from 'react';
import { OrderRouteMap } from '@/components/domain/RouteMap';
import { HaulBadge } from '@/components/domain/HaulBadge';
import { RouteStops } from '@/components/domain/RouteStops';
import { RateTrip } from '@/components/domain/RateTrip';
import { DocumentList } from '@/components/domain/TripDocuments';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Kv,
  Mono,
  Plate,
  Stars,
} from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import type { CompletedOrder, OrderStop, TripDocument, WeeklyTotal } from '@/types/db';

/**
 * Выполненные рейсы, собранные по неделям (ТЗ §11).
 *
 * Компонент намеренно ничего не знает о ролях. База уже решила, что
 * каждой из них видно: заказчику комиссия приходит пустой, перевозчику —
 * имя заказчика заполненным, оператору — обе стороны. Здесь показывается
 * то, что пришло, и добавить условие «если перевозчик» тут значило бы
 * завести второе место, где решается тот же вопрос.
 *
 * Неделя — единица, в которой живут деньги: по ней выставляют счёт и по
 * ней платят. Поэтому итог стоит в заголовке секции, а не в конце
 * списка: сумма — это то, ради чего страницу открыли, а рейсы под ней —
 * её расшифровка.
 */
export function CompletedList({
  orders,
  totals,
}: {
  orders: CompletedOrder[];
  totals: WeeklyTotal[];
}) {
  const { t, m, f } = useI18n();
  const [opened, setOpened] = useState<string | null>(null);

  const weeks = useMemo(() => {
    const byWeek = new Map<string, CompletedOrder[]>();
    for (const order of orders) {
      const key = order.week ?? '';
      const list = byWeek.get(key);
      if (list) list.push(order);
      else byWeek.set(key, [order]);
    }
    return [...byWeek.entries()];
  }, [orders]);

  if (orders.length === 0) {
    return <EmptyState title={t.done.none} description={t.done.noneHint} />;
  }

  const totalOf = (week: string) => totals.find((x) => x.week === week);

  return (
    <div className="flex flex-col gap-8">
      {weeks.map(([week, list]) => {
        const sum = totalOf(week);

        return (
          <section key={week}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-2">
              <h2 className="text-[13px] font-semibold tracking-tight text-ink">
                {m('done.weekOf', { date: f.date(`${week}T12:00:00Z`) })}
              </h2>

              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px]">
                <span className="text-ink-muted">
                  {m('order.tripsCount', { count: list.length })}
                </span>

                {/*
                 * Ставка — то, что заказчик платит оператору. Перевозчику
                 * она тоже видна: это цена, о которой он договорился, и
                 * прятать её, показывая только выплату, значило бы просить
                 * поверить в вычитание на слово.
                 */}
                <span className="text-ink-muted">
                  {t.done.rate}{' '}
                  <span className="font-semibold text-ink">
                    {f.eur(Number(sum?.rate_cents ?? 0))}
                  </span>
                </span>

                {sum?.commission_cents != null && (
                  <span className="text-ink-dim">
                    {t.done.commission} {f.eur(Number(sum.commission_cents))}
                  </span>
                )}

                {sum?.payout_cents != null && (
                  <span className="text-ink-muted">
                    {t.done.payout}{' '}
                    <span className="font-semibold text-ok">
                      {f.eur(Number(sum.payout_cents))}
                    </span>
                  </span>
                )}

                {/* Все числа выше нетто — налог добавляется в счёте. */}
                <span className="text-ink-dim">{t.money.addVat}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {list.map((order) => {
                const open = opened === order.id;
                const stops = (order.stops ?? []) as unknown as OrderStop[];
                const documents = (order.documents ?? []) as unknown as TripDocument[];
                const first = stops[0];
                const last = stops[stops.length - 1];

                return (
                  <Card key={order.id} stripe={open ? 'ok' : 'neutral'}>
                    <CardBody>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <Badge tone="ok">{t.orderStatus.DONE}</Badge>
                            {/* Что везли — и в закрытом рейсе: по нему разбирают спор. */}
                            <HaulBadge
                              haulKind={order.haul_kind}
                              containerFeet={order.container_feet}
                            />
                            <Mono className="text-xs text-ink-dim">{order.ref}</Mono>
                            {order.shipper_ref && (
                              <Mono className="text-xs text-ink-dim">{order.shipper_ref}</Mono>
                            )}
                            {order.trailer_plate && <Plate>{order.trailer_plate}</Plate>}
                            {order.vehicle_plate && <Plate>{order.vehicle_plate}</Plate>}
                          </div>

                          {first && last && (
                            <p className="mt-2 font-mono text-sm tracking-tight text-accent">
                              {first.city} → {last.city}
                            </p>
                          )}

                          <p className="mt-1.5 text-[13px] text-ink-muted">
                            {m('order.distance', { km: order.distance_km ?? 0 })}
                            {order.shipper_name ? ` · ${order.shipper_name}` : ''}
                            {order.carrier_name ? ` · ${order.carrier_name}` : ''}
                          </p>

                          {order.closed_at && (
                            <p className="mt-1 text-xs text-ink-dim">
                              {m('done.closedAt', { date: f.dateTime(order.closed_at) })}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-[15px] font-semibold text-ink">
                            {f.eur(order.rate_cents ?? 0)}
                          </span>

                          {order.payout_cents != null && (
                            <span className="text-xs text-ink-muted">
                              {t.done.payout}{' '}
                              <span className="font-semibold text-ok">
                                {f.eur(order.payout_cents)}
                              </span>
                            </span>
                          )}

                          {/*
                           * Оценка видна и в свёрнутой строке: заказчик
                           * ищет глазами неоценённые рейсы, а перевозчик —
                           * те, где ему что-то поставили.
                           */}
                          {order.rating_score != null && <Stars value={order.rating_score} />}

                          <Button size="sm" onClick={() => setOpened(open ? null : order.id)}>
                            {open ? t.done.collapse : t.done.open}
                          </Button>
                        </div>
                      </div>

                      {/*
                       * Развёрнутое содержимое рисуется по нажатию, но
                       * данные для него приехали вместе со списком: рейс
                       * закрыт, меняться ему больше нечем, и второй поход
                       * в базу дал бы задержку без единого нового факта.
                       */}
                      {open && (
                        <div className="mt-4 border-t border-line pt-4">
                          <div className="mb-4 grid gap-1.5 sm:grid-cols-2">
                            <Kv k={t.order.trailer} v={order.trailer ?? '—'} />
                            <Kv
                              k={t.order.ratePerKm}
                              v={
                                <Mono>
                                  {order.distance_km && order.rate_cents
                                    ? (f.eurPerKm(order.rate_cents, order.distance_km) ?? '—')
                                    : '—'}
                                </Mono>
                              }
                            />
                            {order.commission_cents != null && (
                              <Kv
                                k={t.done.commission}
                                v={
                                  <Mono>
                                    {f.eur(order.commission_cents)}
                                    {order.commission_bps != null &&
                                      ` · ${m('done.bps', { rate: order.commission_bps / 10000 })}`}
                                  </Mono>
                                }
                              />
                            )}
                            {order.payout_cents != null && (
                              <Kv k={t.done.payout} v={<Mono>{f.eur(order.payout_cents)}</Mono>} />
                            )}
                          </div>

                          {stops.length > 0 && (
                            <>
                              <p className="label-micro mb-2.5">
                                {m('order.stopsCount', { count: stops.length })}
                              </p>
                              <RouteStops stops={stops} haulKind={order.haul_kind} />
                              <OrderRouteMap
                                geometry={order.route_geometry}
                                bounds={order.route_bounds as number[] | null}
                                stops={stops}
                                haulKind={order.haul_kind}
                                className="mt-4"
                              />
                            </>
                          )}

                          <div className="mt-4">
                            <p className="label-micro mb-2.5">{t.trip.documents}</p>
                            <DocumentList documents={documents} />
                          </div>

                          {/*
                           * Право оценить решает база: у заказчика рейса с
                           * назначенным перевозчиком can_rate истинно, у
                           * остальных нет. Условие «если заказчик» здесь
                           * завело бы второе место, где это решается.
                           */}
                          {order.can_rate ? (
                            <RateTrip
                              orderId={order.id}
                              score={order.rating_score}
                              comment={order.rating_comment}
                              className="mt-4 border-t border-line pt-4"
                            />
                          ) : (
                            order.rating_score != null && (
                              <div className="mt-4 border-t border-line pt-4">
                                <p className="label-micro mb-2">{t.rating.received}</p>
                                <Stars value={order.rating_score} />
                                {order.rating_comment && (
                                  <p className="mt-2 rounded-control border border-line bg-sunken px-3 py-2 text-xs text-ink-muted">
                                    {order.rating_comment}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
