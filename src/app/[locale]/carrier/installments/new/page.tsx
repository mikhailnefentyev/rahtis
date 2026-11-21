import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardBody } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
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
  const ui = installmentUiCopy(locale);
  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, make, plate')
    .eq('company_id', viewer.company!.id)
    .eq('access', 'APPROVED')
    .order('plate');
  if (!vehicles?.length) notFound();
  const selected = vehicles.some((v) => v.id === vehicle) ? vehicle! : vehicles[0].id;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{ui.listing.newTitle}</h1>
      <Card>
        <CardBody>
          <ListingForm
            locale={locale}
            ui={ui}
            calc={installmentCopy(locale)}
            id={null}
            vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.plate} · ${v.make}` }))}
            vehicleId={selected}
            defaults={{ price: '', vatMode: 'STANDARD', vatBps: 2550, down: '', months: '24', final: '', rate: '0' }}
            odometer=""
            description=""
          />
        </CardBody>
      </Card>
    </div>
  );
}
