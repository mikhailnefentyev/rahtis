import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody, EmptyState, buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import {
  CABINET_VAT_MODE,
  installmentsAvailable,
  installmentsBase,
  saleVehicleSellable,
  vehicleSellable,
  type InstallmentCabinet,
} from '@/lib/installments/access';
import { installmentUiCopy } from '@/lib/installments/copy';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { installmentCopy } from '@/lib/landing/installment';
import { createClient } from '@/lib/supabase/server';
import { ListingForm } from './ListingForm';

export async function newListingMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: installmentUiCopy(locale).listing.newTitle };
}

/**
 * Машины, которые компания может выставить на продажу. У перевозчика —
 * из парка: одобренные и не купленные в рассрочку до выплаты
 * (app.vehicle_sellable). У компании без парка (23.11.2026) — её машины
 * на продажу, одобренные оператором и не проданные
 * (app.sale_vehicle_sellable). Раньше несовместимая машина была в списке,
 * а сохранение кончалось общей ошибкой (22.11.2026).
 */
export async function sellableVehicles(companyId: string, role: InstallmentCabinet): Promise<{ id: string; label: string }[]> {
  const supabase = await createClient();
  if (role === 'CARRIER') {
    const { data } = await supabase
      .from('vehicles')
      .select('id, make, plate, installment_role')
      .eq('company_id', companyId)
      .eq('access', 'APPROVED')
      .order('plate');
    return (data ?? []).filter((v) => vehicleSellable(v.installment_role)).map((v) => ({ id: v.id, label: `${v.plate} · ${v.make}` }));
  }
  const { data } = await supabase
    .from('equipment_sale_vehicles')
    .select('id, make, plate, access, sold_deal_id')
    .eq('company_id', companyId)
    .order('plate');
  return (data ?? []).filter(saleVehicleSellable).map((v) => ({ id: v.id, label: `${v.plate} · ${v.make}` }));
}

/**
 * Новое объявление: своя машина, условия по умолчанию — пример
 * калькулятора. Один экран на два кабинета (role): перевозчик выбирает
 * машину из парка, компания без парка — из своих машин на продажу.
 */
export async function NewListingScreen({
  params,
  searchParams,
  role,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vehicle?: string }>;
  role: InstallmentCabinet;
}) {
  const [{ locale }, { vehicle }] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, role);
  if (!installmentsAvailable(viewer.company!.country)) notFound();
  const home = `/${locale}${installmentsBase(role)}`;
  const ui = installmentUiCopy(locale);
  const vehicles = await sellableVehicles(viewer.company!.id, role);
  /* Продавать нечего — объяснение вместо «страницы нет»; компании без парка — сразу кнопка «добавить машину». */
  if (!vehicles.length) {
    const { t } = await getViewerI18n(locale);
    return (
      <main className="cab-page flex flex-col gap-4">
        <h1 className="page-title">{ui.listing.newTitle}</h1>
        <EmptyState
          title={ui.listing.vehicle}
          description={role === 'CARRIER' ? ui.listing.noVehicles : ui.listing.noVehiclesSeller}
          action={
            role === 'CARRIER' ? (
              <Link href={home} className="text-[13px] text-accent hover:underline">
                ‹ {ui.title}
              </Link>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href={`${home}/vehicle/new`} className={buttonClass({ variant: 'primary', size: 'md' })}>
                  {t.fleet.addVehicle}
                </Link>
                <Link href={home} className="text-[13px] text-accent hover:underline">
                  ‹ {ui.title}
                </Link>
              </div>
            )
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
            vehicles={vehicles}
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
