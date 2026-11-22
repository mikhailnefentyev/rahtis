/**
 * Сумма из формы в центы (22.11.2026).
 *
 * Прежний разбор менял первую запятую на точку и читал `parseFloat`:
 * «1.200» выходило 1,20, «1.200,50» — тоже 1,20. Немецкий или румынский
 * заказчик, написавший тысячу двести по-своему, публиковал заказ за 1,20.
 *
 * Правила:
 *   · знак и название валюты, пробелы и апострофы отбрасываются: «480 €»,
 *     «1 200 zł», «5000 kr», «1'200»;
 *   · есть и точка, и запятая — та, что правее, отделяет дробь, другая —
 *     тысячи (строго по три цифры): «1.200,50» и «1,200.50» — 1200,50;
 *   · один разделитель и после него одна-две цифры — дробь: «1200,50»,
 *     «0,5»;
 *   · один разделитель и после него ровно три цифры («1.200», «1,200») —
 *     не угадываем: это и тысяча двести, и одна целая две десятых. null —
 *     форма покажет обычную ошибку суммы;
 *   · несколько одинаковых разделителей по три цифры — тысячи: «1.200.000».
 *
 * null — не сумма или не больше нуля. Без импортов из приложения: модуль
 * читают сервер и тесты.
 */
export function parseMoneyCents(raw: unknown): number | null {
  const text = String(raw ?? '');
  /* Минус перед числом — отрицательная сумма; «1200,-» в конце — немецкая запись целого числа. */
  if (/^[^\d]*[-−–]\s*\d/.test(text)) return null;
  /* «1200-1500» — вилка, а не сумма: цифры склеились бы в двенадцать миллионов. */
  if (/\d\s*[-−–]\s*\d/.test(text)) return null;
  const s = text.replace(/[^\d.,]/g, '').replace(/[.,]+$/, '');
  if (!/^\d/.test(s)) return null;

  const dots = s.split('.').length - 1;
  const commas = s.split(',').length - 1;
  let whole: string;
  let fraction = '';

  if (dots > 0 && commas > 0) {
    const decimal = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    const [head, tail, ...rest] = s.split(decimal);
    if (rest.length > 0 || !/^\d{1,2}$/.test(tail) || !grouped(head, thousands)) return null;
    whole = head.split(thousands).join('');
    fraction = tail;
  } else if (dots + commas === 1) {
    const [head, tail] = s.split(/[.,]/);
    if (!/^\d{1,2}$/.test(tail)) return null;
    whole = head;
    fraction = tail;
  } else if (dots + commas > 1) {
    const separator = dots > 0 ? '.' : ',';
    if (!grouped(s, separator)) return null;
    whole = s.split(separator).join('');
  } else {
    whole = s;
  }

  if (!/^\d{1,9}$/.test(whole)) return null;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0') || '0');
  return cents > 0 ? cents : null;
}

/** «1.200.000»: первая группа 1–3 цифры, дальше строго по три. */
function grouped(value: string, separator: string): boolean {
  const parts = value.split(separator);
  return /^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((part) => /^\d{3}$/.test(part));
}
