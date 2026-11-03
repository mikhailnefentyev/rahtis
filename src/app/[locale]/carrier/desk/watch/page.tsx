import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState, buttonClass } from '@/components/ui';
import { deleteLaneWatchAction, toggleLaneWatchAction } from '@/lib/backhaul/actions';
import { requireRole } from '@/lib/auth/guard';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';
import { WatchForm } from './WatchForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.backhaul.watchTitle };
}

/** Начало окна «за N дней» — для счётчика совпадений. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

/**
 * Kuormavahti — подписки перевозчика на направления.
 *
 * Когда на стол выходит заказ, подходящий подписке, компания получает
 * уведомление в кабинет и, если отмечено, письмо (app.notify_lane_watches,
 * один раз на заказ). Видимость — та же, что у стола.
 */
export default async function LaneWatchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const [{ t, m, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const b = t.backhaul;

  const [{ data: watches }, { data: places }, { data: hits }] = await Promise.all([
    supabase
      .from('lane_watches')
      .select('*')
      .eq('company_id', viewer.company!.id)
      .order('created_at', { ascending: false }),
    supabase.rpc('lane_places'),
    supabase
      .from('lane_watch_hits')
      .select('watch_id')
      .gte('created_at', daysAgo(30)),
  ]);

  const hitCount = new Map<string, number>();
  for (const h of hits ?? []) {
    if (h.watch_id) hitCount.set(h.watch_id, (hitCount.get(h.watch_id) ?? 0) + 1);
  }
  const list = watches ?? [];

  return (
    <main className="cab-page">
      <Link href={`/${locale}/carrier/desk`} className="text-[12.5px] text-ink-muted hover:text-ink">
        ← {t.desk.title}
      </Link>
      <h1 className="page-title mt-2">{b.watchTitle}</h1>
      <p className="mt-2 mb-6 max-w-xl text-[13px] leading-relaxed text-ink-muted">{b.watchSubtitle}</p>

      {list.length < 20 ? (
        <WatchForm places={(places ?? []).map((p) => p.city)} />
      ) : (
        <Card stripe="warn" className="mb-6">
          <CardBody>
            <p className="text-[13px] text-ink-muted">{b.limit}</p>
          </CardBody>
        </Card>
      )}

      <p className="label-micro mt-8 mb-3">{m('backhaul.watchCount', { count: list.length })}</p>

      {list.length === 0 ? (
        <EmptyState title={b.empty} description={b.emptyHint} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((w) => (
            <li key={w.id}>
              <Card stripe={w.active ? 'ok' : 'neutral'}>
                <CardBody className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold tracking-tight">
                      {w.from_city} {w.from_radius_km} km → {w.to_city ? `${w.to_city} ${w.to_radius_km} km` : b.anywhere}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
                      <span>{w.haul_kind ? t.haulKind[w.haul_kind] : b.anyKind}</span>
                      {(w.date_from || w.date_to) && (
                        <span>
                          {w.date_from ? f.date(w.date_from) : '…'} – {w.date_to ? f.date(w.date_to) : '…'}
                        </span>
                      )}
                      <span>{w.notify_email ? b.emailOn : b.emailOff}</span>
                      <span>{m('backhaul.hits30', { count: hitCount.get(w.id) ?? 0 })}</span>
                      {!w.active && <Badge tone="neutral">{b.paused}</Badge>}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <form action={toggleLaneWatchAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={w.id} />
                      <input type="hidden" name="active" value={w.active ? 'false' : 'true'} />
                      <Button type="submit" size="sm">
                        {w.active ? b.pause : b.resume}
                      </Button>
                    </form>
                    <form action={deleteLaneWatchAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={w.id} />
                      <button type="submit" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
                        {b.delete}
                      </button>
                    </form>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
