import { activeTrips, readPhone } from '@/lib/driver/calls';
import { gateResponse, openGate } from '@/lib/driver/gate';

/**
 * Что у водителя в работе.
 *
 * POST, хотя запрос читающий. Телефон в строке адреса оседал бы в логах
 * доступа, у прокси и в истории браузера — а это персональные данные
 * человека, который нас об этом не просил. Тело вдобавок подписывается
 * целиком, чего со строкой запроса не сделать.
 *
 * Рейс определяется по телефону внутри функции базы. Номера заказа этот
 * эндпоинт не принимает вовсе: подставить чужой рейс некуда.
 */
export const dynamic = 'force-dynamic';

const PATH = '/api/driver/context';

export async function POST(request: Request) {
  const gate = await openGate(request, PATH);
  if (!gate.ok) return gateResponse(gate);

  const phone = readPhone(gate.body);
  if (!phone) return Response.json({ error: 'phone is required' }, { status: 400 });

  const { data, failure } = await activeTrips(phone);
  if (failure) return Response.json({ error: failure.code, detail: failure.message }, { status: failure.status });

  const trips = Array.isArray(data) ? data : [];

  /* Пусто — это не ошибка: водитель может спросить в выходной. */
  return Response.json({ trips, count: trips.length });
}
