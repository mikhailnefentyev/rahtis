import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MATCHING } from '@/lib/config';
import { UiKitShowcase } from './showcase';

export const metadata: Metadata = { title: 'UI Kit' };

/**
 * Витрина всегда свежая: демонстрационные дедлайны считаются от момента
 * запроса. Будь страница статической, отсчёты «протухли» бы в момент
 * сборки и всегда показывали «время вышло».
 */
export const dynamic = 'force-dynamic';

export default function UiKitPage() {
  /*
   * В бою витрины нет.
   *
   * Это инструмент разработки: подписи разделов написаны по-русски, как и
   * комментарии в коде, и переводить их незачем — их читает тот, кто
   * платформу строит. Но на живом сайте, где интерфейс финский и
   * английский, чужой язык во внутреннем разделе выглядит недоделкой, а
   * сам раздел открыт кому угодно по прямому адресу.
   *
   * Проверка в теле страницы, а не в конфиге сборки: маршрут остаётся
   * одним и тем же файлом, и в разработке витрина открывается без
   * оговорок.
   */
  if (process.env.NODE_ENV === 'production') notFound();

  return <UiKitShowcase deadlines={demoDeadlines()} />;
}

/**
 * Часы читаются здесь, а не в теле компонента: рендер обязан быть чистым,
 * и Date.now() внутри него дал бы разные результаты при каждом повторе.
 * Страница серверная и force-dynamic, поэтому функция отработает один раз
 * на запрос — ровно так же, как в бою, где дедлайн приедет из deadline_at.
 */
function demoDeadlines() {
  const minute = 60 * 1000;
  const now = Date.now();

  return {
    /** Обычный ход: только опубликованный заказ ждёт решения. */
    normal: new Date(now + (MATCHING.decisionTimeoutMinutes - 3) * minute).toISOString(),
    /** Меньше пяти минут — отсчёт становится красным. */
    urgent: new Date(now + 95 * 1000).toISOString(),
    /** Дедлайн уже прошёл: планировщик вот-вот вернёт заказ на стол. */
    expired: new Date(now - minute).toISOString(),
  };
}
