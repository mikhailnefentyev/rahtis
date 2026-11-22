import { InstallmentsScreen, installmentsMetadata } from '../../carrier/installments/IndexScreen';

/*
 * Раздел «Продажа техники в рассрочку» в кабинете компании без парка
 * (решение 23.11.2026: продавать может любая проверенная финская компания).
 * Экран общий с кабинетом перевозчика — carrier/installments/IndexScreen.tsx.
 */
export function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return installmentsMetadata(props);
}

export default function InstallmentsPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  return <InstallmentsScreen {...props} role="SHIPPER" />;
}
