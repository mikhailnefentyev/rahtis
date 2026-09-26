import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClaimAttachments, ClaimEvidence } from '@/components/domain/claims/ClaimEvidence';
import { ClaimComposer, ClaimModeration } from '@/components/domain/claims/ClaimActions';
import { claimsRoot } from '@/components/domain/claims/ClaimsCabinet';
import { HaulBadge } from '@/components/domain/HaulBadge';
import { RouteStops } from '@/components/domain/RouteStops';
import { Badge, Card, CardBody, Kv, Mono, Plate, claimStatusTone } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { operatorInbox } from '@/lib/email';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { ClaimDetail, PartyRole } from '@/types/db';

/*
 * Где случилось: название места, иначе компания, иначе город. Прежде
 * бралось одно название места, и у выгрузки, где заполнена только
 * компания, претензия показывала «Koko kuljetus» — хотя точка выбрана.
 */
function claimStopLabel(
  stop: { place_name?: string | null; company_name?: string | null; city?: string | null } | undefined,
): string | null {
  if (!stop) return null;
  return stop.place_name ?? stop.company_name ?? stop.city ?? null;
}

/**
 * Карточка claim: суть спора, рейс, доказательства, лента.
 *
 * Всё приходит одним вызовом claim_detail — и уже обрезанным по роли.
 * Чужой или несуществующий claim возвращает null, и страница отвечает
 * «не найдено», не различая эти случаи: различие само было бы утечкой.
 */
export async function ClaimPage({
  locale,
  role,
  id,
}: {
  locale: Locale;
  role: PartyRole;
  id: string;
}) {
  await requireRole(locale, role);

  const [{ t, m, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data } = await supabase.rpc('claim_detail', { p_claim_id: id });
  if (!data) notFound();

  const detail = data as unknown as ClaimDetail;
  const { claim, order, events } = detail;
  const stops = order.stops ?? [];
  const closed = claim.status === 'RESOLVED' || claim.status === 'REJECTED';
  const byEmail = detail.channel === 'EMAIL';
  const canWrite = !byEmail && (!closed || detail.viewer === 'ADMIN');
  const attachmentsById = new Map(detail.attachments.map((a) => [a.id, a]));

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <nav className="mb-6">
        <Link href={claimsRoot(locale, role)} className="text-[13px] text-ink-muted hover:text-ink">
          ← {t.claims.back}
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone={claimStatusTone[claim.status]}>{t.claimStatus[claim.status]}</Badge>
        <h1 className="text-xl font-semibold tracking-tight">{t.claimKind[claim.kind]}</h1>
        <Mono className="text-sm text-ink-dim">{claim.ref}</Mono>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_280px]">
        <Card>
          <CardBody className="flex flex-col gap-3">
            <p className="text-[13px] leading-relaxed whitespace-pre-line">{claim.description}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <Kv
                k={t.claims.filedBy}
                v={
                  claim.mine && detail.viewer !== 'ADMIN'
                    ? t.claims.mine
                    : t.claims.author[claim.filed_by_role]
                }
              />
              <Kv
                k={t.claims.against}
                v={t.claims.author[claim.filed_by_role === 'SHIPPER' ? 'CARRIER' : 'SHIPPER']}
              />
              <Kv
                k={t.claims.amountClaimed}
                v={<Mono>{claim.amount_cents != null ? f.eur(claim.amount_cents) : '—'}</Mono>}
              />
              <Kv
                k={t.claims.stop}
                v={claimStopLabel(stops.find((s) => s.id === claim.stop_id)) ?? t.claims.stopWhole}
              />
            </div>
            {claim.resolution && (
              <div className="rounded-control border border-line bg-sunken px-3 py-2">
                <p className="label-micro mb-1">{t.claims.resolution}</p>
                <p className="text-[13px] whitespace-pre-line">{claim.resolution}</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-2">
            <p className="label-micro">{t.claims.trip}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Mono className="text-sm">{order.ref}</Mono>
              <HaulBadge haulKind={order.haul_kind} containerFeet={order.container_feet} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {order.vehicle_plate && <Plate>{order.vehicle_plate}</Plate>}
              {order.trailer_plate && <Plate>{order.trailer_plate}</Plate>}
            </div>
            {order.shipper_name && <Kv k={t.periodReport.colShipper} v={order.shipper_name} />}
            {order.carrier_name && <Kv k={t.periodReport.colCarrier} v={order.carrier_name} />}
            {order.shipper_ref && (
              <Kv k={t.periodReport.colShipperRef} v={<Mono>{order.shipper_ref}</Mono>} />
            )}
            <Kv k={t.periodReport.colKm} v={<Mono>{order.distance_km ?? '—'}</Mono>} />
            {order.rate_cents != null && (
              <Kv k={t.periodReport.colRate} v={<Mono>{f.eur(order.rate_cents)}</Mono>} />
            )}
            {order.closed_at && (
              <Kv k={t.periodReport.colDate} v={<Mono>{f.dateTime(order.closed_at)}</Mono>} />
            )}
          </CardBody>
        </Card>
      </div>

      {stops.length > 0 && (
        <section className="mt-6">
          <p className="label-micro mb-2.5">{m('order.stopsCount', { count: stops.length })}</p>
          <RouteStops stops={stops} haulKind={order.haul_kind} />
        </section>
      )}

      <section className="mt-6">
        <p className="label-micro mb-2.5">{t.claims.evidence}</p>
        <ClaimEvidence documents={detail.documents} stopId={claim.stop_id} />
      </section>

      <section className="mt-6">
        <p className="label-micro mb-2.5">{t.claims.attachments}</p>
        <ClaimAttachments attachments={detail.attachments} />
      </section>

      <section className="mt-6">
        <p className="label-micro mb-2.5">{t.claims.timeline}</p>
        <ol className="flex flex-col gap-2">
          {events.map((event) => (
            <li
              key={event.id}
              className={[
                'rounded-control border px-3 py-2',
                event.author_role === 'ADMIN'
                  ? 'border-accent/35 bg-accent/5'
                  : 'border-line bg-sunken',
              ].join(' ')}
            >
              <p className="text-xs text-ink-muted">
                <span className="font-semibold text-ink">{t.claims.author[event.author_role]}</span>{' '}
                {t.claims.event[event.kind]}
                {event.kind === 'STATUS' && event.status_to && (
                  <>
                    {' · '}
                    {m('claims.statusChange', {
                      from: event.status_from ? t.claimStatus[event.status_from] : '—',
                      to: t.claimStatus[event.status_to],
                    })}
                  </>
                )}
                {' · '}
                <Mono className="text-ink-faint">{f.dateTime(event.created_at)}</Mono>
              </p>
              {event.attachment_id && attachmentsById.get(event.attachment_id) && (
                <p className="mt-1 text-xs text-ink-dim">
                  {t.claims.attachments}: {attachmentsById.get(event.attachment_id)!.file_name}
                </p>
              )}
              {event.body && <p className="mt-1 text-[13px] whitespace-pre-line">{event.body}</p>}
            </li>
          ))}
        </ol>

        <div className="mt-4 flex flex-col gap-3">
          {/*
           * Где идёт разговор — сказано прямо. Вторая сторона ведёт claim
           * с оператором почтой и здесь только читает; подавший пишет
           * оператору; оператор видит, ушло ли зеркало и куда.
           */}
          {byEmail && (
            <p className="rounded-control border border-accent/35 bg-accent/5 px-3 py-2 text-[13px]">
              <span className="label-micro mr-2">{t.claims.byEmail}</span>
              {m('claims.channelEmail', { email: operatorInbox(), ref: claim.ref })}
            </p>
          )}

          {!byEmail && detail.viewer !== 'ADMIN' && claim.mirrored_at && (
            <p className="text-xs text-ink-dim">
              {m('claims.forwarded', { date: f.dateTime(claim.mirrored_at) })}
            </p>
          )}

          {detail.viewer === 'ADMIN' && (
            <div className="flex flex-col gap-1.5 text-xs">
              {claim.mirrored_at ? (
                <p className="text-ink-muted">
                  {m('claims.forwardedTo', {
                    date: f.dateTime(claim.mirrored_at),
                    email: claim.mirrored_to ?? '—',
                  })}
                  {claim.mirrored_to && (
                    <>
                      {' · '}
                      <a
                        href={`mailto:${claim.mirrored_to}?subject=${encodeURIComponent(`RAHTIS · ${claim.ref} · ${order.ref}`)}`}
                        className="font-semibold text-accent hover:underline"
                      >
                        {t.claims.writeByEmail}
                      </a>
                    </>
                  )}
                </p>
              ) : (
                <p role="alert" className="text-warn">
                  {t.claims.notForwarded}
                </p>
              )}
              <p className="text-ink-dim">{t.claims.adminChannel}</p>
            </div>
          )}

          {canWrite ? (
            <ClaimComposer claimId={claim.id} />
          ) : (
            !byEmail && <p className="text-xs text-ink-dim">{t.claims.closed}</p>
          )}
        </div>
      </section>

      {(detail.viewer === 'ADMIN' || (claim.mine && !closed)) && (
        <section className="mt-6 border-t border-line pt-4">
          <p className="label-micro mb-2.5">{t.claims.moderate}</p>
          <ClaimModeration
            claimId={claim.id}
            status={claim.status}
            viewer={detail.viewer}
            mine={claim.mine}
          />
        </section>
      )}
    </main>
  );
}
