import { notFound } from 'next/navigation';
import { getDriver } from '@/lib/driverApp/session';
import { isLocale } from '@/lib/i18n';
import { getDriverI18n } from '@/lib/driverApp/i18n';
import { createClient } from '@/lib/supabase/server';
import { SiteScreen, type SiteState } from './SiteScreen';

/**
 * Kohde — работа на объекте: прибытие, рейсы с весами, конец дня.
 *
 * Состояние отдаёт одна функция базы (driver_site_state): объекты
 * компании, сегодняшний день водителя с рейсами, его машина и прицепы
 * для предела массы, весы и пункты приёмки.
 */
export default async function DriverSite({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [driver, { t }] = await Promise.all([getDriver(), getDriverI18n(locale)]);
  if (!driver) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc('driver_site_state');
  const state = data as unknown as SiteState | null;

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <h1 className="text-xl font-bold tracking-tight">{t.siteWork.title}</h1>
      {state ? <SiteScreen state={state} /> : <p className="text-[15px] text-ink-muted">{t.siteWork.noJobs}</p>}
    </main>
  );
}
