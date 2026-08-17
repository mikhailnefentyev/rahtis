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
