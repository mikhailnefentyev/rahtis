import { NewListingScreen, newListingMetadata } from '../../../carrier/installments/NewListingScreen';

/*
 * Раздел «Продажа техники в рассрочку» в кабинете компании без парка
 * (решение 23.11.2026: продавать может любая проверенная финская компания).
 * Экран общий с кабинетом перевозчика — carrier/installments/NewListingScreen.tsx.
 */
export function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return newListingMetadata(props);
}

export default function NewListingPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vehicle?: string }>;
}) {
  return <NewListingScreen {...props} role="SHIPPER" />;
}
