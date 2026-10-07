import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState } from '@/components/ui';
import type { StatusTone } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';
import { setShipperLinkAction } from '@/lib/partners/actions';
import { createClient } from '@/lib/supabase/server';
import { InviteShipperForm } from './InviteShipperForm';
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

  const [{ data: partners }, { data: invites }] = await Promise.all([
    supabase.rpc('carrier_partners'),
    supabase
      .from('shipper_invites')
      .select('id, company_name, email, created_at, applied_company_id, applied_at, invite_kind')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  /* Одобренный — тот, с кем уже есть активная связь. */
  const approved = new Set((partners ?? []).filter((p) => p.status === 'ACTIVE').map((p) => p.shipper_id));
  const active = viewer.company?.status === 'ACTIVE';

  return (
    <main className="cab-page">
      <h1 className="page-title">{t.partners.title}</h1>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">{t.partners.subtitle}</p>
      <p className="mt-2 mb-6 max-w-xl text-xs text-ink-dim">{subscriber ? t.partners.anonymitySubscriber : t.partners.anonymity}</p>

      {/*
        * Свои клиенты — главный источник заказов: реальных заказчиков на
        * платформе нет, а у каждого перевозчика они есть (30.09.2026).
        */}
      {active && (
        <Card className="mb-6" stripe="ok">
          <CardBody className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight">{t.partners.inviteTitle}</h2>
            <p className="max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t.partners.inviteText}</p>
            <InviteShipperForm />
          </CardBody>
        </Card>
      )}

      {(invites ?? []).length > 0 && (
        <section className="mb-6">
          <p className="label-micro mb-2">{t.partners.invitesTitle}</p>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {(invites ?? []).map((i) => {
              const state = i.applied_company_id && approved.has(i.applied_company_id) ? 'approved' : i.applied_at ? 'applied' : 'sent';
              const carrierInvite = i.invite_kind === 'CARRIER';
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-muted">
                  <span className="font-semibold text-ink">{i.company_name}</span>
                  <Badge tone="info">{carrierInvite ? t.partners.inviteKindCarrier : t.partners.inviteKindShipper}</Badge>
                  <span>{i.email}</span>
                  <span>{f.date(i.created_at)}</span>
                  <Badge tone={state === 'approved' ? 'ok' : state === 'applied' ? 'warn' : 'neutral'}>
                    {state === 'approved' ? t.partners.inviteStatusApproved : state === 'applied' ? t.partners.inviteStatusApplied : t.partners.inviteStatusSent}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
