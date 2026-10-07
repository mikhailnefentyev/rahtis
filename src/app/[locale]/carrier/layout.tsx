import { notFound } from 'next/navigation';
import { CabinetShell } from '@/components/layout/CabinetShell';
import { requireRole } from '@/lib/auth/guard';
import { isLocale } from '@/lib/i18n';

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
    <CabinetShell locale={locale} role="CARRIER" company={viewer.company}>
      {children}
    </CabinetShell>
  );
}
