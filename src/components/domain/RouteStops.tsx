'use client';

import { Waypoint, WaypointList } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import type { DeskStop, OrderStop, PlaceKind, StopRole } from '@/types/db';

/**
 * Маршрут заказа.
 *
 * Принимает и точку из таблицы, и точку со стола: у второй контактных
 * полей нет вовсе, и компонент их просто не запрашивает. Тип с
 * необязательными контактами сделал бы отсутствие данных неотличимым от
 * незаполненного поля.
 */
type AnyStop = (OrderStop | DeskStop) & {
  contact_name?: string | null;
  contact_phone?: string | null;
};

export function RouteStops({ stops }: { stops: AnyStop[] }) {
  const { t, f } = useI18n();

  const title = (stop: AnyStop) =>
    stop.role === 'PICKUP' && stop.place_kind
      ? `${t.stopKind.PICKUP} · ${t.placeKind[stop.place_kind as PlaceKind]}`
      : stop.role === 'CONTINUATION' && stop.external_ref
        ? `${t.stopKind.CONTINUATION} · ${stop.external_ref}`
        : t.stopKind[stop.role as StopRole];

  const primary = (stop: AnyStop) => {
    const base = stop.place_name ?? stop.company_name ?? stop.address;
    if (stop.role === 'TRAILER_RETURN') {
      return `${base} — ${stop.returns_loaded ? t.orderForm.returnLoaded : t.orderForm.returnEmpty}`;
    }
    return base;
  };

  const secondary = (stop: AnyStop) => {
    const parts = [stop.address];
    if (stop.contact_name) {
      parts.push(stop.contact_phone ? `${stop.contact_name} · ${stop.contact_phone}` : stop.contact_name);
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
        />
      ))}
    </WaypointList>
  );
}
