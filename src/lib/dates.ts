import { APP } from './config';

/**
 * Сколько дней осталось до даты. Отрицательное значение — просрочено.
 *
 * Считается на сервере и передаётся в компоненты готовым числом. Причин
 * две. Рендер обязан быть чистым, а Date.now() внутри него даёт разные
 * результаты при каждом повторе. И часы клиента могут расходиться с
 * серверными: у пользователя с отставшими часами страховка «ещё
 * действует», хотя база уже считает иначе.
 *
 * Сравниваются календарные дни в часовом поясе операций, а не моменты
 * времени: документ действует до конца своего последнего дня.
 */
export function daysUntil(date: string | Date): number {
  const target = startOfDayInOperations(new Date(date));
  const today = startOfDayInOperations(new Date());

  return Math.round((target - today) / 86_400_000);
}

function startOfDayInOperations(value: Date): number {
  /* en-CA даёт ISO-подобный формат ГГГГ-ММ-ДД без разбора частей вручную. */
  const day = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: APP.timeZone,
  }).format(value);

  return Date.parse(`${day}T00:00:00Z`);
}

/**
 * Понедельник недели, отстоящей на столько-то недель назад, по Хельсинки.
 *
 * Нужен окну выполненных рейсов: кабинет держит последние недели, а всё,
 * что раньше, достаётся отчётами периода и через агента. Без окна список
 * растёт вместе с оборотом компании и однажды перестаёт открываться —
 * тридцать рейсов в день это семь тысяч в год в одном ответе.
 *
 * Хельсинки, а не UTC: та же неделя, по которой считает app.report_week
 * в базе. Сравниваются они между собой, и часовой пояс у них обязан
 * совпадать.
 */
export function weeksAgoMonday(weeks: number, now: Date = new Date()): string {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(now);
  const d = new Date(`${local}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - weeks * 7);
  return d.toISOString().slice(0, 10);
}
