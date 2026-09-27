/**
 * Логика практики «Löydä viat» (найди неисправности) модуля
 * «Päivittäinen tarkastus».
 *
 * На рисунке автопоезда двенадцать мест. В каждом раунде в нескольких из
 * них нарисована неисправность, в остальных всё в порядке. Водитель
 * отмечает места, где видит неисправность; итог — найденные, пропущенные
 * и ложные тревоги. Для каждой неисправности — насколько она серьёзна:
 * «stop» — ехать нельзя, «fix» — устранить при первой возможности.
 *
 * Серьёзность — учебное упрощение. ПОДТВЕРЖДАЕТ ИНСТРУКТОР.
 *
 * Модуль без импортов намеренно: тесты гоняются голым `node --test`.
 */

export const DEFECTS = [
  { id: 'tread', severity: 'stop' },
  { id: 'bulge', severity: 'stop' },
  { id: 'wheelNut', severity: 'stop' },
  { id: 'airHose', severity: 'stop' },
  { id: 'fifthWheel', severity: 'stop' },
  { id: 'oilLeak', severity: 'stop' },
  { id: 'rearLight', severity: 'fix' },
  { id: 'sideMarker', severity: 'fix' },
  { id: 'mirror', severity: 'fix' },
  { id: 'windscreen', severity: 'fix' },
  { id: 'mudflap', severity: 'fix' },
  { id: 'plate', severity: 'fix' },
] as const;

export type DefectId = (typeof DEFECTS)[number]['id'];
export type Severity = (typeof DEFECTS)[number]['severity'];

export const ROUND_DEFECTS = 4;

export function severityOf(id: DefectId): Severity {
  return DEFECTS.find((d) => d.id === id)!.severity;
}

/** Раунд: несколько неисправностей, хотя бы одна из них — «ехать нельзя». */
export function pickDefects(random: () => number = Math.random, count: number = ROUND_DEFECTS): DefectId[] {
  const ids = DEFECTS.map((d) => d.id) as DefectId[];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const round = ids.slice(0, count);
  if (!round.some((id) => severityOf(id) === 'stop')) {
    const stop = ids.find((id) => severityOf(id) === 'stop')!;
    round[round.length - 1] = stop;
  }
  return round;
}

export type InspectionScore = {
  found: DefectId[];
  missed: DefectId[];
  falseAlarms: DefectId[];
  /** Пропущена неисправность, с которой ехать нельзя. */
  missedStop: boolean;
};

export function scoreInspection(defects: readonly DefectId[], marked: readonly DefectId[]): InspectionScore {
  const isDefect = new Set(defects);
  const isMarked = new Set(marked);
  const missed = defects.filter((id) => !isMarked.has(id));
  return {
    found: defects.filter((id) => isMarked.has(id)),
    missed,
    falseAlarms: marked.filter((id) => !isDefect.has(id)),
    missedStop: missed.some((id) => severityOf(id) === 'stop'),
  };
}
