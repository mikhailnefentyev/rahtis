import { DealScreen, dealMetadata } from '../DealScreen';

/* Кабинет перевозчика. Сам экран общий с кабинетом компании без парка (23.11.2026) — carrier/installments/DealScreen.tsx. */
export function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return dealMetadata(props);
}

export default function DealPage(props: { params: Promise<{ locale: string; id: string }> }) {
  return <DealScreen {...props} role="CARRIER" />;
}
