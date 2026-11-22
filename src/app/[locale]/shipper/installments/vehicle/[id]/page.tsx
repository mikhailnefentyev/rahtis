import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardBody } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { installmentsAvailable, saleVehicleEditable } from '@/lib/installments/access';
import { installmentUiCopy } from '@/lib/installments/copy';
import { getDictionary, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { SaleVehicleForm } from '../../SaleVehicleForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: (await getDictionary(locale)).fleet.editVehicle };
}

/*
 * Машина на продажу у компании без парка (решение 23.11.2026). Перевозчик
 * продаёт машины из парка, поэтому страница есть только в этом кабинете.
 */
export default async function EditSaleVehiclePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, 'SHIPPER');
  if (!installmentsAvailable(viewer.company!.country)) notFound();
  const supabase = await createClient();
  /* Чужую карточку база не отдаст (политика equipment_sale_vehicles_own). */
  const [{ data: vehicle }, { count: live }] = await Promise.all([
    supabase.from('equipment_sale_vehicles').select('*').eq('id', id).eq('company_id', viewer.company!.id).maybeSingle(),
    supabase
      .from('equipment_listings')
      .select('id', { count: 'exact', head: true })
      .eq('sale_vehicle_id', id)
      .in('status', ['DRAFT', 'PUBLISHED', 'RESERVED']),
  ]);
  /* Править можно, пока карточка не на проверке, не продана и по ней нет объявления, — как в базе. */
  if (!vehicle || !saleVehicleEditable(vehicle, (live ?? 0) > 0)) notFound();
  const [t, ui] = [await getDictionary(locale), installmentUiCopy(locale)];

  return (
    <main className="cab-page flex flex-col gap-4">
      <div>
        <h1 className="page-title">
          {t.fleet.editVehicle} · {vehicle.plate}
        </h1>
        <p className="mt-1 max-w-[70ch] text-[14px] text-ink-muted">{ui.saleVehicles.hint}</p>
      </div>
      <Card>
        <CardBody>
          <SaleVehicleForm
            locale={locale}
            vehicle={{
              id: vehicle.id,
              plate: vehicle.plate,
              make: vehicle.make,
              vehicleClass: vehicle.vehicle_class,
              euroClass: vehicle.euro_class,
              axles: vehicle.axles,
              payloadKg: vehicle.payload_kg,
              ldm: vehicle.ldm,
            }}
          />
        </CardBody>
      </Card>
    </main>
  );
}
