import { EditListingScreen, editListingMetadata } from '../../../../carrier/installments/EditListingScreen';

/*
 * Раздел «Продажа техники в рассрочку» в кабинете компании без парка
 * (решение 23.11.2026: продавать может любая проверенная финская компания).
 * Экран общий с кабинетом перевозчика — carrier/installments/EditListingScreen.tsx.
 */
export function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return editListingMetadata(props);
}

export default function EditListingPage(props: { params: Promise<{ locale: string; id: string }> }) {
  return <EditListingScreen {...props} role="SHIPPER" />;
}
