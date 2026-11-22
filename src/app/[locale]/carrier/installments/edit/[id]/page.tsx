import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardBody } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import type { VatMode } from '@/lib/installments/calc';
import { installmentsAvailable, vehicleSellable } from '@/lib/installments/access';
import { installmentUiCopy } from '@/lib/installments/copy';
import { isLocale } from '@/lib/i18n';
import { installmentCopy } from '@/lib/landing/installment';
import { createClient } from '@/lib/supabase/server';
import { ListingForm } from '../../ListingForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: installmentUiCopy(locale).listing.editTitle };
}

const euros = (cents: number | null) => (cents == null ? '' : String(cents / 100));

/** Правка своего объявления, пока по нему нет согласованной сделки. */
export default async function EditListingPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, 'CARRIER');
  if (!installmentsAvailable(viewer.company!.country)) notFound();
  const ui = installmentUiCopy(locale);
  const supabase = await createClient();
  const [{ data: listing }, { data: approved }] = await Promise.all([
    supabase.from('equipment_listings').select('*').eq('id', id).maybeSingle(),
    /* Как у нового объявления: без машин, купленных в рассрочку и ещё не выплаченных (22.11.2026). */
    supabase
      .from('vehicles')
      .select('id, make, plate, installment_role')
      .eq('company_id', viewer.company!.id)
      .eq('access', 'APPROVED')
      .order('plate'),
  ]);
  if (!listing || !approved || !['DRAFT', 'PUBLISHED'].includes(listing.status)) notFound();
  const vehicles = approved.filter((v) => vehicleSellable(v.installment_role));

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
            vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.plate} · ${v.make}` }))}
            vehicleId={listing.vehicle_id}
            defaults={{
              price: euros(listing.price_cents),
              vatMode: listing.vat_mode as VatMode,
              vatBps: listing.vat_bps,
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
