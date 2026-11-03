import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { stopDateTime, stopEta } from '@/lib/orders/stopTime';
import { Badge, Card, CardBody, Mono } from '@/components/ui';
import { orderStatusTone } from '@/components/ui/tone';
import { cn } from '@/lib/cn';
import { getI18n, isLocale } from '@/lib/i18n';
import { stopTimeZone } from '@/lib/country';
import { createFormat } from '@/lib/format';
import { stopTitle } from '@/lib/orders/haul';
import { decodePolyline } from '@/lib/routing';
import { createAdminClient } from '@/lib/supabase/admin';
import { customerDocuments, isDelivered, TOKEN_PATTERN, type CustomerDocument } from '@/lib/track/documents';
import { refreshFix, trackEta, vehicleFix, type TrackEta } from '@/lib/track/eta';
import { corridor, inFinland, isFresh, nearestIndex, type Point } from '@/lib/track/geo';
import { roadConditions, type RoadConditions } from '@/lib/track/roads';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.track.title, robots: { index: false, follow: false } };
}

/* Серверный компонент: «сейчас» — момент запроса. */
function requestTime(): number {
  return Date.now();
}

/* Вирусный канал: клиент перевозчика видит, на чём сделана его перевозка. */
const CTA_UTM = 'utm_source=track&utm_medium=link&utm_campaign=viral';

/**
 * Ход своего рейса перевозчика для его клиента — без входа, по ссылке.
 *
 * Ссылка — случайный токен из 256 бит, выдаётся только у своих рейсов.
 * Показывается то, что клиенту нужно знать о своей перевозке: кто везёт,
 * когда будет (оценка по GPS машины, если трекер подключён), этапы со
 * временем, обстановка на дорогах Финляндии и после доставки — CMR и
 * фото выгрузки. Телефона водителя, координат машины и цены здесь нет:
 * позицию из GPS страница превращает только во время прибытия.
 *
 * Аналитики на странице нет и не будет: ссылки отслеживания исключены
 * из неё целиком (src/lib/analytics/public.ts, решение 24.10.2026).
 * Переход по ссылке внизу считается на витрине по utm-меткам.
 */
export default async function TrackPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  const { t, m, f } = await getI18n(locale);

  const valid = TOKEN_PATTERN.test(token);
  const admin = createAdminClient();
  const { data: order } = valid
    ? await admin
        .from('orders')
        .select(
          'id, ref, status, haul_kind, trailer_plate, assigned_company_id, assigned_vehicle_id, shipper_company_id, route_geometry',
        )
        .eq('track_token', token)
        .maybeSingle()
    : { data: null };

  if (!order) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-5">
        <h1 className="text-xl font-semibold tracking-tight">{t.track.title}</h1>
        <p className="mt-3 text-[13px] text-ink-muted">{t.track.notFound}</p>
      </main>
    );
  }

  const [{ data: carrier }, { data: stopRows }, { data: shipper }, { data: confirmedEvent }] = await Promise.all([
    order.assigned_company_id
      ? admin.from('companies').select('name').eq('id', order.assigned_company_id).single()
      : Promise.resolve({ data: null }),
    admin
      .from('order_stops')
      .select(
        'id, sequence, role, place_name, company_name, city, country, lat, lon, scheduled_date, scheduled_time, eta_at, eta_source, eta_updated_at, arrived_at, completed_at',
      )
      .eq('order_id', order.id)
      .order('sequence'),
    admin.from('companies').select('country').eq('id', order.shipper_company_id).maybeSingle(),
    admin
      .from('order_events')
      .select('created_at')
      .eq('order_id', order.id)
      .in('to_status', ['AWAIT_DRIVER', 'IN_PROGRESS'])
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  ]);
  const stops = stopRows ?? [];

  const now = requestTime();
  const delivered = isDelivered(order.status, stops);
  const active = !delivered && (order.status === 'IN_PROGRESS' || order.status === 'AWAIT_DRIVER');
  const next = stops.find((s) => !s.completed_at) ?? null;
  const lastDone = [...stops].reverse().find((s) => s.completed_at) ?? null;

  /* ── Оценка прибытия ─────────────────────────────────────────── */
  const fix =
    active && order.status === 'IN_PROGRESS'
      ? await vehicleFix(order.assigned_vehicle_id, order.assigned_company_id)
      : null;
  /*
   * Обновлять GPS с публичной страницы пока нельзя: PRIVACY (GPS, 29.10)
   * обещает запрос к провайдеру, только когда перевозчик открывает GPS.
   * Включить — после правки текста: TRACK_REFRESH_GPS=1.
   */
  if (fix && process.env.TRACK_REFRESH_GPS === '1') after(() => refreshFix(fix, now).catch(() => undefined));

  const eta: TrackEta | null = active && next && !next.arrived_at ? await trackEta(next, fix, now) : null;

  /* ── Дорожная обстановка: оставшийся путь по Финляндии ──────── */
  let roads: RoadConditions | null = null;
  if (active && next) {
    const coords = (s: { lat: number | null; lon: number | null }): Point | null =>
      s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon } : null;
    const start: Point | null =
      fix && isFresh(fix.positionAt, now) ? fix.position : ((lastDone && coords(lastDone)) ?? coords(next));
    let path: Point[] = [];
    if (start) {
      const geometry = order.route_geometry
        ? decodePolyline(order.route_geometry).map(([lon, lat]) => ({ lat, lon }))
        : [];
      path =
        geometry.length > 1
          ? geometry.slice(nearestIndex(geometry, start))
          : [start, ...stops.filter((s) => !s.completed_at).map(coords).filter((p): p is Point => p != null)];
    }
    const finnish = corridor(path).filter(inFinland);
    if (finnish.length > 0) roads = await roadConditions(finnish);
  }

  const documents: CustomerDocument[] = delivered ? await customerDocuments(order.id) : [];
  const cmr = documents.filter((d) => d.kind === 'CMR');
  const photos = documents.filter((d) => d.kind === 'UNLOADING_PHOTO');

  /*
   * Время точки — по поясу её страны, с «UTC+1», где он расходится с
   * поясом клиента. Страница открывается без входа, но адресована клиенту
   * рейса: польскому клиенту польские и немецкие точки без пометок, а не
   * с «UTC+2» относительно Хельсинки (прогон 21.10.2026).
   */
  const fz = createFormat(t.meta.intl, stopTimeZone(shipper?.country));
  const time = (iso: string, country: string | null) => stopDateTime(fz, iso, country);
  const planned = (s: { scheduled_date: string | null; scheduled_time: string | null }) =>
    s.scheduled_date ? `${f.date(s.scheduled_date)}${s.scheduled_time ? ` ${s.scheduled_time.slice(0, 5)}` : ''}` : null;

  const rtf = new Intl.RelativeTimeFormat(t.meta.intl, { numeric: 'auto' });
  const ago = (iso: string) => {
    const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
    if (min < 60) return rtf.format(-min, 'minute');
    return min < 48 * 60 ? rtf.format(-Math.round(min / 60), 'hour') : f.date(iso);
  };

  const place = (s: { place_name: string | null; company_name: string | null; city: string }) =>
    [s.place_name || s.company_name, s.city].filter(Boolean).join(', ');

  const docHref = (d: CustomerDocument) => `/${locale}/track/${token}/doc/${d.id}`;
  const deliveredAt = delivered ? (lastDone?.completed_at ?? null) : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-5 sm:py-10">
      <p className="label-micro">{t.track.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Mono className="text-lg">{order.ref}</Mono>
        <Badge tone={delivered ? 'ok' : orderStatusTone[order.status]}>
          {delivered ? t.track.delivered : t.orderStatus[order.status]}
        </Badge>
      </div>
      {carrier?.name && (
        <p className="mt-2 text-[13px] text-ink-muted">
          {t.track.carrier}: <span className="font-semibold text-ink">{carrier.name}</span>
          {order.trailer_plate ? ` · ${order.trailer_plate}` : ''}
        </p>
      )}

      {/* ── Когда будет ─────────────────────────────────────────── */}
      {active && next && (
        <Card className="mt-6 overflow-hidden" stripe="live">
          <CardBody>
            <p className="label-micro">
              {next.arrived_at ? t.track.onSite : t.track.next} · {stopTitle(t, next.role, order.haul_kind)}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">{place(next)}</p>
            <EtaBlock
              eta={eta}
              arrivedText={next.arrived_at ? `${t.track.arrived} ${time(next.arrived_at, next.country)}` : null}
              etaText={eta ? stopEta(fz, eta.at, next.country) : null}
              plannedText={planned(next)}
              labels={t.track}
              ago={ago}
            />
          </CardBody>
        </Card>
      )}

      {delivered && deliveredAt && lastDone && (
        <Card className="mt-6" stripe="ok">
          <CardBody>
            <p className="label-micro">{t.track.delivered}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{time(deliveredAt, lastDone.country)}</p>
            <p className="mt-1 text-[13px] text-ink-muted">{place(lastDone)}</p>
          </CardBody>
        </Card>
      )}

      {/* ── Этапы ───────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardBody>
          <p className="label-micro mb-4">{t.track.stages}</p>
          <ol className="relative">
            <Step
              state={confirmedEvent || ['AWAIT_DRIVER', 'IN_PROGRESS', 'DONE'].includes(order.status) ? 'done' : 'todo'}
              last={stops.length === 0}
            >
              <span className="text-[13px] font-semibold">{t.track.confirmed}</span>
              {confirmedEvent?.created_at && (
                <span className="text-xs text-ink-dim">{time(confirmedEvent.created_at, null)}</span>
              )}
            </Step>
            {stops.map((s, i) => {
              const state = s.completed_at ? 'done' : s.id === next?.id && active ? 'now' : 'todo';
              const at = !s.arrived_at && !s.completed_at && active ? (s.id === next?.id && eta ? eta.at : s.eta_at) : null;
              const plan = planned(s);
              return (
                <Step key={s.id} state={state} last={i === stops.length - 1 && !delivered}>
                  <span className="text-[13px] font-semibold">{stopTitle(t, s.role, order.haul_kind)}</span>
                  <span className="text-[13px] text-ink-muted">{place(s)}</span>
                  <span className="flex flex-col text-xs text-ink-dim">
                    {s.arrived_at && (
                      <span>
                        {t.track.arrived} {time(s.arrived_at, s.country)}
                      </span>
                    )}
                    {s.completed_at && (
                      <span>
                        {t.track.completed} {time(s.completed_at, s.country)}
                      </span>
                    )}
                    {at ? (
                      <span>
                        {t.track.eta} {stopEta(fz, at, s.country)}
                      </span>
                    ) : (
                      !s.arrived_at &&
                      !s.completed_at &&
                      plan && (
                        <span>
                          {t.track.planned} {plan}
                        </span>
                      )
                    )}
                  </span>
                </Step>
              );
            })}
            {delivered && (
              <Step state="done" last>
                <span className="text-[13px] font-semibold text-ok">{t.track.delivered}</span>
                {deliveredAt && lastDone && (
                  <span className="text-xs text-ink-dim">{time(deliveredAt, lastDone.country)}</span>
                )}
              </Step>
            )}
          </ol>
        </CardBody>
      </Card>

      {/* ── Подтверждение доставки ──────────────────────────────── */}
      {documents.length > 0 && (
        <Card className="mt-4">
          <CardBody>
            <p className="label-micro mb-3">{t.track.documents}</p>
            <ul className="flex flex-col gap-2">
              {cmr.map((d) => (
                <li key={d.id}>
                  <a
                    href={docHref(d)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex min-h-11 items-center justify-between gap-3 rounded-control border border-line bg-sunken px-3 py-2 transition hover:border-accent-line hover:bg-accent-wash"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[13px] font-semibold">{t.track.cmr}</span>
                      <span className="truncate text-xs text-ink-dim">
                        {d.signer_name ? `${t.track.signedBy}: ${d.signer_name} · ` : ''}
                        {fz.dateTime(d.created_at)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-accent group-hover:underline">
                      {t.track.open}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {photos.length > 0 && (
              <>
                <p className="mt-4 mb-2 text-xs font-semibold text-ink-muted">{t.track.photos}</p>
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {photos.map((d, i) => (
                    <li key={d.id}>
                      <a
                        href={docHref(d)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${t.track.photos} ${i + 1}`}
                        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-control border border-line bg-sunken text-ink-faint transition hover:-translate-y-px hover:border-accent-line hover:text-accent hover:shadow-card"
                      >
                        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
                          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                          <circle cx="9" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.5" />
                          <path
                            d="M4 17l5-4.5 3.5 3 3-2.5L20 17"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="text-[11px] tabular-nums">{i + 1}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* ── Дороги ──────────────────────────────────────────────── */}
      {roads && (roads.messages.length > 0 || roads.weather.length > 0) && (
        <RoadsCard
          roads={roads}
          labels={t.track}
          fi={locale === 'fi'}
          date={(iso) => fz.date(iso)}
          time={(iso) => fz.time(iso)}
        />
      )}

      {carrier?.name && (
        <p className="mt-6 text-xs text-ink-dim">
          {/* «Sp. z o.o.» кончается точкой — вторую ставит само предложение. */}
          {m('track.questions', { carrier: carrier.name.replace(/\.$/, '') })}
        </p>
      )}

      {/* ── Вирусный канал ──────────────────────────────────────── */}
      <footer className="mt-10 border-t border-line pt-6">
        <Link
          href={`/${locale}/apply?kind=shipper&${CTA_UTM}`}
          className="group relative block overflow-hidden rounded-card border border-line bg-surface px-4 py-4 shadow-card transition hover:-translate-y-px hover:border-accent-line"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent-wash via-transparent to-transparent opacity-70 transition-opacity group-hover:opacity-100"
          />
          <span className="relative flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-xs text-ink-muted">{t.track.ctaText}</span>
              <span className="text-[14px] font-semibold text-accent">{t.track.ctaLink}</span>
            </span>
            <span aria-hidden className="text-accent transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </Link>
      </footer>
    </main>
  );
}

type TrackLabels = Awaited<ReturnType<typeof getI18n>>['t']['track'];

/** Пункт шкалы этапов: точка, линия к следующему, содержимое. */
function Step({
  state,
  last,
  children,
}: {
  state: 'done' | 'now' | 'todo';
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className={cn('absolute top-4 bottom-0 left-[7px] w-0.5', state === 'done' ? 'bg-ok/40' : 'bg-line')}
        />
      )}
      <span aria-hidden className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center">
        {state === 'now' && <span className="absolute inline-flex size-4 animate-ping rounded-full bg-live/30" />}
        <span
          className={cn(
            'relative size-3 rounded-full border-2',
            state === 'done' && 'border-ok bg-ok',
            state === 'now' && 'border-live bg-surface',
            state === 'todo' && 'border-line-strong bg-surface',
          )}
        />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">{children}</div>
    </li>
  );
}

function EtaBlock({
  eta,
  arrivedText,
  etaText,
  plannedText,
  labels,
  ago,
}: {
  eta: TrackEta | null;
  arrivedText: string | null;
  etaText: string | null;
  plannedText: string | null;
  labels: TrackLabels;
  ago: (iso: string) => string;
}) {
  if (arrivedText) {
    return <p className="mt-3 text-[15px] font-semibold">{arrivedText}</p>;
  }

  if (eta && etaText) {
    const source =
      eta.kind === 'GPS' ? (eta.rough ? labels.etaRough : labels.etaGps) : labels.etaSource[eta.source];
    return (
      <div className="mt-3">
        <p className="text-xs text-ink-muted">{labels.eta}</p>
        <p className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{etaText}</span>
          {eta.kind === 'GPS' && eta.rough && (
            <span className="rounded-pill border border-warn/35 bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">
              {labels.rough}
            </span>
          )}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-dim">
          {eta.kind === 'GPS' && (
            <span aria-hidden className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-live/50" />
              <span className="relative inline-flex size-2 rounded-full bg-live" />
            </span>
          )}
          <span>
            {source}
            {eta.updatedAt ? ` · ${labels.updated} ${ago(eta.updatedAt)}` : ''}
          </span>
        </p>
      </div>
    );
  }

  if (plannedText) {
    return (
      <div className="mt-3">
        <p className="text-xs text-ink-muted">{labels.scheduled}</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{plannedText}</p>
      </div>
    );
  }

  return null;
}

function RoadsCard({
  roads,
  labels,
  fi,
  date,
  time,
}: {
  roads: RoadConditions;
  labels: TrackLabels;
  fi: boolean;
  date: (iso: string) => string;
  time: (iso: string) => string;
}) {
  const shown = roads.messages.slice(0, 5);
  const more = roads.messages.length - shown.length;
  const condition = (c: string | null) =>
    c && c in labels.roadCondition ? labels.roadCondition[c as keyof TrackLabels['roadCondition']] : null;

  return (
    <Card className="mt-4">
      <CardBody>
        <p className="label-micro mb-3">{labels.roads}</p>
        <ul className="flex flex-col gap-3">
          {roads.weather.slice(0, 3).map((w) => (
            <li key={`${w.section}-${w.at}`} className="flex gap-2.5">
              <span
                aria-hidden
                className={cn('mt-1 size-2 shrink-0 rounded-full', w.severity === 'EXTREMELY_POOR' ? 'bg-danger' : 'bg-warn')}
              />
              <span className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    'text-[13px] font-semibold',
                    w.severity === 'EXTREMELY_POOR' ? 'text-danger' : 'text-warn',
                  )}
                >
                  {labels.weather[w.severity]}
                  {condition(w.condition) ? ` · ${condition(w.condition)}` : ''}
                </span>
                <span className="text-xs text-ink-dim">
                  {w.section} · {time(w.at)}
                </span>
              </span>
            </li>
          ))}
          {shown.map((msg) => {
            const road = msg.road ? labels.road.replace('{n}', String(msg.road)) : null;
            const named = road && msg.roadName ? `${road} (${msg.roadName})` : (road ?? msg.roadName);
            const where = [named, msg.municipality].filter(Boolean).join(', ');
            const details = [
              msg.closed ? labels.roadClosed : null,
              msg.speedLimit ? labels.speedLimit.replace('{n}', String(msg.speedLimit)) : null,
              /* Признаки Fintraffic есть только по-фински. */
              ...(fi ? msg.featuresFi.filter((x) => !/tie on suljettu/i.test(x)) : []),
            ].filter(Boolean);
            return (
              <li key={msg.id} className="flex gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    'mt-1 size-2 shrink-0 rounded-full',
                    msg.kind === 'INCIDENT' || msg.closed ? 'bg-danger' : 'bg-warn',
                  )}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-semibold">
                    {msg.kind === 'INCIDENT' ? labels.incident : labels.roadWork}
                    {where ? ` · ${where}` : ''}
                  </span>
                  {details.length > 0 && <span className="text-xs text-ink-muted">{details.join(' · ')}</span>}
                  {msg.until && (
                    <span className="text-xs text-ink-dim">
                      {labels.until} {date(msg.until)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {more > 0 && <p className="mt-2 text-xs text-ink-dim">+{more}</p>}
        <p className="mt-4 text-[11px] text-ink-dim">
          {labels.source}:{' '}
          <a
            href="https://liikennetilanne.fintraffic.fi/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            Fintraffic / Digitraffic
          </a>
          , CC BY 4.0
        </p>
      </CardBody>
    </Card>
  );
}
