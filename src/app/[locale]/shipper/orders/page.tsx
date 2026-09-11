import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody, buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { accountPath } from '@/lib/auth/paths';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { OrderAmendment, OrderStop, ShipperOffer } from '@/types/db';
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

  /*
   * Колонки поимённо, а не select('*'): колонки назначения заказчику не
   * выдаются грантом (см. миграцию carrier_anonymity), и звёздочка
   * упёрлась бы в отказ доступа целиком.
   */
  const { data: orders } = await supabase
    .from('orders')
    .select(
      'id,ref,shipper_ref,order_type,haul_kind,container_feet,trailer,trailer_plate,distance_km,rate_cents,comment,status,published_at,deadline_at,created_at,distance_source,distance_auto_km,route_geometry,route_bounds',
    )
    .eq('shipper_company_id', company.id)
    /*
     * Выполненные сюда не попадают: у них своя вкладка, где лежат
     * документы, суммы и оценка. Список заказов — это то, что ещё в
     * работе, и держать в нём готовое значит удлинять его ровно на
     * величину оборота компании.
     */
    .neq('status', 'DONE')
    .order('created_at', { ascending: false });

  const orderIds = (orders ?? []).map((o) => o.id);

  /*
   * Отклики через RPC, а не вложенным select по order_offers.
   *
   * Две причины сразу. У заказчика нет и не должно быть политики чтения
   * vehicles — вложенные связи приходили пустыми. И состав того, что
   * заказчик вправе знать об исполнителе, должен быть записан в одном
   * месте явным списком колонок: компании-перевозчика там нет.
   *
   * IN_PROGRESS в списке наравне с ожиданием решения: после подтверждения
   * водителем заказчик должен видеть машину и водителя — без них не
   * выписать пропуск в порт.
   */
  const withCarrierIds = (orders ?? [])
    .filter(
      (o) =>
        o.status === 'REQUESTED' || o.status === 'AWAIT_DRIVER' || o.status === 'IN_PROGRESS',
    )
    .map((o) => o.id);

  /*
   * Точки, отклики и правки зависят от списка заказов, но не друг от
   * друга, — значит идут вместе, а не в очередь.
   *
   * Цена очереди здесь не теоретическая: до базы примерно девяносто
   * миллисекунд в один конец независимо от того, что спрашиваешь, и три
   * последовательных похода стоили почти треть секунды ожидания на ровном
   * месте. Запросов столько же, ожидание одно.
   */
  const [{ data: stops }, { data: offers }, { data: amendmentRows }] = await Promise.all([
    orderIds.length
      ? supabase.from('order_stops').select('*').in('order_id', orderIds).order('sequence')
      : Promise.resolve({ data: [] as OrderStop[] }),
    withCarrierIds.length
      ? supabase.rpc('offers_for_shipper', { p_order_ids: withCarrierIds })
      : Promise.resolve({ data: [] as ShipperOffer[] }),
    orderIds.length
      ? supabase.from('order_amendments').select('*').in('order_id', orderIds).order('created_at')
      : Promise.resolve({ data: [] as OrderAmendment[] }),
  ]);

  const stopsByOrder: Record<string, OrderStop[]> = {};
  for (const stop of stops ?? []) {
    (stopsByOrder[stop.order_id] ??= []).push(stop);
  }

  const offersByOrder: Record<string, ShipperOffer[]> = {};
  for (const offer of (offers ?? []) as ShipperOffer[]) {
    (offersByOrder[offer.order_id] ??= []).push(offer);
  }

  /*
   * Журнал правок маршрута (ТЗ §8). Читается тем же порядком, что и
   * документы: одним запросом на все заказы, а не по одному на карточку.
   * Заказчику он показывает, что он сам поменял после старта, — карточка
   * идущего рейса иначе не отличается от той, которую взял перевозчик.
   */
  const amendmentsByOrder: Record<string, OrderAmendment[]> = {};
  for (const row of amendmentRows ?? []) {
    (amendmentsByOrder[row.order_id] ??= []).push(row);
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
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
              href={accountPath(locale)}
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
          amendmentsByOrder={amendmentsByOrder}
        />
      )}
    </main>
  );
}
