import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardBody } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { CABINET_VAT_MODE, installmentsAvailable, type InstallmentCabinet } from '@/lib/installments/access';
import { installmentCurrency } from '@/lib/installments/countries';
import { installmentRules } from '@/lib/installments/rules';
import { installmentUiCopy } from '@/lib/installments/copy';
import { isLocale } from '@/lib/i18n';
import { installmentCopy } from '@/lib/landing/installment';
import { createClient } from '@/lib/supabase/server';
import { ListingForm } from './ListingForm';
import { sellableVehicles } from './NewListingScreen';

export async function editListingMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: installmentUiCopy(locale).listing.editTitle };
}

const euros = (cents: number | null) => (cents == null ? '' : String(cents / 100));

/**
 * Правка своего объявления, пока по нему нет согласованной сделки. Один
 * экран на два кабинета (role, 23.11.2026): у компании без парка машина —
 * из её машин на продажу.
 */
export async function EditListingScreen({
  params,
  role,
}: {
  params: Promise<{ locale: string; id: string }>;
  role: InstallmentCabinet;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, role);
  if (!installmentsAvailable(viewer.company!.country)) notFound();
  const ui = installmentUiCopy(locale);
  const supabase = await createClient();
  const [{ data: listing }, vehicles] = await Promise.all([
    supabase.from('equipment_listings').select('*').eq('id', id).maybeSingle(),
    /* Как у нового объявления: только то, что база даст выставить (22.11.2026). */
    sellableVehicles(viewer.company!.id, role),
  ]);
  if (!listing || !['DRAFT', 'PUBLISHED'].includes(listing.status)) notFound();
  /* Машина объявления — из парка или из машин на продажу: ровно одна из двух ссылок. */
  const vehicleId = listing.vehicle_id ?? listing.sale_vehicle_id ?? '';

  return (
    <main className="cab-page flex flex-col gap-4">
      <h1 className="page-title">{ui.listing.editTitle}</h1>
      <Card>
        <CardBody>
          <ListingForm
            locale={locale}
            ui={ui}
            calc={installmentCopy(locale)}
            id={listing.id}
            vehicles={vehicles}
            vehicleId={vehicleId}
            defaults={{
              price: euros(listing.price_cents),
              /* Объявление сохраняется только с обычным НДС (решение 22.11.2026) — и старое с другим режимом тоже. */
              vatMode: CABINET_VAT_MODE,
              vatBps: listing.vat_bps,
              /* Валюта объявления — страны продавца; до миграции 20261128100000 столбец всегда 'EUR'. */
              currency: listing.currency ?? installmentCurrency(viewer.company!.country),
              rules: installmentRules(viewer.company!.country)?.id ?? null,
              down: euros(listing.down_payment_cents),
              months: String(listing.months),
              final: euros(listing.final_cents),
              rate: String(listing.annual_rate_bps / 100),
            }}
            odometer={listing.odometer_km != null ? String(listing.odometer_km) : ''}
            description={listing.description}
          />
        </CardBody>
      </Card>
    </main>
  );
}
