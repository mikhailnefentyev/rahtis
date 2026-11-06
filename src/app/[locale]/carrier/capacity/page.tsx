import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { Badge, Button, Card, CardBody, Plate } from '@/components/ui';
import { VerifiedBadge } from '@/components/domain/VerifiedBadge';
import { CabotageNote, spaceText, vehicleText } from '@/components/domain/capacity/CabotageNote';
import { requireRole } from '@/lib/auth/guard';
import { decideCapacityRequestAction, publishCapacityAction, withdrawCapacityAction } from '@/lib/capacity/actions';
import { isCabotage } from '@/lib/capacity/compute';
import { loadCarrierCapacity, syncCapacity, type FleetProposal } from '@/lib/capacity/load';
import { isLocale, type Locale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.capacity.title };
}

/**
 * Догрузы перевозчика: запросы заказчиков на место и свободное место
 * по рейсам — опубликовать (с поправкой цифр), обновить, снять. Расчёт —
 * src/lib/capacity; режим публикации — в автопарке.
 */
export default async function CarrierCapacityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;

  const [i18n, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const { t, f } = i18n;
  const c = t.capacity;

  const [{ proposals, ok }, requestsRes] = await Promise.all([
    loadCarrierCapacity(),
    supabase.rpc('capacity_requests_for_carrier'),
  ]);

  /* Истёкшее и автопубликация — после ответа, не задерживая страницу. */
  if (ok) {
    after(() => syncCapacity([company.id]).then(() => undefined, (e: unknown) => console.error('capacity sync:', e)));
  }

  const requests = requestsRes.error ? [] : (requestsRes.data ?? []);
  const visible = proposals.filter((p) => p.offerable || p.offer);
  const day = (d: string) => f.date(`${d}T12:00:00Z`);
  const dates = (a: string, b: string) => (a === b ? day(a) : `${day(a)} – ${day(b)}`);

  return (
    <main className="cab-page">
      <h1 className="page-title">{c.title}</h1>
      <p className="mt-2 mb-6 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {c.subtitle}{' '}
        <Link href={`/${locale}/carrier/fleet#capacity`} className="text-accent hover:underline">
          {c.settingsLink}
        </Link>
      </p>

      {!ok && (
        <Card stripe="warn" className="mb-6">
          <CardBody>
            <p className="text-[13px] text-ink-muted">{c.notReady}</p>
          </CardBody>
        </Card>
      )}

      {/* Запросы — первыми: их ждёт заказчик. */}
      {requests.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{c.requestsTitle}</h2>
          <div className="flex flex-col gap-3">
            {requests.map((r) => (
              <Card key={r.request_id} id={`req-${r.request_id}`} className="scroll-mt-24" stripe={r.status === 'PENDING' ? 'warn' : undefined}>
                <CardBody className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[14px] font-semibold">{r.shipper_name}</span>
                    {r.shipper_verified && <VerifiedBadge label={t.verification.badge} hint={t.verification.badgeHint} />}
                    <Badge tone={r.status === 'PENDING' ? 'warn' : r.status === 'ACCEPTED' ? 'ok' : 'neutral'}>
                      {(c.requestStatus as Record<string, string>)[r.status] ?? r.status}
                    </Badge>
                  </div>
                  <p className="text-[13px]">
                    <strong>
                      {r.from_city} → {r.to_city}
                    </strong>{' '}
                    · {dates(r.date_from, r.date_to)} · {spaceText(t, locale, { ldm: r.ldm === null ? null : Number(r.ldm), kg: r.weight_kg, pallets: r.pallets })} ·{' '}
                    <strong>{f.money(r.price_cents, r.currency)}</strong>
                  </p>
                  {r.description && <p className="text-[13px] text-ink-muted">{r.description}</p>}
                  <CabotageNote t={t} show={r.cabotage_ops !== null} ops={r.cabotage_ops} />
                  {r.status === 'PENDING' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={decideCapacityRequestAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="request_id" value={r.request_id} />
                        <input type="hidden" name="accept" value="1" />
                        <Button type="submit" size="sm" variant="primary">
                          {c.accept}
                        </Button>
                      </form>
                      <form action={decideCapacityRequestAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="request_id" value={r.request_id} />
                        <input type="hidden" name="accept" value="0" />
                        <input
                          name="reason"
                          maxLength={300}
                          placeholder={c.declineReason}
                          aria-label={c.declineReason}
                          className="h-8 w-52 rounded-control border border-line bg-surface px-2 text-[13px]"
                        />
                        <Button type="submit" size="sm">
                          {c.decline}
                        </Button>
                      </form>
                    </div>
                  ) : (
                    r.status === 'ACCEPTED' && (
                      <Link href={`/${locale}/carrier/desk#trip-${r.created_order_id}`} className="text-[13px] text-accent hover:underline">
                        {c.openTrip}
                      </Link>
                    )
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{c.tripsTitle}</h2>
        {visible.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{c.empty}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((p) => (
              <ProposalCard key={p.key} p={p} locale={locale} i18n={i18n} companyCountry={company.country ?? null} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

type I18n = Awaited<ReturnType<typeof getViewerI18n>>;

function ProposalCard({ p, locale, i18n, companyCountry }: { p: FleetProposal; locale: Locale; i18n: I18n; companyCountry: string | null }) {
  const { t, f } = i18n;
  const c = t.capacity;
  const offer = p.offer;
  const live = offer?.status === 'PUBLISHED';
  const shown = offer
    ? { ldm: offer.free_ldm === null ? null : Number(offer.free_ldm), kg: offer.free_kg, pallets: offer.free_pallets }
    : p.free;
  const day = (d: string) => f.date(`${d}T12:00:00Z`);
  const cabotage = isCabotage(companyCountry, p.from.country, p.to.country);

  return (
    <Card id={`cap-${p.vehicleId}-${p.anchorOrderId}`} className="scroll-mt-24" stripe={live ? 'ok' : undefined}>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Plate>{p.plate}</Plate>
          <span className="text-[14px] font-semibold">
            {p.from.city} → {p.to.city}
          </span>
          <span className="text-[13px] text-ink-muted">
            {p.availableFrom === p.availableTo ? day(p.availableFrom) : `${day(p.availableFrom)} – ${day(p.availableTo)}`}
          </span>
          <Badge tone={live ? 'ok' : 'neutral'}>{live ? (offer?.auto ? c.statusAuto : c.statusPublished) : c.statusHidden}</Badge>
          {p.mode === 'NEVER' && <Badge tone="neutral">{c.modeNever}</Badge>}
        </div>
        <p className="text-[13px]">
          {c.freeLine.replace('{space}', spaceText(t, locale, shown))}
          <span className="text-ink-muted">
            {' · '}
            {c.computed.replace('{space}', spaceText(t, locale, p.free))} · {vehicleText(t, p.vehicleClass, p.body)}
          </span>
        </p>
        <p className="font-mono text-[12px] text-ink-faint">{p.refs.join(' · ')}</p>
        {p.legs.length > 1 && (
          <ul className="flex flex-col gap-0.5 text-[12.5px] text-ink-muted">
            {p.legs.map((leg, i) => (
              <li key={i}>
                {leg.from.city} → {leg.to.city}: {spaceText(t, locale, leg.free)}
              </li>
            ))}
          </ul>
        )}
        <CabotageNote t={t} show={cabotage} />

        {p.mode !== 'NEVER' && (
          <div className="flex flex-wrap items-end gap-2">
            <form action={publishCapacityAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="vehicle_id" value={p.vehicleId} />
              <input type="hidden" name="order_id" value={p.anchorOrderId} />
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="label-micro">ldm</span>
                <input
                  name="free_ldm"
                  inputMode="decimal"
                  defaultValue={shown.ldm ?? ''}
                  className="h-9 w-20 rounded-control border border-line bg-surface px-2 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="label-micro">t</span>
                <input
                  name="free_t"
                  inputMode="decimal"
                  defaultValue={shown.kg === null ? '' : shown.kg / 1000}
                  className="h-9 w-20 rounded-control border border-line bg-surface px-2 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="label-micro">{c.palletsLabel}</span>
                <input
                  name="free_pallets"
                  inputMode="numeric"
                  defaultValue={shown.pallets ?? ''}
                  className="h-9 w-20 rounded-control border border-line bg-surface px-2 text-[13px]"
                />
              </label>
              <Button type="submit" size="sm" variant={live ? 'default' : 'primary'}>
                {live ? c.update : c.publish}
              </Button>
            </form>
            {offer && (
              <form action={withdrawCapacityAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="offer_id" value={offer.id} />
                <Button type="submit" size="sm" variant="ghost">
                  {c.withdraw}
                </Button>
              </form>
            )}
          </div>
        )}
        {!live && <p className="text-[12px] text-ink-faint">{c.privacyHint}</p>}
      </CardBody>
    </Card>
  );
}
