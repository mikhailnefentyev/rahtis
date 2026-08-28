import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Пульс платформы для внешнего наблюдателя.
 *
 * Проверяет не «жив ли процесс», а «делает ли платформа свою работу».
 * Живой сервер с остановившимся планировщиком отвечает 200 на любой
 * запрос и при этом не закрывает окна решений: заказы висят, перевозчики
 * ждут, узнаём мы об этом по звонку. Поэтому каждая метрика ниже —
 * следствие, а не признак жизни.
 *
 * Два уровня подробности, и это про доступ, а не про удобство. Без
 * секрета отдаётся одно слово: ok или degraded. Этого хватает пингеру и
 * не хватает тому, кто хочет узнать, сколько у платформы рейсов, — числа
 * заказов и писем говорят об обороте, и наружу они не выходят.
 *
 * Код ответа 200 даже при degraded: 503 заставил бы пингер считать сайт
 * лежащим и будить людей ночью из-за одного застрявшего письма. Что
 * именно считать поводом для тревоги, решает наблюдатель, а не мы.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.HEALTH_SECRET?.trim();
  const detailed =
    Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('platform_pulse');

  /*
   * База не ответила — это и есть худший из возможных ответов, и
   * подробности здесь не нужны никому: сказать больше нечего.
   */
  if (error || !data) {
    return Response.json({ status: 'down' }, { status: 200 });
  }

  /* Неисправность — это метрика с порогом, который она перешагнула. */
  const failing = data.filter((row) => row.threshold !== null && row.value > row.threshold);
  const status = failing.length === 0 ? 'ok' : 'degraded';

  if (!detailed) {
    return Response.json({ status });
  }

  return Response.json({
    status,
    at: new Date().toISOString(),
    failing: failing.map((row) => row.metric),
    metrics: Object.fromEntries(data.map((row) => [row.metric, row.value])),
  });
}
