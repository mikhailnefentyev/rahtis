import Link from 'next/link';
import { ackRouteChangesAction } from '@/lib/driverApp/actions';
import { getDriverI18n } from '@/lib/driverApp/i18n';
import type { Locale } from '@/lib/i18n';
import { loadDriverInbox } from '@/lib/inbox/driver';

/**
 * «Требует действия» водителя (6.11.2026): только то, чего нет на
 * карточках заданий, — правки маршрута без «Nähty» и смена, оставшаяся
 * открытой со вчерашнего дня. Кнопки крупные, под палец.
 */
export async function DriverInbox({ locale }: { locale: Locale }) {
  const [{ items }, { t, f }] = await Promise.all([loadDriverInbox(locale), getDriverI18n(locale)]);
  if (items.length === 0) return null;
  const d = t.driverApp;

  return (
    <section aria-label={d.needsTitle} className="flex flex-col gap-2">
      <p className="label-micro">{d.needsTitle}</p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key} className="flex flex-col gap-3 rounded-card border border-warn/40 bg-warn/10 px-4 py-3">
            {item.kind === 'routeChanged' && item.op?.op === 'driverAckChanges' ? (
              <>
                <div>
                  <p className="text-[17px] font-semibold">{d.needsRouteChanged}</p>
                  <p className="text-[15px] text-ink-muted">
                    <span className="font-mono">{item.ref}</span> · {d.needsRouteCount.replace('{count}', item.note ?? '1')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={item.href}
                    className="flex h-12 items-center justify-center rounded-control border border-line bg-surface text-[16px] font-semibold"
                  >
                    {d.open}
                  </Link>
                  <form action={ackRouteChangesAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="order_id" value={item.op.orderId} />
                    <button type="submit" className="h-12 w-full rounded-control bg-accent text-[16px] font-semibold text-accent-ink">
                      {d.routeChangedSeen}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[17px] font-semibold">{d.needsShiftOpen}</p>
                  {item.date && <p className="text-[15px] text-ink-muted">{d.needsShiftSince.replace('{date}', f.dateTime(item.date))}</p>}
                </div>
                <a href={item.href} className="flex h-12 items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-accent-ink">
                  {d.needsShiftAction}
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
