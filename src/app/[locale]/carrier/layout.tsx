import { notFound } from 'next/navigation';
import { CabinetShell } from '@/components/layout/CabinetShell';
import { FlashNotice } from '@/components/layout/FlashNotice';
import { requireRole } from '@/lib/auth/guard';
import { isLocale } from '@/lib/i18n';
import { TimeZoneProvider } from '@/lib/i18n/provider';
import { stopTimeZone } from '@/lib/country';

/**
 * Гейт кабинета. requireRole уводит гостя на вход, пользователя без
 * профиля и отклонённую компанию — на страницу-тупик, а чужую роль —
 * в её собственный кабинет.
 */
export default async function CarrierLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');

  return (
    /* Время в кабинете — по стране компании (src/lib/i18n/viewer). */
    <TimeZoneProvider zone={stopTimeZone(viewer.company?.country)} country={viewer.company?.country ?? null}>
      <CabinetShell locale={locale} role="CARRIER" company={viewer.company}>
        <FlashNotice />
        {children}
      </CabinetShell>
    </TimeZoneProvider>
  );
}
