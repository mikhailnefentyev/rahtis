import { generateWeeklyReports } from '@/lib/reports/generate';

/**
 * Выпуск недельных отчётов по расписанию.
 *
 * Отдельный маршрут, а не серверное действие: звать его будет не
 * браузер, а планировщик — n8n, cron или pg_cron через net.http_post.
 * У действия нет адреса, по которому можно постучаться извне.
 *
 * Защита общим секретом, а не сессией: у планировщика её нет и быть не
 * может. Секрет сравнивается целиком; отсутствие переменной закрывает
 * маршрут наглухо, а не открывает его всем — незаполненная настройка не
 * должна означать «пускать любого».
 *
 * Под /api, поэтому proxy его не трогает и язык к адресу не приписывает.
 */
export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();

  if (!expected) {
    /* Ответ читает планировщик, а не человек, поэтому по-английски. */
    return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  }

  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }

  /* Неделя задаётся явно только для повторного выпуска и проверки. */
  const url = new URL(request.url);
  const week = url.searchParams.get('week') ?? undefined;

  const result = await generateWeeklyReports(week);

  return Response.json(result, { status: result.errors.length > 0 ? 207 : 200 });
}
