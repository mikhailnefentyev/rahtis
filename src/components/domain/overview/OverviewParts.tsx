import Link from 'next/link';
import { Bars, Card, CardBody, Mono, Plate } from '@/components/ui';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { OrderStatus } from '@/types/db';
import { TiltCard } from './TiltCard';

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Role = 'CARRIER' | 'SHIPPER';

/** Рейс на обзоре: маршрут, номер, машина, точки. */
type LiveTrip = {
  id: string;
  ref: string;
  status: OrderStatus;
  plate: string | null;
  party: string | null;
  stops: Array<{ city: string; done: boolean; eta: string | null }>;
};

/**
 * Рейсы в работе и ждущие подтверждения — общая выборка для карточек
 * «Tarvitsee huomiota» и списка «Käynnissä».
 */
async function liveTrips(supabase: Supabase, role: Role): Promise<LiveTrip[]> {
  const base =
    role === 'CARRIER'
      ? ((await supabase.rpc('my_assignments')).data ?? [])
          .filter((o) => o.status === 'AWAIT_DRIVER' || o.status === 'IN_PROGRESS')
          .map((o) => ({ id: o.id, ref: o.ref, status: o.status, plate: o.vehicle_plate, party: o.shipper_name }))
      : (
          (
            await supabase
              .from('orders')
              .select('id, ref, status, trailer_plate')
              .in('status', ['AWAIT_DRIVER', 'IN_PROGRESS'])
              .order('created_at', { ascending: false })
              .limit(20)
          ).data ?? []
        ).map((o) => ({ id: o.id, ref: o.ref, status: o.status, plate: o.trailer_plate, party: null }));

  if (base.length === 0) return [];

  const { data: stops } = await supabase
    .from('order_stops')
    .select('order_id, sequence, city, place_name, completed_at, eta_at')
    .in(
      'order_id',
      base.map((o) => o.id),
    )
    .order('sequence');

  return base.map((o) => ({
    ...o,
    stops: (stops ?? [])
      .filter((s) => s.order_id === o.id)
      .map((s) => ({ city: s.place_name || s.city || '', done: Boolean(s.completed_at), eta: s.eta_at })),
  }));
}

export async function OverviewBody({ locale, role }: { locale: Locale; role: Role }) {
  const [{ t, m, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const trips = await liveTrips(supabase, role);
  const carrier = role === 'CARRIER';

  /* ── Что ждёт ─────────────────────────────────────────────────── */
  let cards: Array<{ href: string; count: number; title: string; text: string; tone: 'warn' | 'danger' | 'live' }>;

  if (carrier) {
    const running = trips.filter((o) => o.status === 'IN_PROGRESS' && o.stops.length > 0 && o.stops.every((s) => s.done));
    const { data: cmr } = running.length
      ? await supabase
          .from('order_documents')
          .select('order_id')
          .eq('kind', 'CMR')
          .in(
            'order_id',
            running.map((o) => o.id),
          )
      : { data: [] };
    const withCmr = new Set((cmr ?? []).map((d) => d.order_id));
    const { data: desk } = await supabase.rpc('desk_orders', { p_limit: 100 });

    cards = [
      {
        href: `/${locale}/carrier/desk`,
        count: trips.filter((o) => o.status === 'AWAIT_DRIVER').length,
        title: t.overview.awaitTitle,
        text: t.overview.awaitText,
        tone: 'warn',
      },
      {
        href: `/${locale}/carrier/desk`,
        count: running.filter((o) => !withCmr.has(o.id)).length,
        title: t.overview.noCmrTitle,
        text: t.overview.noCmrText,
        tone: 'danger',
      },
      {
        href: `/${locale}/carrier/desk`,
        count: (desk ?? []).length,
        title: t.overview.deskTitle,
        text: t.overview.deskText,
        tone: 'live',
      },
    ];
  } else {
    const [{ count: offers }, { data: claims }] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'REQUESTED'),
      supabase.rpc('my_claims'),
    ]);
    cards = [
      {
        href: `/${locale}/shipper/orders`,
        count: offers ?? 0,
        title: t.overview.offersTitle,
        text: t.overview.offersText,
        tone: 'warn',
      },
      {
        href: `/${locale}/shipper/orders`,
        count: trips.filter((o) => o.status === 'IN_PROGRESS').length,
        title: t.overview.runningTitle,
        text: t.overview.runningText,
        tone: 'live',
      },
      {
        href: `/${locale}/shipper/claims`,
        count: (claims ?? []).filter((c) => c.status === 'OPEN' || c.status === 'IN_REVIEW').length,
        title: t.overview.claimsTitle,
        text: t.overview.claimsText,
        tone: 'danger',
      },
    ];
  }

  /* ── Неделя ───────────────────────────────────────────────────── */
  const { data: weekly } = await supabase.rpc('weekly_totals', { p_weeks: 8 });
  const weeks = fillWeeks(
    (weekly ?? []).map((w) => ({
      week: w.week,
      cents: Number(carrier ? (w.payout_cents ?? 0) : (w.rate_cents ?? 0)),
      trips: Number(w.orders_count ?? 0),
      km: Number(w.distance_km ?? 0),
    })),
  );
  const current = weeks[weeks.length - 1]!;

  return (
    <>
      <section aria-label={t.overview.needs} className="flex flex-col gap-2.5">
        <p className="label-micro rise" style={{ '--i': 1 } as React.CSSProperties}>
          {t.overview.needs}
        </p>
        <div className="grid gap-3.5 sm:grid-cols-3">
          {cards.map((card, i) => (
            <TiltCard key={card.title} {...card} action={t.overview.open} index={i + 2} />
          ))}
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="rise" style={{ '--i': 5 } as React.CSSProperties}>
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
            {trips.length > 0 && <span className="live-pulse" aria-hidden />}
            <h2 className="font-display text-base font-bold">{t.overview.live}</h2>
            {trips.length > 0 && <Mono className="text-xs text-ink-dim">{trips.length}</Mono>}
          </div>
          {trips.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-ink-muted">{t.pulse.nowEmpty}</p>
          ) : (
            <ul>
              {trips.map((trip) => (
                <TripRow key={trip.id} trip={trip} locale={locale} role={role} awaiting={t.overview.awaiting} etaLabel={t.overview.eta} time={(iso) => f.time(iso)} />
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-4">
          <Card className="rise" style={{ '--i': 6 } as React.CSSProperties}>
            <CardBody className="flex flex-col gap-3">
              <p className="label-micro">
                {t.overview.week} · {t.pulse.vatFree}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Kpi value={f.number(current.trips)} label={t.overview.trips} />
                <Kpi value={f.number(current.km)} label={t.unit.km} />
                <Kpi value={f.eur(current.cents)} label={carrier ? t.overview.payout : t.overview.spend} />
              </div>
              <Bars
                points={weeks.map((w) => ({
                  value: w.cents,
                  label: m('pulse.week', { no: isoWeek(w.week) }),
                  title: m('pulse.weekAmount', { no: isoWeek(w.week), amount: f.eur(w.cents) }),
                }))}
              />
            </CardBody>
          </Card>

          <Card className="rise" style={{ '--i': 7 } as React.CSSProperties}>
            <CardBody className="flex flex-col gap-2.5">
              <p className="label-micro">{t.overview.quick}</p>
              {carrier && (
                <QuickLink href={`/${locale}/carrier/partners`} title={t.overview.inviteClient} text={t.overview.inviteClientText} />
              )}
              <QuickLink
                href={`/${locale}/${carrier ? 'carrier' : 'shipper'}/reports`}
                title={t.overview.reports}
                text={t.overview.reportsText}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function TripRow({
  trip,
  locale,
  role,
  awaiting,
  etaLabel,
  time,
}: {
  trip: LiveTrip;
  locale: Locale;
  role: Role;
  awaiting: string;
  etaLabel: string;
  time: (iso: string) => string;
}) {
  const first = trip.stops[0]?.city ?? '';
  const last = trip.stops[trip.stops.length - 1]?.city ?? '';
  const next = trip.stops.find((s) => !s.done);
  const doneCount = trip.stops.filter((s) => s.done).length;

  return (
    <li className="border-t border-line transition-colors hover:bg-sunken">
      <Link
        href={role === 'CARRIER' ? `/${locale}/carrier/desk` : `/${locale}/shipper/orders`}
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-[14px] font-semibold">
          <span className="truncate">{first}</span>
          <span aria-hidden className="text-ink-dim">→</span>
          <span className="truncate">{last}</span>
        </span>
        <span className="row-span-2 text-right text-xs text-ink-muted">
          {trip.status === 'AWAIT_DRIVER' ? (
            <span className="font-semibold text-warn">{awaiting}</span>
          ) : next?.eta ? (
            <>
              <Mono className="block text-[15px] font-semibold text-ink">{time(next.eta)}</Mono>
              {etaLabel}
            </>
          ) : null}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <Mono>{trip.ref}</Mono>
          {trip.plate && <Plate>{trip.plate}</Plate>}
          {trip.party && <span className="truncate">{trip.party}</span>}
        </span>
        {trip.stops.length > 1 && (
          <span className="trip-stops col-span-2" aria-label={`${doneCount} / ${trip.stops.length}`}>
            {trip.stops.map((stop, i) => {
              const state = stop.done ? 'done' : stop === next ? 'now' : undefined;
              const seg =
                i < trip.stops.length - 1
                  ? stop.done && trip.stops[i + 1]!.done
                    ? '100%'
                    : stop.done
                      ? '50%'
                      : '0%'
                  : null;
              return (
                <span key={i} className="contents">
                  <span className="trip-stop" data-state={state} />
                  {seg !== null && (
                    <span className="trip-seg">
                      <i style={{ '--w': seg } as React.CSSProperties} />
                    </span>
                  )}
                </span>
              );
            })}
          </span>
        )}
      </Link>
    </li>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[11px] border border-line bg-sunken px-3 py-2 shadow-[inset_0_1px_2px_rgb(12_22_38/0.04)]">
      <Mono className="block font-display text-[18px] leading-tight font-extrabold">{value}</Mono>
      <span className="text-[11.5px] text-ink-muted">{label}</span>
    </div>
  );
}

function QuickLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-card transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <span className="min-w-0">
        <b className="block text-[14px]">{title}</b>
        <span className="text-[12.5px] text-ink-muted">{text}</span>
      </span>
      <svg aria-hidden viewBox="0 0 24 24" className="ml-auto size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

type Week = { week: string; cents: number; trips: number; km: number };

/** Восемь недель подряд, пустые — нулями: сетка столбиков ровная. */
function fillWeeks(rows: Week[]): Week[] {
  const known = new Map(rows.map((r) => [r.week, r]));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(new Date());
  const out: Week[] = [];
  for (let back = 7; back >= 0; back -= 1) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - back * 7);
    const week = d.toISOString().slice(0, 10);
    out.push(known.get(week) ?? { week, cents: 0, trips: 0, km: 0 });
  }
  return out;
}

export function isoWeek(monday: string): number {
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}
