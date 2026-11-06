import { bearerMatches } from '@/lib/auth/bearer';
import { purgeExpiredFuel, purgeExpiredTripPhotos } from '@/lib/retention/photos';
import { purgeOldSignInDevices } from '@/lib/retention/signIns';

/**
 * Удаление фото рейсов, заправок и отчётов топлива старше срока хранения.
 *
 * Зовёт база раз в день (app.run_photo_retention через pg_net), а не
 * браузер. Защита — общий секрет планировщика REPORTS_CRON_SECRET, как у
 * отчётов и напоминаний. Нет переменной — маршрут закрыт, а не открыт.
 *
 * Под /api, поэтому proxy его не трогает и язык к адресу не приписывает.
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

  const result = await purgeExpiredTripPhotos();
  /* Заправки и отчёты топлива — тем же запуском: тоже файлы в хранилище и тоже 24 месяца. */
  const fuel = await purgeExpiredFuel();
  /* Устройства входа старше 12 месяцев — тем же ежедневным запуском (6.11.2026). */
  const signIns = await purgeOldSignInDevices();
  const failed = result.errors.length > 0 || fuel.errors.length > 0 || signIns.errors.length > 0;
  return Response.json({ ...result, fuel, signIns }, { status: failed ? 207 : 200 });
}
