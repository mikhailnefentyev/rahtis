import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDriver } from '@/lib/driverApp/session';
import { getDriverI18n } from '@/lib/driverApp/i18n';
import { isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { DefectScreen, type DefectState } from './DefectScreen';

/**
 * Vika / huolto — водитель сообщает о дефекте машины или прицепа (с
 * фото, без связи — через очередь телефона) и видит ближайшие сроки
 * обслуживания своей машины: katsastus, ТО, тахограф.
 *
 * Как DVIR у Samsara и Motive: дефект сразу у перевозчика, «ехать
 * нельзя» — отдельной отметкой.
 */
export default async function DriverDefect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [driver, { t }] = await Promise.all([getDriver(), getDriverI18n(locale)]);
  if (!driver) return null;

  const supabase = await createClient();
  const [{ data }, { data: out }] = await Promise.all([
    supabase.rpc('driver_maintenance_state'),
    supabase.rpc('driver_vehicle_downtime'),
  ]);
  const state = data as unknown as DefectState | null;
  const outOfService = out as unknown as { reason: 'SERVICE' | 'DEFECT' | 'INSPECTION'; ends_on: string | null } | null;

  return (
    <main className="flex flex-col gap-4 pb-6">
      <Link href={`/${locale}/driver`} className="flex h-12 items-center text-[16px] font-semibold text-accent">
        ← {t.driverApp.back}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{t.defectDriver.title}</h1>
      {/* Машина вне работы — водитель видит это первым и не едет; снять может только перевозчик. */}
      {outOfService && (
        <p className="rounded-card border border-danger/40 bg-danger/10 px-4 py-3 text-[15px] font-semibold text-danger">
          {t.defectDriver.outOfService[outOfService.reason]}
        </p>
      )}
      {state && (state.vehicle || state.trailers.length > 0) ? (
        <DefectScreen state={state} />
      ) : (
        <p className="text-[15px] text-ink-muted">{t.defectDriver.noVehicle}</p>
      )}
    </main>
  );
}
