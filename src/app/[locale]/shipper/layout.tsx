import { notFound } from 'next/navigation';
import { CabinetHeader } from '@/components/layout/CabinetHeader';
import { requireRole } from '@/lib/auth/guard';
import { isLocale } from '@/lib/i18n';

/**
 * Гейт кабинета. requireRole уводит гостя на вход, пользователя без
 * профиля и отклонённую компанию — на страницу-тупик, а чужую роль —
 * в её собственный кабинет.
 */
export default async function ShipperLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'SHIPPER');

  return (
    <>
      <CabinetHeader locale={locale} role="SHIPPER" company={viewer.company} />
      {children}
    </>
  );
}
