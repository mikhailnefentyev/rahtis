import { InstallmentsScreen, installmentsMetadata } from './IndexScreen';

/* Кабинет перевозчика. Сам экран общий с кабинетом компании без парка (23.11.2026) — carrier/installments/IndexScreen.tsx. */
export function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return installmentsMetadata(props);
}

export default function InstallmentsPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  return <InstallmentsScreen {...props} role="CARRIER" />;
}
