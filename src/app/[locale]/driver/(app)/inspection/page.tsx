import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDriver } from '@/lib/driverApp/session';
import { getDriverI18n } from '@/lib/driverApp/i18n';
import { isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { InspectionScreen, type InspectionState } from './InspectionScreen';

/**
 * Lähtötarkastus — осмотр машины перед выездом: девять пунктов обхода,
 * пробег, неисправности сразу дефектами у перевозчика. Без связи — через
 * очередь телефона, как заправка и дефект.
 */
export default async function DriverInspection({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [driver, { t }] = await Promise.all([getDriver(), getDriverI18n(locale)]);
  if (!driver) return null;

  const supabase = await createClient();
  const [{ data }, { data: out }] = await Promise.all([supabase.rpc('driver_inspection_state'), supabase.rpc('driver_vehicle_downtime')]);
  const state = data as unknown as InspectionState | null;
  const outOfService = out as unknown as { reason: 'SERVICE' | 'DEFECT' | 'INSPECTION' } | null;
  const s = t.defectDriver.inspection;

  return (
    <main className="flex flex-col gap-4 pb-6">
      <Link href={`/${locale}/driver`} className="flex h-12 items-center text-[16px] font-semibold text-accent">
        ← {t.driverApp.back}
      </Link>
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
        {state?.vehicle && <span className="font-mono text-[17px] font-bold tracking-tight">{state.vehicle.plate}</span>}
      </header>
      {outOfService && (
        <p className="rounded-card border border-danger/40 bg-danger/10 px-4 py-3 text-[15px] font-semibold text-danger">
          {t.defectDriver.outOfService[outOfService.reason]}
        </p>
      )}
      {state?.vehicle ? <InspectionScreen state={state} /> : <p className="text-[15px] text-ink-muted">{s.noVehicle}</p>}
    </main>
  );
}
