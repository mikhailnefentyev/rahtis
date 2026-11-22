import { NewListingScreen, newListingMetadata } from '../NewListingScreen';

/* Кабинет перевозчика. Сам экран общий с кабинетом компании без парка (23.11.2026) — carrier/installments/NewListingScreen.tsx. */
export function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return newListingMetadata(props);
}

export default function NewListingPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vehicle?: string }>;
}) {
  return <NewListingScreen {...props} role="CARRIER" />;
}
