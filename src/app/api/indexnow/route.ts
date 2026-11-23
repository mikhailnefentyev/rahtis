import { bearerMatches } from '@/lib/auth/bearer';
import { submitRecent } from '@/lib/indexnow';

/**
 * Ежедневная отправка изменившихся страниц в IndexNow (24.11.2026).
 *
 * Зовёт база раз в день (app.run_indexnow через pg_net), защита — общий
 * секрет планировщика REPORTS_CRON_SECRET, как у остальных заданий. Нет
 * переменной — маршрут закрыт.
 */
export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();
  if (!expected) return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  if (!bearerMatches(request.headers.get('authorization'), expected)) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }
  try {
    /* Три дня с запасом: пропущенный запуск не теряет страницы, повтор адреса IndexNow не штрафует. */
    const result = await submitRecent(3);
    return Response.json(result, { status: result.status === null || (result.status >= 200 && result.status < 300) ? 200 : 207 });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : 'failed' }, { status: 502 });
  }
}
