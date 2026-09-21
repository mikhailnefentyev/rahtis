'use client';

import { Badge, Waypoint, WaypointList } from '@/components/ui';
import { stopTitle, type HaulKind } from '@/lib/orders/haul';
import { markOf } from '@/lib/orders/position';
import { useI18n } from '@/lib/i18n/provider';
import type { DeskStop, OrderStop, PlaceKind, StopRole } from '@/types/db';

/**
 * Маршрут заказа.
 *
 * Принимает и точку из таблицы, и точку со стола: у второй нет ни
 * контактов, ни получателя груза, и компонент их просто не запрашивает.
 * Тип с необязательными полями сделал бы отсутствие данных неотличимым
 * от незаполненного поля.
 */
type AnyStop = (OrderStop | DeskStop) & {
  contact_name?: string | null;
  contact_phone?: string | null;
  consignee?: string | null;
  /*
   * Координата отметки. У точки со стола её нет и быть не может: стол
   * показывает ещё не взятые заказы, в которых никто никуда не ездил.
   */
  arrived_at?: string | null;
  completed_at?: string | null;
  completed_lat?: number | null;
  completed_lon?: number | null;
  completed_accuracy_m?: number | null;
};

export function RouteStops({
  stops,
  haulKind = 'TRAILER',
}: {
  stops: AnyStop[];
  /* Забор и возврат называются по единице: у контейнера нет перевозчика прицепа. */
  haulKind?: HaulKind;
}) {
  const { t, m, f } = useI18n();

  const title = (stop: AnyStop) =>
    stop.role === 'PICKUP' && stop.place_kind
      ? `${stopTitle(t, 'PICKUP', haulKind)} · ${t.placeKind[stop.place_kind as PlaceKind]}`
      : stop.role === 'CONTINUATION' && stop.external_ref
        ? `${t.stopKind.CONTINUATION} · ${stop.external_ref}`
        : stopTitle(t, stop.role as StopRole, haulKind);

  /*
   * На концах рейса к месту добавляется состояние прицепа: его цепляют и
   * оставляют как с грузом, так и пустым, и водителю это надо знать до
   * приезда — от этого зависит, что он делает на площадке.
   */
  const primary = (stop: AnyStop) => {
    const base = stop.place_name ?? stop.company_name ?? stop.address;
    if (stop.trailer_loaded === null || stop.trailer_loaded === undefined) return base;
    return `${base} — ${stop.trailer_loaded ? t.orderForm.trailerLoaded : t.orderForm.trailerEmpty}`;
  };

  const secondary = (stop: AnyStop) => {
    const parts = [stop.address];
    if (stop.contact_name) {
      parts.push(stop.contact_phone ? `${stop.contact_name} · ${stop.contact_phone}` : stop.contact_name);
    }
    if (stop.consignee) {
      parts.push(m('stop.consignee', { label: t.order.consignee, name: stop.consignee }));
    }
    return parts.join(' · ');
  };

  /*
   * Дата и время — местные настенные, поэтому собираются из двух полей,
   * а не форматируются как момент времени.
   */
  const meta = (stop: AnyStop) => {
    if (!stop.scheduled_date) return undefined;
    const date = f.date(`${stop.scheduled_date}T12:00:00Z`);
    return stop.scheduled_time ? `${date} ${stop.scheduled_time.slice(0, 5)}` : date;
  };

  /*
   * Вес и пломба — то, по чему решают, берётся ли машина за рейс вообще.
   * Пилюлями, а не строкой: их ищут глазами, а не читают.
   */
  const tags = (stop: AnyStop) => {
    const chips: React.ReactNode[] = [];

    if (stop.cargo_weight_kg) {
      chips.push(
        <Badge key="weight" tone="neutral">
          {m('stop.weight', { tonnes: stop.cargo_weight_kg / 1000 })}
        </Badge>,
      );
    }
    if (stop.seal_required) {
      chips.push(
        <Badge key="seal" tone="warn">
          {t.order.sealRequired}
        </Badge>,
      );
    }

    /*
     * Отметка на карте — пилюлей рядом с весом, а не строкой мелким
     * шрифтом. Показывается только у пройденных точек: у непройденной её
     * отсутствие означает «ещё не были», и путать это с «были, но не
     * записались» нельзя — второе разбирают, первое нет.
     *
     * Показывается не координата, а расхождение с адресом. Пара чисел в
     * споре не говорит ничего; «отмечено в 4 км от адреса» говорит всё.
     */
    /*
     * Прибытие и окончание работ — из приложения водителя. По разнице
     * между ними виден простой на точке, ради которого прибытие и
     * отмечается отдельно.
     */
    if (stop.arrived_at) {
      chips.push(
        <Badge key="arrived" tone="neutral">
          {m('trip.arrivedAt', { time: f.time(stop.arrived_at) })}
        </Badge>,
      );
    }
    if (stop.completed_at) {
      chips.push(
        <Badge key="done" tone="ok">
          {m('trip.completedAt', { time: f.time(stop.completed_at) })}
        </Badge>,
      );
    }

    if (stop.completed_at) {
      const mark = markOf(stop);

      if (mark.kind === 'none') {
        chips.push(
          <Badge key="mark" tone="warn">
            {t.trip.noPosition}
          </Badge>,
        );
      } else if (mark.kind === 'unknown') {
        chips.push(
          <Badge key="mark" tone="neutral">
            {m('trip.markedHere')}
          </Badge>,
        );
      } else {
        chips.push(
          <Badge key="mark" tone={mark.kind === 'far' ? 'warn' : 'ok'}>
            {mark.kind === 'far'
              ? m('trip.markedFar', { km: mark.meters / 1000 })
              : m('trip.markedNear', { meters: mark.meters })}
          </Badge>,
        );
      }
    }

    return chips.length > 0 ? chips : undefined;
  };

  return (
    <WaypointList>
      {stops.map((stop) => (
        <Waypoint
          key={stop.id}
          kind={stop.role as StopRole}
          title={title(stop)}
          primary={primary(stop)}
          secondary={secondary(stop)}
          meta={meta(stop)}
          tags={tags(stop)}
          note={stop.note ?? undefined}
        />
      ))}
    </WaypointList>
  );
}
