import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState, Mono, Plate } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { EURO_LABEL } from '@/lib/fleet/labels';
import { getI18n, isLocale, type Locale } from '@/lib/i18n';
import { formatIban } from '@/lib/operator/profile';
import { poolVehicleAction } from '@/lib/partners/actions';
import { createClient } from '@/lib/supabase/server';
import type { KnownVehicle } from '@/types/db';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.known.title };
}

/**
 * Знакомые машины заказчика.
 *
 * Показываются машинами — номер, водитель с телефоном и почтой для
 * связи, класс, рейтинг, — без названия перевозчика: контрагент
 * заказчика по-прежнему Aivomaa, и состав полей записан в
 * known_vehicles_for_shipper.
 */
export default async function KnownVehiclesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'SHIPPER');
  const [{ t }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data } = await supabase.rpc('known_vehicles_for_shipper');
  const vehicles = data ?? [];
  const pool = vehicles.filter((v) => v.in_pool);
  const others = vehicles.filter((v) => !v.in_pool);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight">{t.known.title}</h1>
      <p className="mt-2 mb-6 max-w-xl text-[13px] leading-relaxed text-ink-muted">{t.known.subtitle}</p>

      {vehicles.length === 0 ? (
        <EmptyState title={t.known.none} description={t.known.noneHint} />
      ) : (
        <div className="flex flex-col gap-8">
          {pool.length > 0 && <VehicleList title={t.known.pool} vehicles={pool} locale={locale} />}
          {others.length > 0 && <VehicleList title={t.known.others} vehicles={others} locale={locale} />}
        </div>
      )}
    </main>
  );
}

async function VehicleList({
  title,
  vehicles,
  locale,
}: {
  title: string;
  vehicles: KnownVehicle[];
  locale: Locale;
}) {
  const { t, m, f } = await getI18n(locale);

  return (
    <section>
      <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
        {title}
      </h2>
      <div className="flex flex-col gap-3">
        {vehicles.map((v) => (
          <Card key={v.vehicle_id} stripe={!v.available ? 'neutral' : v.busy ? 'warn' : 'ok'}>
            <CardBody className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Plate className="text-[15px]">{v.plate}</Plate>
                  <Badge tone={!v.available ? 'neutral' : v.busy ? 'warn' : 'ok'}>
                    {!v.available ? t.known.unavailable : v.busy ? t.known.busy : t.known.available}
                  </Badge>
                  {v.rating != null && (
                    <span className="text-xs text-ink-muted">★ {f.decimal(Number(v.rating), 1)}</span>
                  )}
                </div>
                <p className="mt-1.5 text-[13px] text-ink">
                  {t.vehicleClass[v.vehicle_class]} · {v.make} · {EURO_LABEL[v.euro_class]}
                  {v.vehicle_class === 'TRACTOR'
                    ? ` · ${m('vehicle.axlesCount', { count: v.axles })}`
                    : ` · ${v.payload_kg} kg · ${String(v.ldm).replace('.', ',')} ldm`}
                </p>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                  <span className="font-semibold text-ink">{v.driver_name ?? '—'}</span>
                  {v.driver_phone && (
                    <a href={`tel:${v.driver_phone}`} className="font-mono text-accent hover:underline">
                      {v.driver_phone}
                    </a>
                  )}
                  {v.driver_email && (
                    <a href={`mailto:${v.driver_email}`} className="text-accent hover:underline">
                      {v.driver_email}
                    </a>
                  )}
                </p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  {m('known.tripsCount', { count: v.trips })}
                  {v.last_trip_at && ` · ${t.known.lastTrip} ${f.date(v.last_trip_at)}`}
                </p>

                {/*
                  * Перевозчик и его реквизиты — только там, где счёт
                  * выставляет он сам. У машин, работающих через нас,
                  * заказчик платит нам, и знать перевозчика ему незачем.
                  */}
                {v.direct_billing && (
                  <div className="mt-2 flex flex-col gap-0.5 border-t border-line pt-2 text-[13px]">
                    <p className="font-semibold text-ink">
                      {v.carrier_name}
                      {v.carrier_business_id && (
                        <span className="ml-2 font-normal text-ink-muted">
                          Y-tunnus <Mono>{v.carrier_business_id}</Mono>
                        </span>
                      )}
                    </p>
                    {v.carrier_iban && (
                      <p className="text-ink-muted">
                        {t.known.carrierAccount}{' '}
                        <Mono>{formatIban(v.carrier_iban)}</Mono>
                        {v.carrier_bic && (
                          <>
                            {' · '}
                            <Mono>{v.carrier_bic}</Mono>
                          </>
                        )}
                      </p>
                    )}
                    <p className="text-[12px] text-ink-dim">{t.known.directBillingHint}</p>
                  </div>
                )}
              </div>

              <form action={poolVehicleAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="vehicle_id" value={v.vehicle_id} />
                <input type="hidden" name="add" value={v.in_pool ? '0' : '1'} />
                <Button type="submit" size="sm" variant={v.in_pool ? 'ghost' : 'default'}>
                  {v.in_pool ? t.known.removePool : t.known.addPool}
                </Button>
              </form>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}
