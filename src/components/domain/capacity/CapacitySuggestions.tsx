import Link from 'next/link';
import { Button, Card, CardBody } from '@/components/ui';
import { VerifiedBadge } from '@/components/domain/VerifiedBadge';
import { quickCapacityRequestAction } from '@/lib/capacity/actions';
import { isPartialLoad } from '@/lib/capacity/compute';
import { gateBlocked } from '@/lib/forwarders/docsGate';
import { loadOwnDocsGate } from '@/lib/forwarders/docsGateServer';
import type { Locale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';
import { CabotageNote, spaceText } from './CabotageNote';

type OrderLite = {
  id: string;
  ref: string;
  shipper_ref: string | null;
  haul_kind: string;
  ldm: number | null;
  status: string;
  rate_cents: number | null;
  currency: string;
};

/**
 * «2 машины по пути со свободным местом» — к частичным грузам заказчика
 * (фургон, грузовик, фура до 8 м), ещё не взятым. Запрос одним нажатием —
 * по ставке заказа; другая цена и даты — на странице места.
 */
export async function CapacitySuggestions({ locale, orders }: { locale: Locale; orders: OrderLite[] }) {
  const partial = orders.filter((o) => (o.status === 'OPEN' || o.status === 'DRAFT') && isPartialLoad(o.haul_kind, o.ldm === null ? null : Number(o.ldm)));
  if (partial.length === 0) return null;

  const [{ t, m, f }, supabase, gate] = await Promise.all([getViewerI18n(locale), createClient(), loadOwnDocsGate()]);
  /* Запрос места закрыт экспедитору без принятых документов (11.11.2026). */
  const docsBlocked = gateBlocked(gate);
  const { data, error } = await supabase.rpc('capacity_suggestions', { p_order_ids: partial.slice(0, 50).map((o) => o.id) });
  if (error || !data?.length) return null;

  const c = t.capacity;
  const byOrder = new Map<string, typeof data>();
  for (const row of data) byOrder.set(row.order_id, [...(byOrder.get(row.order_id) ?? []), row]);
  const day = (d: string) => f.date(`${d}T12:00:00Z`);

  return (
    <Card stripe="ok" className="mb-6">
      <CardBody className="flex flex-col gap-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{c.suggestTitle}</h2>
          <p className="mt-0.5 max-w-xl text-[12.5px] leading-relaxed text-ink-muted">{c.suggestLead}</p>
        </div>
        <ul className="flex flex-col divide-y divide-line">
          {partial
            .filter((o) => byOrder.has(o.id))
            .map((o) => {
              const rows = byOrder.get(o.id)!;
              return (
                <li key={o.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <p className="flex flex-wrap items-baseline gap-x-2.5 text-[13px]">
                    <span className="font-mono font-semibold">{o.ref}</span>
                    <span>{m('capacity.trucksOnWay', { count: rows.length })}</span>
                    <Link href={`/${locale}/shipper/capacity?order=${o.id}`} className="text-accent hover:underline">
                      {c.seeAll}
                    </Link>
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {rows.slice(0, 2).map((s) => (
                      <li key={s.offer_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                        <span className="text-ink">
                          {s.from_city} → {s.to_city} · {s.available_from === s.available_to ? day(s.available_from) : `${day(s.available_from)} – ${day(s.available_to)}`}
                        </span>
                        <span className="text-ink-muted">
                          {spaceText(t, locale, { ldm: s.free_ldm === null ? null : Number(s.free_ldm), kg: s.free_kg, pallets: s.free_pallets })}
                        </span>
                        <span className="text-ink-muted">{c.detour.replace('{km}', String(s.detour_km))}</span>
                        <span className="font-semibold">{s.carrier_name}</span>
                        {s.verified && <VerifiedBadge label={t.verification.badge} hint={t.verification.badgeHint} />}
                        {s.my_pending > 0 ? (
                          <span className="font-semibold text-ok">{c.requested}</span>
                        ) : (
                          o.rate_cents && (
                            <form action={quickCapacityRequestAction}>
                              <input type="hidden" name="locale" value={locale} />
                              <input type="hidden" name="offer_id" value={s.offer_id} />
                              <input type="hidden" name="order_id" value={o.id} />
                              <Button
                                type="submit"
                                size="sm"
                                variant="primary"
                                disabled={docsBlocked}
                                title={docsBlocked ? t.docsGate.blockedShort : undefined}
                              >
                                {c.quickRequest.replace('{price}', f.money(o.rate_cents, o.currency))}
                              </Button>
                            </form>
                          )
                        )}
                        {s.cabotage_ops !== null && (
                          <span className="w-full">
                            <CabotageNote t={t} show ops={s.cabotage_ops} />
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
        </ul>
      </CardBody>
    </Card>
  );
}
