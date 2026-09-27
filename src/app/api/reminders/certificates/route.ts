import { sendCertificateReminders } from '@/lib/drivers/reminders';

/**
 * Напоминания о сроках удостоверений водителей.
 *
 * Зовёт база раз в день (app.run_certificate_reminders через pg_net), а
 * не браузер. Защита — тот же общий секрет планировщика, что у отчётов и
 * push: REPORTS_CRON_SECRET. Нет переменной — маршрут закрыт, а не
 * открыт всем.
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

  const result = await sendCertificateReminders();
  return Response.json(result, { status: result.errors.length > 0 ? 207 : 200 });
}
