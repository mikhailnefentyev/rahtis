import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardBody } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { siteUrl } from '@/lib/config';
import { operatorInbox } from '@/lib/email';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { OwnView, type OwnJob } from './OwnView';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.own.title };
}

/**
 * Свои рейсы перевозчика: клиент перевозчика, своя машина, мимо стола.
 *
 * Доступ — по подписке; перевозчику по подряду — в бесплатный первый
 * период (public.own_orders_access). Без доступа страница говорит цену
 * и куда написать, а не прячет раздел.
 */
export default async function OwnOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { locale } = await params;
  /* «+ Uusi oma keikka» с обзора открывает форму сразу. */
  const startNew = (await searchParams).new === '1';
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const [{ t, m }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const [{ data: access }, { data: clients }, { data: vehicles }] = await Promise.all([
    supabase.rpc('own_orders_access'),
    supabase.rpc('carrier_clients'),
    supabase.rpc('carrier_own_vehicles'),
  ]);

  const active = viewer.company?.status === 'ACTIVE';
  const names = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const ids = [...names.keys()];

  const { data: orders } = ids.length
    ? await supabase
        .from('orders')
        /*
         * assigned_vehicle_id перевозчику по колонкам не открыт — номер
         * машины берётся из my_assignments, как на столе. Выборка с
         * закрытой колонкой падала целиком, и список был пуст (8.10.2026).
         */
        .select('id, ref, status, shipper_company_id, created_at, track_token')
        .in('shipper_company_id', ids)
        .order('created_at', { ascending: false })
        .limit(30)
    : { data: [] };

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: stops } = orderIds.length
    ? await supabase.from('order_stops').select('order_id, sequence, city, place_name').in('order_id', orderIds).order('sequence')
    : { data: [] };

  const route = new Map<string, string[]>();
  for (const s of stops ?? []) {
    const list = route.get(s.order_id) ?? [];
    const label = s.place_name || s.city;
    if (label) list.push(label);
    route.set(s.order_id, list);
  }
  const { data: assignments } = await supabase.rpc('my_assignments');
  const plates = new Map((assignments ?? []).map((a) => [a.id, a.vehicle_plate]));
  const site = siteUrl();

  const jobs: OwnJob[] = (orders ?? []).map((o) => {
    const labels = route.get(o.id) ?? [];
    return {
      id: o.id,
      ref: o.ref,
      status: o.status,
      client: names.get(o.shipper_company_id) ?? '',
      route: labels.length > 1 ? `${labels[0]} → ${labels[labels.length - 1]}` : (labels[0] ?? ''),
      plate: plates.get(o.id) ?? '',
      created_at: o.created_at,
      track: o.track_token ? `${site}/${locale}/track/${o.track_token}` : null,
    };
  });

  return (
    <main className="cab-page">
      <h1 className="page-title">{t.own.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t.own.subtitle}</p>

      {!active || !access ? (
        <Card stripe="warn">
          <CardBody className="flex flex-col gap-2">
            <p className="text-[13px] text-ink">{active ? t.own.subscriptionOnly : t.orderForm.needActive}</p>
            {active && <p className="text-[13px] text-ink-muted">{m('own.subscriptionContact', { email: operatorInbox() })}</p>}
          </CardBody>
        </Card>
      ) : (
        <OwnView jobs={jobs} clients={clients ?? []} vehicles={vehicles ?? []} startNew={startNew} />
      )}
    </main>
  );
}
