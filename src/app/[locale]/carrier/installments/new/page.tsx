import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody, EmptyState } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { CABINET_VAT_MODE, installmentsAvailable, vehicleSellable } from '@/lib/installments/access';
import { installmentUiCopy } from '@/lib/installments/copy';
import { isLocale } from '@/lib/i18n';
import { installmentCopy } from '@/lib/landing/installment';
import { createClient } from '@/lib/supabase/server';
import { ListingForm } from '../ListingForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: installmentUiCopy(locale).listing.newTitle };
}

/** Новое объявление: машина из своего парка, условия по умолчанию — пример калькулятора. */
export default async function NewListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const [{ locale }, { vehicle }] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, 'CARRIER');
  if (!installmentsAvailable(viewer.company!.country)) notFound();
  const ui = installmentUiCopy(locale);
  const supabase = await createClient();
  /*
   * Только машины, которые база даст выставить (app.vehicle_sellable): одобренные и
   * не купленные в рассрочку до выплаты. Раньше такая машина была в списке, а
   * сохранение кончалось общей ошибкой (22.11.2026).
   */
  const { data: approved } = await supabase
    .from('vehicles')
    .select('id, make, plate, installment_role')
    .eq('company_id', viewer.company!.id)
    .eq('access', 'APPROVED')
    .order('plate');
  const vehicles = (approved ?? []).filter((v) => vehicleSellable(v.installment_role));
  /* Продавать нечего — объяснение вместо «страницы нет». */
  if (!vehicles.length) {
    return (
      <main className="cab-page flex flex-col gap-4">
        <h1 className="page-title">{ui.listing.newTitle}</h1>
        <EmptyState
          title={ui.listing.vehicle}
          description={ui.listing.noVehicles}
          action={
            <Link href={`/${locale}/carrier/installments`} className="text-[13px] text-accent hover:underline">
              ‹ {ui.title}
            </Link>
          }
        />
      </main>
    );
  }
  const selected = vehicles.some((v) => v.id === vehicle) ? vehicle! : vehicles[0].id;

  return (
    <main className="cab-page flex flex-col gap-4">
      <h1 className="page-title">{ui.listing.newTitle}</h1>
      <Card>
        <CardBody>
          <ListingForm
            locale={locale}
            ui={ui}
            calc={installmentCopy(locale)}
            id={null}
            vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.plate} · ${v.make}` }))}
            vehicleId={selected}
            defaults={{ price: '', vatMode: CABINET_VAT_MODE, vatBps: 2550, down: '', months: '24', final: '', rate: '0' }}
            odometer=""
            description=""
          />
        </CardBody>
      </Card>
    </main>
  );
}
