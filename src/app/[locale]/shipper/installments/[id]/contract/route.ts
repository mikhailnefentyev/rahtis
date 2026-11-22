import { GET as carrierGet } from '../../../../carrier/installments/[id]/contract/route';

/*
 * Договор рассрочки в PDF — тот же обработчик, что в кабинете перевозчика: доступ там
 * проверяется по сделке (её видят только стороны), а не по виду компании.
 * Свой адрес нужен продавцу без парка (23.11.2026): ссылки на странице
 * сделки строятся от его кабинета.
 */
export async function GET(request: Request, context: { params: Promise<{ locale: string; id: string }> }) {
  return carrierGet(request, context);
}
