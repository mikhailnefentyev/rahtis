import { bearerMatches } from '@/lib/auth/bearer';
import { sendCertificateReminders } from '@/lib/drivers/reminders';
import { sendVerificationReminders } from '@/lib/verification/reminders';

/**
 * Напоминания о сроках удостоверений водителей.
 *
 * Зовёт база раз в день (app.run_certificate_reminders через pg_net), а
 * не браузер. Защита — тот же общий секрет планировщика, что у отчётов и
 * push: REPORTS_CRON_SECRET. Нет переменной — маршрут закрыт, а не
 * открыт всем.
 *
 * Под /api, поэтому proxy его не трогает и язык к адресу не приписывает.
 *
 * Тем же запуском — напоминания о сроках пакета tilaajavastuu
 * (src/lib/verification/reminders.ts): отдельное расписание в базе ради
 * одного запроса в день не нужно.
 */
export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();

  if (!expected) {
    /* Ответ читает база, а не человек, поэтому по-английски. */
    return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  }

  if (!bearerMatches(request.headers.get('authorization'), expected)) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }

  const [result, verification] = await Promise.all([sendCertificateReminders(), sendVerificationReminders()]);
  const failed = result.errors.length > 0 || verification.errors.length > 0;
  return Response.json({ ...result, verification }, { status: failed ? 207 : 200 });
}
