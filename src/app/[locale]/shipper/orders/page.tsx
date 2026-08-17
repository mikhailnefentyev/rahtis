import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody, buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { cabinetPath } from '@/lib/auth/paths';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { OrderStop } from '@/types/db';
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
        <OrdersView orders={orders ?? []} stopsByOrder={stopsByOrder} />
      )}
    </main>
  );
}
