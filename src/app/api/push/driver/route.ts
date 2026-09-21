import { sendDriverPush } from '@/lib/driverApp/push';

/**
 * Отправить push по новой строке входящих водителя.
 *
 * Зовёт база (триггер driver_notifications_push через pg_net), а не
 * браузер. Защита — общий секрет планировщика REPORTS_CRON_SECRET: тот
 * же, которым база уже вызывает выпуск отчётов, поэтому новой настройки
 * не нужно. Нет переменной — маршрут закрыт, а не открыт всем.
 *
 * Под /api, поэтому proxy его не трогает и язык к адресу не приписывает.
 */
export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();

  if (!expected) {
    /* Ответ читает база, а не человек, поэтому по-английски. */
    return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  }

  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: 'id is required' }, { status: 400 });
  }

  return Response.json(await sendDriverPush(id));
}
