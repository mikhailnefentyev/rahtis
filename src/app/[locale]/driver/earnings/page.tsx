import Link from 'next/link';
import { notFound } from 'next/navigation';
import { todayInHelsinki } from '@/lib/dates';
import { getDriverEarnings, monthOf, shiftMonth } from '@/lib/driverApp/earnings';
import { getDriver } from '@/lib/driverApp/session';
import { getI18n, isLocale } from '@/lib/i18n';

/**
 * Ansiot — сколько водитель заработал.
 *
 * Сверху крупно — сумма за месяц. Ниже дни, свежие сверху: у дня его
 * сумма и нарастающий итог месяца, под ним рейсы — с суммой, если деньги
 * считаются от рейса. Оговорка, что расчёт ориентировочный, — один раз,
 * под итогом: повторённая у каждой строки, она перестаёт читаться.
 */
export default async function DriverEarnings({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ locale }, { month: asked }] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const month = monthOf(asked);
  const [driver, earnings, { t, m, f }] = await Promise.all([
    getDriver(),
    getDriverEarnings(month),
    getI18n(locale),
  ]);
  if (!driver) return null;

  const current = todayInHelsinki().slice(0, 7);
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
  const dayName = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const hours = (minutes: number) => m('driverApp.earnHours', { hours: f.decimal(minutes / 60, 1) });
  const base = `/${locale}/driver/earnings`;

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.driverApp.earnings}</h1>
        <nav className="flex items-center gap-1">
          <Link
            href={`${base}?month=${shiftMonth(month, -1)}`}
            className="flex h-11 w-11 items-center justify-center rounded-control border border-line text-xl"
            aria-label="‹"
          >
            ‹
          </Link>
          <span className="min-w-32 text-center text-[15px] font-semibold capitalize">{monthName}</span>
          {month < current ? (
            <Link
              href={`${base}?month=${shiftMonth(month, 1)}`}
              className="flex h-11 w-11 items-center justify-center rounded-control border border-line text-xl"
              aria-label="›"
            >
              ›
            </Link>
          ) : (
            <span className="h-11 w-11" />
          )}
        </nav>
      </header>

      <section className="rounded-card bg-ink px-5 py-5 text-surface">
        <p className="text-[15px] opacity-80">{t.driverApp.earningsMonth}</p>
        <p className="mt-1 font-mono text-4xl font-bold tracking-tight">{f.eur(earnings.totalCents)}</p>
        <p className="mt-2 text-[15px] opacity-80">
          {m('driverApp.earnTrips', { count: earnings.trips })} · {hours(earnings.workMinutes)}
        </p>
        <p className="mt-3 text-xs leading-relaxed opacity-60">{t.pay.disclaimer}</p>
      </section>

      {!earnings.hasProfile && <p className="text-[15px] text-ink-muted">{t.driverApp.earningsNoPay}</p>}

      {earnings.days.length === 0 ? (
        <p className="py-10 text-center text-[17px] text-ink-muted">{t.driverApp.earningsEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {earnings.days.map((day) => {
            const noon = new Date(`${day.date}T12:00:00Z`);
            return (
              <li key={day.date} className="overflow-hidden rounded-card border border-line bg-surface">
                <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5">
                  <div>
                    <p className="text-[17px] font-semibold capitalize">
                      {dayName.format(noon)} {f.date(noon)}
                    </p>
                    <p className="text-[14px] text-ink-muted">
                      {day.workMinutes > 0 && hours(day.workMinutes)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl font-bold">
                      {day.amountCents == null ? '—' : `+${f.eur(day.amountCents)}`}
                    </p>
                    <p className="text-[13px] text-ink-muted">
                      {t.driverApp.earningsRunning} {f.eur(day.runningCents)}
                    </p>
                  </div>
                </div>

                {day.trips.length > 0 && (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {day.trips.map((trip) => (
                      <li key={trip.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="font-mono text-[15px] font-semibold">{trip.ref}</p>
                          <p className="truncate text-[14px] text-ink-muted">
                            {trip.routeFrom ?? '—'} → {trip.routeTo ?? '—'}
                            {trip.km != null && ` · ${f.number(trip.km)} km`}
                          </p>
                        </div>
                        {trip.amountCents != null && (
                          <span className="font-mono text-[16px] font-semibold">{f.eur(trip.amountCents)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
