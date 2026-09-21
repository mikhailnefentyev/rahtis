import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { driverSignOutAction } from '@/lib/driverApp/actions';
import { getDriver } from '@/lib/driverApp/session';
import { getI18n, isLocale } from '@/lib/i18n';

/**
 * Профиль водителя: кто он, чей, на какой машине, язык, установка и выход.
 *
 * Править здесь нечего: имя, телефон и машину ведёт перевозчик. Водитель
 * видит, что о нём записано, — и знает, к кому идти, если это неверно.
 */
export default async function DriverProfile({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [driver, { t }] = await Promise.all([getDriver(), getI18n(locale)]);
  if (!driver) return null;

  const rows: Array<[string, string]> = [
    [t.driverApp.phone, driver.phone],
    [t.driverApp.company, driver.company_name],
    [t.driverApp.vehicle, driver.plate ?? t.driverApp.noVehicle],
  ];

  return (
    <main className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{driver.full_name}</h1>
      </header>

      <dl className="divide-y divide-line rounded-card border border-line bg-surface">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-4 py-3.5">
            <dt className="text-[15px] text-ink-muted">{label}</dt>
            <dd className="text-[16px] font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3.5">
        <span className="text-[15px] text-ink-muted">{t.driverApp.language}</span>
        <LocaleSwitch current={locale} />
      </section>

      {/*
        * Установка на экран «Домой» — часть первого входа, а не совет в
        * подвале: на iPhone без неё не будет push-уведомлений.
        */}
      <section className="rounded-card border border-line bg-surface px-4 py-3.5">
        <p className="text-[16px] font-semibold">{t.driverApp.install}</p>
        <p className="mt-1 text-[15px] text-ink-muted">{t.driverApp.installIos}</p>
        <p className="text-[15px] text-ink-muted">{t.driverApp.installAndroid}</p>
      </section>

      <Link href={`/${locale}/tietosuoja`} className="px-1 text-[15px] text-accent underline">
        {t.driverApp.privacy}
      </Link>

      <form action={driverSignOutAction}>
        <input type="hidden" name="locale" value={locale} />
        <button className="h-14 w-full rounded-control border border-line bg-surface text-[16px] font-semibold text-danger">
          {t.driverApp.signOut}
        </button>
      </form>
    </main>
  );
}
