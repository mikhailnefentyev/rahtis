import Link from 'next/link';
import { Badge, Card, CardBody, EmptyState, Mono, Plate, claimStatusTone } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { cabinetPath } from '@/lib/auth/paths';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { ClaimStatus, PartyRole } from '@/types/db';

const STATUSES: ClaimStatus[] = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'];

/** Корень раздела claims для роли — один на список, карточку и ссылки уведомлений. */
export function claimsRoot(locale: Locale, role: PartyRole): string {
  return `/${locale}/${role === 'ADMIN' ? 'admin' : role === 'CARRIER' ? 'carrier' : 'shipper'}/claims`;
}

/**
 * Раздел claims — один на три кабинета.
 *
 * Что кому видно, решает my_claims: сторона видит свои споры с обеих
 * сторон, оператор — все. Имя перевозчика заказчику не приходит вовсе,
 * поэтому здесь нет ни одного условия «если заказчик».
 */
export async function ClaimsCabinet({
  locale,
  role,
  status,
}: {
  locale: Locale;
  role: PartyRole;
  status: string | undefined;
}) {
  await requireRole(locale, role);

  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const filter = STATUSES.find((s) => s === status);

  const { data: claims } = await supabase.rpc('my_claims', filter ? { p_status: filter } : {});
  const root = claimsRoot(locale, role);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <nav className="mb-6">
        <Link
          href={cabinetPath(locale, role)}
          className="text-[13px] text-ink-muted hover:text-ink"
        >
          ← {t.role[role]}
        </Link>
      </nav>

      <h1 className="text-xl font-semibold tracking-tight">{t.claims.title}</h1>
      <p className="mt-2 mb-5 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {role === 'ADMIN' ? t.claims.subtitleAdmin : t.claims.subtitle}
      </p>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {[undefined, ...STATUSES].map((s) => (
          <Link
            key={s ?? 'all'}
            href={s ? `${root}?status=${s}` : root}
            aria-current={s === filter ? 'page' : undefined}
            className={[
              'rounded-pill border px-3 py-1 text-xs',
              s === filter
                ? 'border-accent font-semibold text-ink'
                : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
            ].join(' ')}
          >
            {s ? t.claimStatus[s] : t.claims.all}
          </Link>
        ))}
      </div>

      {!claims || claims.length === 0 ? (
        <EmptyState title={t.claims.none} description={t.claims.noneHint} />
      ) : (
        <div className="flex flex-col gap-2">
          {claims.map((claim) => (
            <Link key={claim.id} href={`${root}/${claim.id}`} className="block">
              <Card stripe={claimStatusTone[claim.status]} className="hover:border-line-strong">
                <CardBody className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge tone={claimStatusTone[claim.status]}>
                        {t.claimStatus[claim.status]}
                      </Badge>
                      <span className="text-[13px] font-semibold">{t.claimKind[claim.kind]}</span>
                      <Mono className="text-xs text-ink-dim">{claim.ref}</Mono>
                      {claim.vehicle_plate && <Plate>{claim.vehicle_plate}</Plate>}
                    </div>
                    {claim.route_from && (
                      <p className="mt-2 font-mono text-sm tracking-tight text-accent">
                        {claim.route_from} → {claim.route_to}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-ink-muted">
                      {t.claims.filedBy}:{' '}
                      {claim.mine && role !== 'ADMIN'
                        ? t.claims.mine
                        : t.claims.author[claim.filed_by_role]}
                      {claim.shipper_name ? ` · ${claim.shipper_name}` : ''}
                      {claim.carrier_name ? ` · ${claim.carrier_name}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-ink-dim">
                    {claim.amount_cents != null && (
                      <span className="text-[14px] font-semibold text-ink">
                        {f.eur(claim.amount_cents)}
                      </span>
                    )}
                    <span>{f.dateTime(claim.last_event_at ?? claim.updated_at)}</span>
                    <Mono>{claim.order_ref}</Mono>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
