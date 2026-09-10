'use client';

import { useMemo, useState } from 'react';
import { HaulBadge } from '@/components/domain/HaulBadge';
import { Badge, Button, EmptyState, Mono, Plate } from '@/components/ui';
import { orderStatusTone } from '@/components/ui/tone';
import { useI18n } from '@/lib/i18n/provider';
import type { OrderAmendment, OrderStop, ShipperOffer, ShipperOrder } from '@/types/db';
import { OrderCard } from './OrderCard';

/**
 * Список заказов заказчика.
 *
 * Раньше это был плоский список развёрнутых карточек, отсортированный по
 * дате заведения. На пяти заказах так было удобно; на тридцати — а
 * компания, отдающая по тридцать прицепов в день, к этому и идёт, —
 * рассыпается сразу по трём причинам.
 *
 * Первая: порядок не тот. Диспетчер думает «что грузится сегодня», а не
 * «что я завёл последним», и заказ, заведённый вчера на пятницу, стоял
 * выше заказа, заведённого утром на сегодня.
 *
 * Вторая: в одном списке лежали четыре состояния с несравнимой
 * срочностью. Ждущий откликов заказ, с которым делать нечего, занимал
 * столько же места, сколько заказ с пятнадцатиминутным отсчётом.
 *
 * Третья: каждая карточка рисовала маршрут и карту. Тридцать заказов —
 * тридцать карт на одной странице.
 *
 * Отсюда устройство: три полосы по тому, кто кого ждёт, внутри — по дате
 * загрузки, и строка вместо карточки. Карточка раскрывается по одной.
 *
 * Резать активные по возрасту нельзя, и это стоит сказать прямо: заказ на
 * загрузку через две недели заведён сегодня, а рейс, идущий третьи сутки,
 * заведён позавчера. Возраст — ось выполненных, а не работающих.
 */

/** Момент загрузки строкой для сортировки: дата плюс время, пустое — в конец. */
function pickupKey(stops: OrderStop[]): string {
  const pickup = stops.find((s) => s.role === 'PICKUP');
  if (!pickup?.scheduled_date) return '9999-99-99';
  return `${pickup.scheduled_date} ${pickup.scheduled_time ?? '99:99'}`;
}

/**
 * Ближайшая непройденная точка идущего рейса.
 *
 * У едущего заказа загрузка уже позади, и сортировать его по ней значит
 * прижать к низу самый живой рейс. Важно то, что случится следующим.
 */
function nextStopKey(stops: OrderStop[]): string {
  const next = [...stops]
    .sort((a, b) => a.sequence - b.sequence)
    .find((s) => !s.completed_at);
  if (!next?.scheduled_date) return pickupKey(stops);
  return `${next.scheduled_date} ${next.scheduled_time ?? '99:99'}`;
}

export function OrdersView({
  orders,
  stopsByOrder,
  offersByOrder,
  amendmentsByOrder,
}: {
  orders: ShipperOrder[];
  stopsByOrder: Record<string, OrderStop[]>;
  offersByOrder: Record<string, ShipperOffer[]>;
  amendmentsByOrder: Record<string, OrderAmendment[]>;
}) {
  const { t, m } = useI18n();
  const [composing, setComposing] = useState(false);
  const [OrderForm, setOrderForm] = useState<React.ComponentType<{ onPublished: () => void }> | null>(
    null,
  );
  /* Раскрыт один заказ за раз: иначе список снова превращается в ленту карточек. */
  const [opened, setOpened] = useState<string | null>(null);

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

  const bands = useMemo(() => {
    const decide: ShipperOrder[] = [];
    const running: ShipperOrder[] = [];
    const waiting: ShipperOrder[] = [];

    for (const order of orders) {
      /*
       * Отсчёт решает, а не статус: пятнадцать минут идут и когда выбирают
       * перевозчика, и когда подтверждает водитель. Пока они идут, заказ
       * ждёт нас, а не мы его.
       */
      if (order.deadline_at) decide.push(order);
      else if (order.status === 'IN_PROGRESS') running.push(order);
      else waiting.push(order);
    }

    const by = (key: (stops: OrderStop[]) => string) => (a: ShipperOrder, b: ShipperOrder) =>
      key(stopsByOrder[a.id] ?? []).localeCompare(key(stopsByOrder[b.id] ?? []));

    decide.sort(by(pickupKey));
    running.sort(by(nextStopKey));
    waiting.sort(by(pickupKey));

    return { decide, running, waiting };
  }, [orders, stopsByOrder]);

  function card(order: ShipperOrder) {
    return (
      <OrderCard
        order={order}
        stops={stopsByOrder[order.id] ?? []}
        offers={offersByOrder[order.id] ?? []}
        amendments={amendmentsByOrder[order.id] ?? []}
      />
    );
  }

  function band(title: string, list: ShipperOrder[], expanded: boolean) {
    if (list.length === 0) return null;

    return (
      <section className="mt-6 first:mt-0">
        <h3 className="label-micro mb-2.5 flex items-center gap-2">
          {title}
          <span className="text-ink-dim">{list.length}</span>
        </h3>

        {expanded ? (
          <div className="flex flex-col gap-3">{list.map((order) => <div key={order.id}>{card(order)}</div>)}</div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line">
            {list.map((order) => (
              <Row
                key={order.id}
                order={order}
                stops={stopsByOrder[order.id] ?? []}
                open={opened === order.id}
                onToggle={() => setOpened(opened === order.id ? null : order.id)}
              >
                {card(order)}
              </Row>
            ))}
          </div>
        )}
      </section>
    );
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
        <>
          {/* Отсчёт идёт — карточка раскрыта всегда: решать надо сейчас. */}
          {band(t.orders.bandDecide, bands.decide, true)}
          {band(t.orders.bandRunning, bands.running, false)}
          {band(t.orders.bandWaiting, bands.waiting, false)}
        </>
      )}
    </>
  );
}

/**
 * Строка списка.
 *
 * Всё, по чему заказ узнают с одного взгляда: состояние, номер, свой
 * номер заказчика, единица, направление и час загрузки. Ставка справа —
 * по ней сверяют, а не ищут.
 */
function Row({
  order,
  stops,
  open,
  onToggle,
  children,
}: {
  order: ShipperOrder;
  stops: OrderStop[];
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { t, f } = useI18n();

  const pickup = stops.find((s) => s.role === 'PICKUP');
  const delivery = stops.find((s) => s.role === 'DELIVERY');

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left hover:bg-sunken"
      >
        <Badge tone={orderStatusTone[order.status]}>{t.orderStatus[order.status]}</Badge>
        <Mono className="text-xs text-ink-dim">{order.ref}</Mono>
        {order.shipper_ref && (
          <Mono className="text-xs text-ink-dim">{order.shipper_ref}</Mono>
        )}
        <HaulBadge haulKind={order.haul_kind} containerFeet={order.container_feet} />
        {order.trailer_plate && <Plate>{order.trailer_plate}</Plate>}

        {pickup && (
          <span className="font-mono text-[13px] tracking-tight text-accent">
            {pickup.city}
            {delivery ? ` → ${delivery.city}` : ''}
          </span>
        )}

        {pickup?.scheduled_date && (
          <Mono className="text-xs text-ink-muted">
            {f.date(pickup.scheduled_date)}
            {pickup.scheduled_time ? ` ${pickup.scheduled_time.slice(0, 5)}` : ''}
          </Mono>
        )}

        <span className="ml-auto text-[13px] font-semibold text-ink">
          {f.eur(order.rate_cents ?? 0)}
        </span>
        <span aria-hidden className="text-ink-dim">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
