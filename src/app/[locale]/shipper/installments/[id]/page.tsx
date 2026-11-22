import { DealScreen, dealMetadata } from '../../../carrier/installments/DealScreen';

/*
 * Раздел «Продажа техники в рассрочку» в кабинете компании без парка
 * (решение 23.11.2026: продавать может любая проверенная финская компания).
 * Экран общий с кабинетом перевозчика — carrier/installments/DealScreen.tsx.
 */
export function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return dealMetadata(props);
}

export default function DealPage(props: { params: Promise<{ locale: string; id: string }> }) {
  return <DealScreen {...props} role="SHIPPER" />;
}
