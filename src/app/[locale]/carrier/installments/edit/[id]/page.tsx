import { EditListingScreen, editListingMetadata } from '../../EditListingScreen';

/* Кабинет перевозчика. Сам экран общий с кабинетом компании без парка (23.11.2026) — carrier/installments/EditListingScreen.tsx. */
export function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return editListingMetadata(props);
}

export default function EditListingPage(props: { params: Promise<{ locale: string; id: string }> }) {
  return <EditListingScreen {...props} role="CARRIER" />;
}
