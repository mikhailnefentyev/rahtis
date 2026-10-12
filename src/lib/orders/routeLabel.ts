/**
 * Короткая подпись маршрута для списков и писем.
 *
 * Обычно это «откуда → куда». У перецепа с возвратом туда же первая и
 * последняя точки совпадают, и «Helsinki → Helsinki» не говорит ничего —
 * тогда в середину встаёт первая отличная от них точка.
 */
export function routeLabel(labels: string[], arrow = '→'): string {
  const list = labels.filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];

  const first = list[0];
  const last = list[list.length - 1];
  if (first !== last) return `${first} ${arrow} ${last}`;

  const middle = list.slice(1, -1).find((label) => label !== first);
  return middle ? `${first} ${arrow} ${middle} ${arrow} ${last}` : `${first} ${arrow} ${last}`;
}
