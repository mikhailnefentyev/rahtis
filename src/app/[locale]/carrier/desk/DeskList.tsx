'use client';

import { useState } from 'react';
import { RouteStops } from '@/components/domain/RouteStops';
import { Button, Card, CardBody, CardDivider, EmptyState, Mono } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import type { DeskOrder, DeskStop } from '@/types/db';

/**
 * Стол заказов.
 *
 * Маршрут приходит уже без контактов получателя — их не отдаёт функция
 * desk_orders. Об этом сказано прямо в карточке: иначе перевозчик решит,
 * что заказчик не заполнил контакт.
 */
export function DeskList({ orders }: { orders: DeskOrder[] }) {
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
                  </div>

                  <p className="mt-2 font-mono text-sm tracking-tight text-accent">
                    {order.pickup_city} → {order.delivery_city ?? '—'}
                  </p>

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

                  <p className="mt-1 text-xs text-ink-dim">{order.shipper_name}</p>

                  {order.pickup_date && (
                    <p className="mt-1 font-mono text-xs text-ink-faint">
                      {f.date(`${order.pickup_date}T12:00:00Z`)}
                      {order.pickup_time ? ` ${order.pickup_time.slice(0, 5)}` : ''}
                    </p>
                  )}
                </div>

                <Button size="sm" onClick={() => setExpanded(open ? null : order.id)}>
                  {t.desk.details}
                </Button>
              </div>

              {open && (
                <>
                  <CardDivider className="my-4" />
                  <p className="label-micro mb-3">
                    {m('order.stopsCount', { count: stops.length })}
                  </p>
                  <RouteStops stops={stops} />

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
