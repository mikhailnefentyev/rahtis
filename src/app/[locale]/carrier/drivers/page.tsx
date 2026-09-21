import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { DriversView, type DriverRow } from './DriversView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.drivers.title };
}

export default async function DriversPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;

  const [{ t }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const [{ data: drivers }, { data: vehicles }, { data: assignments }, { data: profiles }] =
    await Promise.all([
      supabase.from('drivers').select('*').eq('company_id', company.id).order('full_name'),
      supabase
        .from('vehicles')
        .select('id, plate')
        .eq('company_id', company.id)
        .order('plate'),
      supabase.from('vehicle_drivers').select('vehicle_id, driver_id, during'),
      supabase.from('driver_pay_profiles').select('driver_id, model, valid_from'),
    ]);

  /* Открытый интервал — у диапазона без верхней границы текст кончается на «,)». */
  const vehicleByDriver = new Map<string, string>();
  for (const row of assignments ?? []) {
    if (String(row.during).endsWith(',)')) vehicleByDriver.set(row.driver_id, row.vehicle_id);
  }

  /*
   * Модель оплаты на сегодня — последняя по дате начала среди уже
   * вступивших. Будущая ставка, внесённая заранее, сегодняшнюю не
   * подменяет.
   */
  const today = new Date().toISOString().slice(0, 10);
  const modelByDriver = new Map<string, { model: string; validFrom: string }>();
  for (const p of profiles ?? []) {
    if (p.valid_from > today) continue;
    const current = modelByDriver.get(p.driver_id);
    if (!current || p.valid_from > current.validFrom) {
      modelByDriver.set(p.driver_id, { model: p.model, validFrom: p.valid_from });
    }
  }

  const rows: DriverRow[] = (drivers ?? []).map((d) => ({
    driver: d,
    vehicleId: vehicleByDriver.get(d.id) ?? null,
    payModel: (modelByDriver.get(d.id)?.model as DriverRow['payModel']) ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t.drivers.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${locale}/carrier/drivers/report`}
            className={buttonClass({ variant: 'default', size: 'sm' })}
          >
            {t.drivers.report}
          </Link>
          <Link
            href={`/${locale}/carrier/drivers/tes`}
            className={buttonClass({ variant: 'default', size: 'sm' })}
          >
            {t.drivers.tes}
          </Link>
        </div>
      </div>
      <p className="mt-2 mb-6 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {t.drivers.subtitle}
      </p>

      <DriversView rows={rows} vehicles={vehicles ?? []} />
    </main>
  );
}
