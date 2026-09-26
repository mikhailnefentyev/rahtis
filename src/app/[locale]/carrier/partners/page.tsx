import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState } from '@/components/ui';
import type { StatusTone } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';
import { setShipperLinkAction } from '@/lib/partners/actions';
import { createClient } from '@/lib/supabase/server';
import type { LinkStatus } from '@/types/db';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.partners.title };
}

const tone: Record<LinkStatus, StatusTone> = { OFFERED: 'warn', ACTIVE: 'ok', REVOKED: 'neutral' };

/**
 * Заказчики, с которыми перевозчик уже возил, и его согласие на прямые
 * заказы от каждого.
 *
 * Ждущие решения — наверху: после первого рейса с новым заказчиком сюда
 * ведёт уведомление, и решение должно быть первым, что человек увидит.
 */
export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  /*
   * Кто кого видит, зависит от ветки: на подписке прямые рейсы
   * выставляются напрямую, и стороны видят друг друга по имени (TERMS
   * 6.7). Прежде страница всем писала «клиенты видны кодом, договор с
   * Aivomaa» — у подписчика это было неправдой.
   */
  const subscriber = viewer.company?.partnership === 'SUBSCRIBER';
  const [{ t, m, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data: partners } = await supabase.rpc('carrier_partners');

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight">{t.partners.title}</h1>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">{t.partners.subtitle}</p>
      <p className="mt-2 mb-6 max-w-xl text-xs text-ink-dim">{subscriber ? t.partners.anonymitySubscriber : t.partners.anonymity}</p>

      {(partners ?? []).length === 0 ? (
        <EmptyState title={t.partners.none} />
      ) : (
        <div className="flex flex-col gap-3">
          {(partners ?? []).map((p) => (
            <Card key={p.shipper_id} stripe={tone[p.status]}>
              <CardBody className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-[15px] font-semibold tracking-tight">{p.shipper_name}</h3>
                    <Badge tone={tone[p.status]}>{t.linkStatus[p.status]}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-muted">
                    {m('partners.tripsCount', { count: p.trips })}
                    {p.last_trip_at && ` · ${t.partners.lastTrip} ${f.date(p.last_trip_at)}`}
                    {p.last_route && ` · ${p.last_route}`}
                  </p>
                </div>

                <form action={setShipperLinkAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="shipper_id" value={p.shipper_id} />
                  <input type="hidden" name="allow" value={p.status === 'ACTIVE' ? '0' : '1'} />
                  <Button type="submit" size="sm" variant={p.status === 'ACTIVE' ? 'danger' : 'primary'}>
                    {p.status === 'ACTIVE' ? t.partners.revoke : t.partners.allow}
                  </Button>
                </form>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
