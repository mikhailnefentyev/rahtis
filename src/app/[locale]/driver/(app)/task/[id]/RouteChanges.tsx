'use client';

import { useActionState, useState } from 'react';
import { ackRouteChangesAction, reportDifferentAddressAction, type DriverState } from '@/lib/driverApp/actions';
import { useI18n } from '@/lib/i18n/provider';

/*
 * Правки маршрута глазами водителя (6.11.2026): адреса меняют заказчик
 * и перевозчик в RAHTIS, каждая правка записана. Водитель видит свои
 * правки с кнопкой «Видел» и сам маршрут не правит — сообщает о другом
 * адресе, правкой его делает диспетчер или заказчик.
 */

export type DriverRouteChange = {
  id: number;
  kind: string;
  stopLabel: string;
  changes: Record<string, { from?: unknown; to?: unknown }>;
  createdAt: string;
  reason: string | null;
};

/** Постоянная строка на рейсе: адреса — только через приложение. */
export function RouteNotice() {
  const { t } = useI18n();
  return <p className="rounded-control border border-line bg-sunken px-3 py-2 text-[13px] text-ink-muted">{t.driverApp.routeNotice}</p>;
}

export function RouteChanges({ orderId, changes }: { orderId: string; changes: DriverRouteChange[] }) {
  const { t, f, locale } = useI18n();
  const d = t.driverApp;
  if (changes.length === 0) return null;

  const kindLabel = (kind: string) => (kind === 'STOP_ADDED' ? d.routeAdded : kind === 'STOP_REMOVED' ? d.routeRemoved : d.routeChanged);
  const value = (field: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (field === 'scheduled_date') return f.date(`${String(v)}T12:00:00Z`);
    if (field === 'scheduled_time') return String(v).slice(0, 5);
    return String(v);
  };
  const shown: [string, string][] = [
    ['address', d.routeFieldAddress],
    ['scheduled_date', d.routeFieldDate],
    ['scheduled_time', d.routeFieldTime],
    ['consignee', d.routeFieldConsignee],
  ];

  return (
    <section className="rounded-card border-2 border-warn bg-warn/10 px-4 py-3">
      <p className="text-[17px] font-semibold">{d.routeChangedTitle}</p>
      <p className="text-[14px] text-ink-muted">{d.routeChangedHint}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {changes.map((c) => {
          const lines = shown.filter(([k]) => k in c.changes);
          const other = Object.keys(c.changes).some((k) => !shown.some(([s]) => s === k));
          return (
            <li key={c.id} className="text-[15px]">
              <span className="font-semibold">
                {kindLabel(c.kind)} · {c.stopLabel}
              </span>{' '}
              <span className="text-[13px] text-ink-muted">{f.dateTime(c.createdAt)}</span>
              {lines.map(([k, label]) => (
                <span key={k} className="block">
                  {label}: {c.kind === 'STOP_ADDED' ? value(k, c.changes[k]?.to) : `${value(k, c.changes[k]?.from)} → ${value(k, c.changes[k]?.to)}`}
                </span>
              ))}
              {other && c.kind === 'STOP_CHANGED' && <span className="block text-[13px] text-ink-muted">{d.routeFieldOther}</span>}
              {c.reason && <span className="block text-[13px] text-ink-muted">{d.routeReason.replace('{reason}', c.reason)}</span>}
            </li>
          );
        })}
      </ul>
      <form action={ackRouteChangesAction} className="mt-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="order_id" value={orderId} />
        <button type="submit" className="flex h-12 w-full items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-accent-ink">
          {d.routeChangedSeen}
        </button>
      </form>
    </section>
  );
}

const idle: DriverState = { error: null, done: false };

/** «Другой адрес»: текст, при желании адрес и место с телефона. */
export function ReportAddress({ orderId, stops }: { orderId: string; stops: { id: string; label: string }[] }) {
  const { t, locale } = useI18n();
  const d = t.driverApp;
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [state, action, pending] = useActionState(reportDifferentAddressAction, idle);

  if (state.done) return <p className="text-[15px] font-semibold text-ok">{d.reportSent}</p>;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 items-center justify-center rounded-control border border-line bg-surface text-[15px] font-semibold"
      >
        {d.reportAddress}
      </button>
    );
  }

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setPoint({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setPoint(null),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <form action={action} className="flex flex-col gap-2 rounded-card border border-line bg-surface px-4 py-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />
      {point && (
        <>
          <input type="hidden" name="lat" value={point.lat} />
          <input type="hidden" name="lon" value={point.lon} />
        </>
      )}
      <p className="text-[15px] font-semibold">{d.reportAddress}</p>
      <p className="text-[13px] text-ink-muted">{d.reportAddressHint}</p>
      <label className="flex flex-col gap-1 text-[14px]">
        {d.reportStop}
        <select name="stop_id" className="h-12 rounded-control border border-line bg-surface px-3 text-[15px]" defaultValue={stops[0]?.id ?? ''}>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[14px]">
        {d.reportMessage}
        <textarea name="message" required maxLength={500} rows={3} className="rounded-control border border-line bg-surface px-3 py-2 text-[15px]" />
      </label>
      <label className="flex flex-col gap-1 text-[14px]">
        {d.reportNewAddress}
        <input name="address" maxLength={300} className="h-12 rounded-control border border-line bg-surface px-3 text-[15px]" />
      </label>
      <button type="button" onClick={locate} className="flex h-11 items-center justify-center rounded-control border border-line text-[14px] font-semibold">
        {point ? d.reportPositionAdded : d.reportUsePosition}
      </button>
      {state.error && <p className="text-[14px] text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="flex h-12 items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-accent-ink">
        {d.reportSend}
      </button>
    </form>
  );
}
