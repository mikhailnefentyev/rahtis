import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TruckPhoto } from '@/components/domain/TruckPhoto';
import { Card, CardBody } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { addMonths, type VatMode } from '@/lib/installments/calc';
import { installmentsAvailable, vatModeAllowedForNew } from '@/lib/installments/access';
import { installmentCurrency, installmentToday } from '@/lib/installments/countries';
import { countryName, installmentCountryCopy } from '@/lib/installments/countryCopy';
import { installmentRules } from '@/lib/installments/rules';
import { LegalNotice } from '../../LegalNotice';
import { fill, installmentUiCopy } from '@/lib/installments/copy';
import { isLocale } from '@/lib/i18n';
import { installmentCopy } from '@/lib/landing/installment';
import { createClient } from '@/lib/supabase/server';
import { OfferForm } from '../../DealForms';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: installmentUiCopy(locale).catalog.open };
}

const euros = (cents: number | null) => (cents == null ? '' : String(cents / 100));

/**
 * Машина из каталога и предложение покупателя. Объявление читается через
 * каталог (equipment_catalog): его видят только проверенные перевозчики.
 */
export default async function ListingPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, 'CARRIER');
  if (!installmentsAvailable(viewer.company!.country)) notFound();
  const supabase = await createClient();
  const { data: catalog } = await supabase.rpc('equipment_catalog');
  const l = (catalog ?? []).find((x) => x.listing_id === id);
  if (!l) notFound();
  /*
   * Сделка — только внутри одной страны (23.11.2026): объявление другой
   * страны видно, но предложение по нему не делается. До миграции
   * 20261128100000 каталог страну не отдаёт — тогда это страна компании.
   */
  const sellerCountry = l.seller_country ?? viewer.company!.country;
  const sameCountry = l.same_country ?? true;
  /* Тексты — про право страны продавца: по нему будет договор (23.11.2026). */
  const ui = installmentUiCopy(locale, sellerCountry);
  const cc = installmentCountryCopy(locale);

  /* Передача — через две недели, первый взнос — через месяц после неё: черновик, покупатель меняет. */
  const today = installmentToday(sellerCountry);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 14);
  const handover = d.toISOString().slice(0, 10);

  return (
    <main className="cab-page flex flex-col gap-4">
      <h1 className="page-title">{l.make}</h1>
      <Card>
        <CardBody className="grid gap-5 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <TruckPhoto make={l.make} vehicleClass={l.vehicle_class} plate={l.plate} sizes="(min-width: 768px) 420px, 100vw" />
          <div className="text-[14px]">
            <p>
              {ui.catalog.seller}: <span className="font-semibold">{l.seller_name}</span>
              {l.seller_city ? ` · ${l.seller_city}` : ''}
              {` · ${countryName(locale, sellerCountry)}`}
            </p>
            <p className="mt-1 text-ink-muted">
              {[l.plate, l.euro_class, l.odometer_km != null ? `${l.odometer_km.toLocaleString(locale === 'en' ? 'en-GB' : locale)} km` : null].filter(Boolean).join(' · ')}
            </p>
            {l.description && <p className="mt-3 whitespace-pre-line">{l.description}</p>}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h2 className="mb-4 text-[17px] font-semibold">{ui.deal.terms}</h2>
          {/* Новая сделка — только с обычным НДС (решение 22.11.2026): по старому объявлению с другим режимом предложение не принимается. */}
          {!sameCountry ? (
            <p className="rounded-card border border-line bg-sunken px-3 py-2 text-[14px] text-ink-muted">
              {fill(cc.otherCountry, { country: countryName(locale, sellerCountry) })}
            </p>
          ) : !vatModeAllowedForNew(l.vat_mode) ? (
            <p className="rounded-card border border-warn/35 bg-warn/10 px-3 py-2 text-[14px] text-warn">{ui.listing.vatOld}</p>
          ) : (
          <>
          <div className="mb-4">
            <LegalNotice ui={ui} locale={locale} />
          </div>
          <OfferForm
            locale={locale}
            ui={ui}
            calc={installmentCopy(locale)}
            listingId={l.listing_id}
            defaults={{
              price: euros(l.price_cents),
              vatMode: l.vat_mode as VatMode,
              vatBps: l.vat_bps,
              currency: l.currency ?? installmentCurrency(sellerCountry),
              rules: installmentRules(sellerCountry)?.id ?? null,
              down: euros(l.down_payment_cents),
              months: String(l.months),
              final: euros(l.final_cents),
              rate: String(l.annual_rate_bps / 100),
              handover,
              firstDue: addMonths(handover, 1),
            }}
          />
          </>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
