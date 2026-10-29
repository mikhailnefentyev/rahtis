/**
 * Суммы из формы: «12 500,50», «12500.5 €» → центы; пусто — null;
 * не число — undefined. Без зависимостей: модуль читают тесты.
 */
export function eurosToCents(value: string): number | null | undefined {
  const s = value.replace(/[\s\u00a0€]/g, '').replace(',', '.');
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  return Math.round(Number(s) * 100);
}

/** Центы → строка для поля формы: 1250050 → «12500.50», null → «». */
export function centsToInput(cents: number | null | undefined): string {
  return cents == null ? '' : (cents / 100).toFixed(2).replace(/\.00$/, '');
}
