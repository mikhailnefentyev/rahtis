import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody, buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { cabinetPath } from '@/lib/auth/paths';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { OrderStop } from '@/types/db';
import type { OfferRow } from './OffersPanel';
import { OrdersView } from './OrdersView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.orders.title };
}

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'SHIPPER');
  const company = viewer.company!;

  const [{ t }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('shipper_company_id', company.id)
    .order('created_at', { ascending: false });

  /* Точки читаются одним запросом на все заказы, а не по одному на карточку. */
  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: stops } = orderIds.length
    ? await supabase.from('order_stops').select('*').in('order_id', orderIds).order('sequence')
    : { data: [] as OrderStop[] };

  const stopsByOrder: Record<string, OrderStop[]> = {};
  for (const stop of stops ?? []) {
    (stopsByOrder[stop.order_id] ??= []).push(stop);
  }

  /*
   * Отклики вместе с машиной и компанией: заказчик выбирает по рейтингу
   * и по машине, а не по идентификаторам.
   */
  const waitingIds = (orders ?? [])
    .filter((o) => o.status === 'REQUESTED' || o.status === 'AWAIT_DRIVER')
    .map((o) => o.id);

  const offersByOrder: Record<string, OfferRow[]> = {};

  if (waitingIds.length > 0) {
    /*
     * Строка select — одним литералом, без пробелов и без склейки: разбор
     * связей в supabase-js работает на уровне типов, а конкатенация
     * превращает литерал в обычный string и типизация теряется.
     */
    const { data: offers } = await supabase
      .from('order_offers')
      .select(
        'id,order_id,carrier_company_id,vehicle_id,carrier:companies!order_offers_carrier_company_id_fkey(name),vehicle:vehicles!order_offers_vehicle_id_fkey(plate,driver_name,axles,languages)',
      )
      .in('order_id', waitingIds)
      .order('created_at');

    for (const offer of offers ?? []) {
      (offersByOrder[offer.order_id] ??= []).push({
        id: offer.id,
        carrier_company_id: offer.carrier_company_id,
        vehicle_id: offer.vehicle_id,
        carrier_name: offer.carrier?.name ?? '—',
        plate: offer.vehicle?.plate ?? '—',
        driver_name: offer.vehicle?.driver_name ?? '—',
        axles: offer.vehicle?.axles ?? 0,
        languages: offer.vehicle?.languages ?? [],
        /* Рейтинг компании появится на Этапе 7 — до тех пор оценок нет. */
        rating: null,
      });
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <nav className="mb-6">
        <Link
          href={cabinetPath(locale, 'SHIPPER')}
          className="text-[13px] text-ink-muted hover:text-ink"
        >
          ← {t.role.SHIPPER}
        </Link>
      </nav>

      <h1 className="text-xl font-semibold tracking-tight">{t.orders.title}</h1>
      <p className="mt-2 mb-6 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {t.orders.subtitle}
      </p>

      {/* Публиковать может только активная компания — объясняем это до формы. */}
      {company.status !== 'ACTIVE' ? (
        <Card stripe="warn">
          <CardBody className="flex flex-col items-start gap-3">
            <p className="text-[13px] text-ink">{t.orderForm.needActive}</p>
            <Link
              href={`/${locale}/requisites`}
              className={buttonClass({ variant: 'primary', size: 'md' })}
            >
              {t.requisites.openForm}
            </Link>
          </CardBody>
        </Card>
      ) : (
        <OrdersView
          orders={orders ?? []}
          stopsByOrder={stopsByOrder}
          offersByOrder={offersByOrder}
        />
      )}
    </main>
  );
}
