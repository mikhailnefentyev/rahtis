import Link from 'next/link';
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
export default async function DriverSite({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ job?: string; order?: string }>;
}) {
  const [{ locale }, { job, order }] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const [driver, { t }] = await Promise.all([getDriver(), getDriverI18n(locale)]);
  if (!driver) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc('driver_site_state');
  const all = data as unknown as SiteState | null;
  /* Из «Заданий» открыт один объект — показываем его; без выбора — все. */
  const picked = all?.jobs.filter((j) => (order ? j.order_id === order : j.id === job)) ?? [];
  const state = all && picked.length > 0 ? { ...all, jobs: picked } : all;

  return (
    <main className="flex flex-col gap-4 pb-6">
      {/* Назад — как на экране рейса: вложенные экраны «Заданий» выглядят одинаково. */}
      <Link href={`/${locale}/driver`} className="flex h-12 items-center text-[16px] font-semibold text-accent">
        ← {t.driverApp.back}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{t.siteWork.title}</h1>
      {state ? <SiteScreen state={state} /> : <p className="text-[15px] text-ink-muted">{t.siteWork.noJobs}</p>}
    </main>
  );
}
