'use client';

import { useMemo, useState } from 'react';
import { HaulBadge } from '@/components/domain/HaulBadge';
import { Badge, Card, CardBody, Mono, Plate } from '@/components/ui';
import { orderStatusTone } from '@/components/ui/tone';
import { useI18n } from '@/lib/i18n/provider';
import { AssignmentCard } from './AssignmentCard';
import type { Database } from '@/types/database';
import type { OrderAmendment, OrderStop, TripDocument } from '@/types/db';

type Assignment = Database['public']['Functions']['my_assignments']['Returns'][number];

/**
 * Рейсы, закреплённые за перевозчиком.
 *
 * Устроены так же, как список у заказчика, и по той же причине: парк на
 * двадцать машин закрепляет двадцать рейсов, а карточка каждого рисует
 * маршрут с картой. На пяти это удобно, на двадцати — стена.
 *
 * Полосы по тому, чего ждут от перевозчика: подтвердить (идёт отсчёт,
 * карточка раскрыта всегда), затем то, что уже едет. Снятые отделены и
 * показаны короткой карточкой — она сообщает, а не просит.
 *
 * Внутри «в пути» — по ближайшей непройденной точке: у едущего рейса
 * загрузка позади, и сортировать его по ней значит прижать к низу самый
 * живой рейс.
 */

/** Ближайшая непройденная точка: то, что случится с рейсом следующим. */
function nextStopKey(stops: OrderStop[]): string {
  const next = [...stops].sort((a, b) => a.sequence - b.sequence).find((s) => !s.completed_at);
  if (!next?.scheduled_date) return '9999-99-99';
  return `${next.scheduled_date} ${next.scheduled_time ?? '99:99'}`;
}

function stopsOf(order: Assignment): OrderStop[] {
  return (order.stops ?? []) as unknown as OrderStop[];
}

export function Assignments({
  assignments,
  documentsByOrder,
  amendmentsByOrder,
}: {
  assignments: Assignment[];
  documentsByOrder: Record<string, TripDocument[]>;
  amendmentsByOrder: Record<string, OrderAmendment[]>;
}) {
  const { t } = useI18n();
  /* Раскрыт один рейс за раз, как и у заказчика. */
  const [opened, setOpened] = useState<string | null>(null);

  const bands = useMemo(() => {
    const confirm: Assignment[] = [];
    const running: Assignment[] = [];
    const cancelled: Assignment[] = [];

    for (const order of assignments) {
      if (order.status === 'CANCELLED') cancelled.push(order);
      else if (order.status === 'AWAIT_DRIVER') confirm.push(order);
      else running.push(order);
    }

    running.sort((a, b) => nextStopKey(stopsOf(a)).localeCompare(nextStopKey(stopsOf(b))));

    return { confirm, running, cancelled };
  }, [assignments]);

  if (assignments.length === 0) return null;

  const { cancelled } = bands;

  function card(order: Assignment) {
    return (
      <AssignmentCard
        order={order}
        documentsByOrder={documentsByOrder}
        amendmentsByOrder={amendmentsByOrder}
      />
    );
  }

  return (
    <section className="mb-8">
      <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
        {t.matching.assignments}
      </h2>

      {/* Отсчёт идёт — карточка раскрыта: подтверждать надо сейчас. */}
      {bands.confirm.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          {bands.confirm.map((order) => (
            <div key={order.id}>{card(order)}</div>
          ))}
        </div>
      )}

      {bands.running.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line">
          {bands.running.map((order) => (
            <TripRow
              key={order.id}
              order={order}
              open={opened === order.id}
              onToggle={() => setOpened(opened === order.id ? null : order.id)}
            >
              {card(order)}
            </TripRow>
          ))}
        </div>
      )}

            {cancelled.length > 0 && (
        <div className="mt-6">
          <p className="label-micro mb-2">{t.matching.cancelledTrips}</p>
          <div className="flex flex-col gap-2">
            {cancelled.map((order) => (
              <CancelledTrip
                key={order.id}
                order={order}
                amendments={amendmentsByOrder[order.id] ?? []}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Строка идущего рейса.
 *
 * То, по чему рейс узнают с одного взгляда: состояние, номер, единица,
 * направление и время ближайшей непройденной точки. Именно ближайшей, а
 * не загрузки: у едущего рейса важно, что будет дальше.
 */
function TripRow({
  order,
  open,
  onToggle,
  children,
}: {
  order: Assignment;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { t, f } = useI18n();

  const stops = stopsOf(order);
  const pickup = stops.find((s) => s.role === 'PICKUP');
  const delivery = stops.find((s) => s.role === 'DELIVERY');
  const next = [...stops].sort((a, b) => a.sequence - b.sequence).find((s) => !s.completed_at);
  const done = stops.filter((s) => s.completed_at).length;

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
        <HaulBadge haulKind={order.haul_kind} containerFeet={order.container_feet} />
        {order.trailer_plate && <Plate>{order.trailer_plate}</Plate>}

        {pickup && (
          <span className="font-mono text-[13px] tracking-tight text-accent">
            {pickup.city}
            {delivery ? ` → ${delivery.city}` : ''}
          </span>
        )}

        {/* Сколько точек позади: этап рейса одним числом. */}
        <Mono className="text-xs text-ink-muted">
          {done}/{stops.length}
        </Mono>

        {next?.scheduled_date && (
          <Mono className="text-xs text-ink-muted">
            {f.date(next.scheduled_date)}
            {next.scheduled_time ? ` ${next.scheduled_time.slice(0, 5)}` : ''}
          </Mono>
        )}

        <span className="ml-auto text-[13px] font-semibold text-ink">
          {/*
            * Ставка заказчика, как и в карточке рядом: выплату за
            * вычетом комиссии перевозчик видит в недельном отчёте, где
            * рядом стоит сама комиссия. Показать здесь одно число без
            * второго значило бы предложить гадать, какое это из двух.
            */}
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

/**
 * Снятый рейс одной строкой.
 *
 * Показывает ровно то, ради чего он здесь остался: номер, маршрут и
 * причину. Причина берётся из журнала заказа, а не из отдельного поля —
 * там она лежит вместе с автором и временем, и второй экземпляр той же
 * строки однажды разошёлся бы с первым.
 *
 * Причины может не быть: поле необязательное, и пустое честнее
 * выдуманного. Тогда строка просто говорит, что рейс снят.
 */
function CancelledTrip({
  order,
  amendments,
}: {
  order: Assignment;
  amendments: OrderAmendment[];
}) {
  const { t, m, f } = useI18n();

  const stops = (order.stops ?? []) as unknown as OrderStop[];
  const from = stops.find((s) => s.role === 'PICKUP')?.city;
  const to = stops[stops.length - 1]?.city;

  const event = amendments.find((a) => a.kind === 'ORDER_CANCELLED');
  const changes = (event?.changes ?? {}) as Record<string, { to?: unknown }>;
  const reason = String(changes.reason?.to ?? '').trim();

  return (
    <Card stripe="danger">
      <CardBody className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger">{t.orderStatus.CANCELLED}</Badge>
            <HaulBadge haulKind={order.haul_kind} containerFeet={order.container_feet} />
            <Mono className="text-xs text-ink-dim">{order.ref}</Mono>
            {order.trailer_plate && <Plate>{order.trailer_plate}</Plate>}
          </div>

          {from && to && (
            <p className="mt-1.5 font-mono text-[13px] text-ink-muted">
              {from} → {to}
            </p>
          )}

          <p className="mt-1 text-xs text-ink-muted">
            {reason ? `${t.lifecycle.fieldReason}: ${reason}` : t.lifecycle.cancelled}
          </p>
        </div>

        {event && (
          <Mono className="text-[11px] text-ink-dim">
            {m('amend.madeAt', { date: f.dateTime(event.created_at) })}
          </Mono>
        )}
      </CardBody>
    </Card>
  );
}
