/**
 * Ячейки CSV для всех выгрузок (водители, отчёт за период, топливо).
 *
 * В текст попадает то, что вводят люди и что распознаёт модель: имена,
 * станции, адреса, номера заказов. Поэтому:
 *  · текст, который после пробелов и служебных знаков начинается с «=»,
 *    «+», «-», «@» (или их широких вариантов), получает апостроф — иначе
 *    Excel выполнил бы его как формулу;
 *  · каждая ячейка в кавычках: Excel с английскими настройками делит
 *    строку по запятым, а не по «;», и «Neste, =…» без кавычек распалось
 *    бы на ячейку, начинающуюся с формулы.
 *
 * Числа — тоже в кавычках, но без апострофа: отрицательная сумма должна
 * остаться числом. Их пишет сам код, а не человек.
 *
 * Дробная часть числа — через запятую для всех языков кабинета, кроме
 * английского (решение пользователя 22.11.2026): финский, шведский,
 * немецкий и остальные Excel читают «25.5» как дату, а «480.00» как
 * текст. Разделитель ячеек «;» и BOM — прежние. Все числа выгрузок
 * пишутся через csvDecimal.
 *
 * Без зависимостей: модуль читают тесты (node --test).
 */

const FORMULA = /^[\s\u0000-\u001f]*[=+\-@＝＋－＠]/;

const quote = (value: string): string => `"${value.replace(/"/g, '""')}"`;

/** Текст: защита от формул и кавычки. Пусто — пустая ячейка в кавычках. */
export function csvText(value: string | number | null | undefined): string {
  if (value == null) return '""';
  const text = String(value);
  return quote(FORMULA.test(text) ? `'${text}` : text);
}

/** Число, уже приведённое к строке кодом (toFixed и т. п.): только кавычки. */
export function csvNumber(value: string | number | null | undefined): string {
  if (value == null || value === '') return '""';
  return quote(String(value));
}

/**
 * Число для CSV на языке читателя: дробная часть через запятую везде,
 * кроме английского ('en'); без разделителя тысяч. decimals — сколько
 * знаков после запятой держать (как toFixed); не задано — число как есть
 * (целое остаётся целым). Пусто или не число — пустая ячейка.
 */
export function csvDecimal(value: number | string | null | undefined, locale: string, decimals?: number): string {
  if (value == null || value === '') return '""';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '""';
  const text = decimals == null ? String(n) : n.toFixed(decimals);
  return quote(locale === 'en' ? text : text.replace('.', ','));
}

/** Файл: BOM для Excel и CRLF, как ждут учётные системы. */
export function csvFile(lines: string[][]): string {
  return `﻿${lines.map((cells) => cells.join(';')).join('\r\n')}\r\n`;
}
