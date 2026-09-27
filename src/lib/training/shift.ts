/**
 * Проверка смены в практике «Спланируй смену».
 *
 * Учебная модель, а не контроль тахографа: вождение, перерывы и другая
 * работа по 561/2006 (ст. 6, 7) в пределах одной смены одного водителя.
 * Экипаж из двух водителей, паромы, недельные и двухнедельные лимиты
 * сюда не входят — их добавляют только отдельным заданием.
 *
 * Функция возвращает коды и числа, а не фразы: текст подставляет
 * словарь на языке водителя. Лимиты — в SHIFT_RULES, а не в экранах:
 * правило поменялось — поправили одно место, тесты сказали, что сломано.
 *
 * Модуль без импортов намеренно: тесты гоняются голым `node --test`.
 */

export type ShiftBlockKind = 'drive' | 'break' | 'work';

export type ShiftBlock = { kind: ShiftBlockKind; minutes: number };

export type ShiftScenario = {
  /** Сколько нужно проехать по заданию. */
  driveMinutes: number;
  /** Сколько другой работы (погрузка, разгрузка) в задании. */
  workMinutes: number;
  /** Суточный лимит вождения в этом сценарии: 9 ч или 10 ч с продлением. */
  limitMinutes: number;
};

/** Лимиты 561/2006 в минутах. Меняет их инструктор, а не экран. */
export const SHIFT_RULES = {
  /** Ст. 7: непрерывное вождение до перерыва. */
  maxContinuousDrive: 270,
  /** Ст. 7: полный перерыв. */
  fullBreak: 45,
  /** Ст. 7: разделённый перерыв — сначала не менее 15, потом не менее 30. */
  splitFirst: 15,
  splitSecond: 30,
  /** Ст. 6(1): обычный суточный лимит вождения. */
  dailyDriving: 540,
  /** 24 ч минус регулярный ежедневный отдых 11 ч (ст. 8). */
  regularRestFits: 780,
} as const;

export type ShiftRules = typeof SHIFT_RULES;

export type ShiftFinding =
  | { level: 'error'; code: 'continuous_driving'; atMinute: number }
  | { level: 'warn'; code: 'split_first_part' }
  | { level: 'error'; code: 'drive_mismatch'; planned: number; required: number }
  | { level: 'error'; code: 'daily_limit'; limit: number }
  | { level: 'warn'; code: 'extension_used' }
  | { level: 'error'; code: 'work_mismatch'; planned: number; required: number }
  | { level: 'warn'; code: 'long_shift'; total: number }
  | { level: 'ok'; code: 'ok'; total: number }
  | { level: 'error'; code: 'empty' };

/** Отрезок полосы смены: подряд идущие блоки одного вида слиты. */
export type ShiftSegment = ShiftBlock & {
  /** Вождение без положенного перерыва — красим красным. */
  over: boolean;
};

export type ShiftTotals = { drive: number; work: number; rest: number; total: number };

/**
 * Два перерыва подряд — это один перерыв: 15 + 15 минут без вождения
 * между ними водитель и отдыхал 30 минут.
 */
function merge(blocks: readonly ShiftBlock[]): ShiftBlock[] {
  const out: ShiftBlock[] = [];
  for (const block of blocks) {
    if (!(block.minutes > 0)) continue;
    const last = out[out.length - 1];
    if (last && last.kind === block.kind) last.minutes += block.minutes;
    else out.push({ kind: block.kind, minutes: block.minutes });
  }
  return out;
}

/**
 * Проход по смене: счётчик непрерывного вождения и состояние
 * разделённого перерыва. Одна функция и для полосы, и для проверки —
 * чтобы красный отрезок и текст ошибки не разошлись.
 */
function walk(blocks: readonly ShiftBlock[], rules: ShiftRules) {
  const segments: ShiftSegment[] = [];
  const events: Array<{ code: 'continuous_driving'; atMinute: number } | { code: 'split_first_part' }> = [];

  let since = 0;
  let firstPart = false;
  let flagged = false;
  let t = 0;

  for (const block of merge(blocks)) {
    let over = false;

    if (block.kind === 'drive') {
      since += block.minutes;
      over = since > rules.maxContinuousDrive;
      if (over && !flagged) {
        flagged = true;
        events.push({ code: 'continuous_driving', atMinute: t + block.minutes - (since - rules.maxContinuousDrive) });
      }
    } else if (block.kind === 'break') {
      if (block.minutes >= rules.fullBreak || (firstPart && block.minutes >= rules.splitSecond)) {
        since = 0;
        firstPart = false;
        flagged = false;
      } else if (!firstPart && block.minutes >= rules.splitFirst) {
        /* 30 минут первыми — это всё равно только первая часть: порядок 15, затем 30. */
        firstPart = true;
        if (block.minutes >= rules.splitSecond) events.push({ code: 'split_first_part' });
      }
    }
    /* Другая работа — не перерыв: счётчик вождения она не трогает. */

    segments.push({ ...block, over });
    t += block.minutes;
  }

  return { segments, events };
}

export function shiftTotals(blocks: readonly ShiftBlock[]): ShiftTotals {
  const totals = { drive: 0, work: 0, rest: 0, total: 0 };
  for (const block of blocks) {
    if (!(block.minutes > 0)) continue;
    if (block.kind === 'drive') totals.drive += block.minutes;
    else if (block.kind === 'work') totals.work += block.minutes;
    else totals.rest += block.minutes;
    totals.total += block.minutes;
  }
  return totals;
}

/** Полоса смены для экрана: слитые отрезки с отметкой нарушения. */
export function shiftSegments(blocks: readonly ShiftBlock[], rules: ShiftRules = SHIFT_RULES): ShiftSegment[] {
  return walk(blocks, rules).segments;
}

/**
 * Проверить смену против задания сценария.
 *
 * Ошибки — нарушения и несоответствие заданию, предупреждения — то, что
 * законно, но стоит знать. Нет ни одной ошибки — первой строкой «ok».
 */
export function validateShift(
  blocks: readonly ShiftBlock[],
  scenario: ShiftScenario,
  rules: ShiftRules = SHIFT_RULES,
): ShiftFinding[] {
  const totals = shiftTotals(blocks);
  if (totals.total === 0) return [{ level: 'error', code: 'empty' }];

  const findings: ShiftFinding[] = [];

  for (const event of walk(blocks, rules).events) {
    findings.push(
      event.code === 'continuous_driving'
        ? { level: 'error', code: 'continuous_driving', atMinute: event.atMinute }
        : { level: 'warn', code: 'split_first_part' },
    );
  }

  if (totals.drive !== scenario.driveMinutes) {
    findings.push({ level: 'error', code: 'drive_mismatch', planned: totals.drive, required: scenario.driveMinutes });
  }

  if (totals.drive > scenario.limitMinutes) {
    findings.push({ level: 'error', code: 'daily_limit', limit: scenario.limitMinutes });
  } else if (totals.drive > rules.dailyDriving) {
    findings.push({ level: 'warn', code: 'extension_used' });
  }

  if (totals.work !== scenario.workMinutes) {
    findings.push({ level: 'error', code: 'work_mismatch', planned: totals.work, required: scenario.workMinutes });
  }

  if (totals.total > rules.regularRestFits) {
    findings.push({ level: 'warn', code: 'long_shift', total: totals.total });
  }

  if (!findings.some((finding) => finding.level === 'error')) {
    findings.unshift({ level: 'ok', code: 'ok', total: totals.total });
  }

  return findings;
}
