import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDriver } from '@/lib/driverApp/session';
import { getDriverI18n } from '@/lib/driverApp/i18n';
import { isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { FuelScreen, type FuelState } from './FuelScreen';

/**
 * Tankkaus — заправка водителя: одометр, литры или кг, AdBlue, сумма,
 * фото чека. Как в LogiApp: внёс у колонки — у перевозчика сразу расход.
 *
 * Состояние отдаёт база (driver_fuel_state): машина водителя, последний
 * известный одометр по ней и десять последних заправок.
 */
export default async function DriverFuel({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [driver, { t }] = await Promise.all([getDriver(), getDriverI18n(locale)]);
  if (!driver) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc('driver_fuel_state');
  const state = data as unknown as FuelState | null;

  return (
    <main className="flex flex-col gap-4 pb-6">
      {/* Назад — как на экране рейса: вложенные экраны «Заданий» выглядят одинаково. */}
      <Link href={`/${locale}/driver`} className="flex h-12 items-center text-[16px] font-semibold text-accent">
        ← {t.driverApp.back}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{t.fuelDriver.title}</h1>
      {state?.vehicle ? (
        <FuelScreen state={state} />
      ) : (
        <p className="text-[15px] text-ink-muted">{t.fuelDriver.noVehicle}</p>
      )}
    </main>
  );
}
