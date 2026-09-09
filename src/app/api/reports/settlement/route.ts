import { generatePeriodSettlement } from '@/lib/reports/generate';

/**
 * Выпуск документов расчётного периода.
 *
 * Отдельный маршрут рядом с недельным, а не флаг у него: у задания
 * планировщика своё расписание — первое и шестнадцатое число, — и общий
 * адрес с ветвлением по телу запроса означал бы, что ошибка в теле
 * выпустит не тот документ молча.
 *
 * Защита тем же общим секретом, что у недельных отчётов: это одно и то
 * же право — выпустить платёжные документы, — и разводить его на два
 * секрета значило бы завести второй, который однажды забудут повернуть.
 *
 * Момент задаётся явно только для повторного выпуска и проверки: по
 * умолчанию берётся вчерашний день, то есть последний день только что
 * закрывшегося периода.
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

  const url = new URL(request.url);
  const moment = url.searchParams.get('moment') ?? undefined;

  const result = await generatePeriodSettlement(moment);

  return Response.json(result, { status: result.errors.length > 0 ? 207 : 200 });
}
