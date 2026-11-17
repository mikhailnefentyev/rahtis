import { bearerMatches } from '@/lib/auth/bearer';
import { generateMonthlyFees } from '@/lib/reports/generate';

/**
 * Месячный счёт Aivomaa за подписку (с 17.11.2026).
 *
 * Адрес исторический: прежде здесь выпускались документы расчётного
 * периода «полмесяца» старой схемы, где Aivomaa была стороной перевозки.
 * Адрес записан в app.runtime_config (settlement_url), и задание
 * планировщика rahtis-monthly-fees зовёт его 1-го числа. Документы
 * старой схемы оператор выпускает вручную из пульта.
 *
 * Защита тем же общим секретом, что у недельных отчётов.
 *
 * ?month=YYYY-MM-01 — повторный выпуск за конкретный месяц; по умолчанию
 * прошлый месяц по Хельсинки.
 */
export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();

  if (!expected) {
    /* Ответ читает планировщик, а не человек, поэтому по-английски. */
    return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  }

  if (!bearerMatches(request.headers.get('authorization'), expected)) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get('month') ?? undefined;

  const result = await generateMonthlyFees(month);

  return Response.json(result, { status: result.errors.length > 0 ? 207 : 200 });
}
