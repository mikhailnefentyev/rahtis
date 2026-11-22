import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardBody } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { installmentsAvailable } from '@/lib/installments/access';
import { installmentUiCopy } from '@/lib/installments/copy';
import { getDictionary, isLocale } from '@/lib/i18n';
import { SaleVehicleForm } from '../../SaleVehicleForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: (await getDictionary(locale)).fleet.newVehicle };
}

/*
 * Машина на продажу у компании без парка (решение 23.11.2026). Перевозчик
 * продаёт машины из парка, поэтому страница есть только в этом кабинете.
 */
export default async function NewSaleVehiclePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, 'SHIPPER');
  if (!installmentsAvailable(viewer.company!.country)) notFound();
  const [t, ui] = [await getDictionary(locale), installmentUiCopy(locale)];

  return (
    <main className="cab-page flex flex-col gap-4">
      <div>
        <h1 className="page-title">{t.fleet.newVehicle}</h1>
        <p className="mt-1 max-w-[70ch] text-[14px] text-ink-muted">{ui.saleVehicles.hint}</p>
      </div>
      <Card>
        <CardBody>
          <SaleVehicleForm locale={locale} vehicle={null} />
        </CardBody>
      </Card>
    </main>
  );
}
