'use server';

import { clientIp, throttleAllowed } from '@/lib/auth/throttle';
import { recordIncident } from './record';

/**
 * Запись сбоя из браузера.
 *
 * Нужна ровно для границ ошибок: они клиентские по требованию React, а
 * писать в базу может только сервер. Больше отсюда ничего не вызывается.
 *
 * Действие открыто всем, включая незалогиненных: страница может упасть и
 * до входа, и именно такие падения важнее всего. Плата за это —
 * возможность засорить журнал: адрес действия виден в бандле, и в него
 * можно долбить чем угодно.
 *
 * Защищено формой, а не проверкой. Наружу принимается только имя класса
 * ошибки и путь; текст сообщения сюда не приходит вовсе, а отпечаток
 * считает сервер по тому, что осталось. Тысяча запросов подряд поднимет
 * счётчик одной строки, а не создаст тысячу — свернуть поток по
 * отпечатку журнал умеет по построению.
 */
export async function reportRenderFailure(input: { digest?: string; path?: string; name?: string }) {
  /*
   * digest — отпечаток, который Next выдаёт вместо текста ошибки на
   * боевой сборке. Он ничего не рассказывает сам по себе, но по нему
   * строка в журнале сходится со строкой в логе хостинга, где текст есть.
   */
  const digest = typeof input.digest === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(input.digest) ? input.digest : null;

  /*
   * Действие открыто без входа: без предела и с произвольным путём каждый
   * вызов давал новую запись FATAL и держал /api/health в «degraded»
   * (22.11.2026). Предел по адресу, путь — только похожий на адрес страницы.
   */
  if (!(await throttleAllowed(`render-fail:${await clientIp()}`, { limit: 20, seconds: 600 }))) return;
  const path = typeof input.path === 'string' && /^\/[A-Za-z0-9\-._~%/()[\]]{0,199}$/.test(input.path.split('?')[0] ?? '') ? input.path : null;

  /*
   * Класс ошибки — одно слово вроде ChunkLoadError или TypeError. Без
   * него все браузерные сбои сливались в «отрисовка прервана», и понять,
   * что сломалось, было не по чему. Текст сообщения по-прежнему не берём.
   */
  const name = typeof input.name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(input.name) ? input.name : null;

  /*
   * Старая сборка после выкладки (ChunkLoadError) и обрыв сети (…Network) —
   * не поломка кода: первое лечит перезагрузка, второе — связь. Они идут
   * в журнал как WARN, а не FATAL: открытый FATAL держит /api/health в
   * «degraded», и выкладка поднимала бы тревогу (26.10.2026 —
   * ChunkLoadError на /fi/carrier/sites сразу после выкладки).
   */
  const benign = name === 'ChunkLoadError' || (name !== null && name.endsWith('Network'));

  await recordIncident({
    source: 'render',
    severity: benign ? 'WARN' : 'FATAL',
    path,
    error: Object.assign(new Error(digest ? `digest ${digest}` : 'отрисовка прервана'), {
      name: name ?? 'RenderError',
    }),
  });
}
