import { GET as carrierGet } from '../../../../carrier/installments/[id]/notice/route';

/*
 * Письмо о шаге после порога просрочки — тот же обработчик, что в кабинете
 * перевозчика (24.11.2026): доступ проверяется по сделке, а не по виду
 * компании. Свой адрес нужен продавцу без парка.
 */
export async function GET(request: Request, context: { params: Promise<{ locale: string; id: string }> }) {
  return carrierGet(request, context);
}
