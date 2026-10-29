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

/** Файл: BOM для Excel и CRLF, как ждут учётные системы. */
export function csvFile(lines: string[][]): string {
  return `﻿${lines.map((cells) => cells.join(';')).join('\r\n')}\r\n`;
}
