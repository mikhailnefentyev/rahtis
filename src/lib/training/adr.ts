/**
 * Логика практики модуля ADR: «Lue kilpi» (прочитай табличку) и
 * «Kokoa varusteet» (собери комплект).
 *
 * Табличка. Верхнее число оранжевой таблички — номер опасности (Kemler),
 * нижнее — номер ООН. Цифры номера опасности читаются по ADR 5.3.2.3:
 * первая — основная опасность, следующие — дополнительные, удвоение —
 * усиление, X — опасная реакция с водой, 0 — дополнительной нет.
 *
 * Комплект. ADR 8.1.5.2 — оснащение каждой транспортной единицы, 8.1.5.3 —
 * дополнительное по знакам опасности, 8.1.4.1 — огнетушители по массе.
 * Значения — в ADR_CONFIG: их подтверждает инструктор.
 *
 * Возвращаются коды, текст — из словаря. Модуль без импортов намеренно:
 * тесты гоняются голым `node --test`.
 */

// ── Табличка ──────────────────────────────────────────────────────────

export type HazardToken = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'intensified' | 'water';

/**
 * Разобрать номер опасности на смысловые части.
 *   '33'   → ['3', 'intensified']
 *   '268'  → ['2', '6', '8']
 *   'X423' → ['water', '4', '2', '3']
 *   '30'   → ['3']
 */
export function decodeHazard(code: string): HazardToken[] {
  const raw = code.trim().toUpperCase();
  const tokens: HazardToken[] = [];
  let digits = raw;
  if (digits.startsWith('X')) {
    tokens.push('water');
    digits = digits.slice(1);
  }

  const seen = new Set<string>();
  for (let i = 0; i < digits.length; i++) {
    const d = digits[i];
    if (d === '0') continue;
    if (i > 0 && d === digits[i - 1]) {
      if (!tokens.includes('intensified')) tokens.push('intensified');
      continue;
    }
    if (!seen.has(d) && '23456789'.includes(d)) {
      seen.add(d);
      tokens.push(d as HazardToken);
    }
  }
  return tokens;
}

/** Таблички для упражнения: реальные пары номера опасности и ООН. */
export const PLATES = [
  { hazard: '33', un: '1203', cargo: 'petrol' },
  { hazard: '30', un: '1202', cargo: 'diesel' },
  { hazard: '23', un: '1965', cargo: 'lpg' },
  { hazard: '80', un: '1789', cargo: 'hydrochloric' },
  { hazard: '268', un: '1005', cargo: 'ammonia' },
  { hazard: 'X423', un: '1428', cargo: 'sodium' },
  { hazard: '60', un: '1547', cargo: 'aniline' },
  { hazard: '50', un: '1942', cargo: 'ammoniumNitrate' },
] as const;

export type Plate = (typeof PLATES)[number];
export type PlateCargo = Plate['cargo'];

/**
 * Вопрос по табличке: правильный груз и три других, вперемешку. У
 * вариантов разные номера опасности, иначе вопрос нечестный.
 */
export function plateQuestion(index: number, random: () => number = Math.random) {
  const plate = PLATES[index % PLATES.length];
  const others = PLATES.filter((p) => p.hazard !== plate.hazard);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const options = [plate, ...others.slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { plate, options: options.map((p) => p.cargo), correct: plate.cargo as PlateCargo };
}

// ── Комплект ─────────────────────────────────────────────────────────

export const KIT_ITEMS = [
  'ext2a',
  'ext2b',
  'ext6a',
  'ext6b',
  'chock',
  'signs',
  'eyewash',
  'vest',
  'lamp',
  'gloves',
  'goggles',
  'mask',
  'shovel',
  'drainSeal',
  'container',
  'instructions',
  'towRope',
  'jumpCables',
  'snowChains',
  'fireBlanket',
] as const;

export type KitItem = (typeof KIT_ITEMS)[number];

const EXTINGUISHERS: Partial<Record<KitItem, number>> = { ext2a: 2, ext2b: 2, ext6a: 6, ext6b: 6 };

/** ПОДТВЕРЖДАЕТ ИНСТРУКТОР. Нормы ADR 8.1.4.1, 8.1.5.2, 8.1.5.3. */
export const ADR_CONFIG = {
  /** Каждой транспортной единице, всегда. */
  base: ['chock', 'signs', 'vest', 'lamp', 'gloves', 'goggles', 'instructions'] as KitItem[],
  /** Промывка для глаз — кроме знаков классов 1 и 2. */
  eyewashExempt: ['1', '1.4', '1.5', '1.6', '2.1', '2.2', '2.3'],
  /** Маска для экстренного выхода — при знаках 2.3 и 6.1. */
  maskLabels: ['2.3', '6.1'],
  /** Лопата, заглушка стока, ёмкость — при знаках 3, 4.1, 4.3, 8, 9. */
  spillLabels: ['3', '4.1', '4.3', '8', '9'],
  /** Огнетушители по максимальной массе: всего кг, из них у кабины от 2 кг и один дополнительный не меньше. */
  extinguishers: [
    { upTo: 3.5, total: 4, additional: 2 },
    { upTo: 7.5, total: 8, additional: 6 },
    { upTo: Infinity, total: 12, additional: 6 },
  ],
  /** Что к ADR не относится — водитель может возить, но это не комплект. */
  notAdr: ['towRope', 'jumpCables', 'snowChains', 'fireBlanket'] as KitItem[],
} as const;

export const KIT_SCENARIOS = [
  { id: 'petrolTank', label: '3', mass: 26 },
  { id: 'lpgCylinders', label: '2.1', mass: 12 },
  { id: 'chlorine', label: '2.3', mass: 7 },
  { id: 'acidVan', label: '8', mass: 3.2 },
] as const;

export type KitScenario = (typeof KIT_SCENARIOS)[number];

/** Обязательные предметы, кроме огнетушителей (их проверяет отдельное правило). */
export function requiredKit(scenario: { label: string }, config = ADR_CONFIG): KitItem[] {
  const items = [...config.base];
  if (!(config.eyewashExempt as readonly string[]).includes(scenario.label)) items.push('eyewash');
  if ((config.maskLabels as readonly string[]).includes(scenario.label)) items.push('mask');
  if ((config.spillLabels as readonly string[]).includes(scenario.label)) items.push('shovel', 'drainSeal', 'container');
  return items;
}

export type KitFinding =
  | { level: 'error'; code: 'missing'; items: KitItem[] }
  | { level: 'error'; code: 'extinguishers'; total: number; required: number; additional: number }
  | { level: 'warn'; code: 'not_adr'; items: KitItem[] }
  | { level: 'warn'; code: 'extra'; items: KitItem[] }
  | { level: 'ok'; code: 'ok' };

export function checkKit(scenario: { label: string; mass: number }, chosen: readonly KitItem[], config = ADR_CONFIG): KitFinding[] {
  const findings: KitFinding[] = [];
  const picked = new Set(chosen);
  const required = requiredKit(scenario, config);

  const missing = required.filter((item) => !picked.has(item));
  if (missing.length) findings.push({ level: 'error', code: 'missing', items: missing });

  const rule = config.extinguishers.find((r) => scenario.mass <= r.upTo) ?? config.extinguishers[config.extinguishers.length - 1];
  const sizes = chosen.flatMap((item) => (EXTINGUISHERS[item] ? [EXTINGUISHERS[item]!] : []));
  const total = sizes.reduce((a, b) => a + b, 0);
  /* Один у кабины от 2 кг, ещё один не меньше дополнительного минимума, и в сумме не меньше нормы. */
  const sorted = [...sizes].sort((a, b) => b - a);
  const enough = sizes.length >= 2 && total >= rule.total && sorted[0] >= rule.additional && sorted[1] >= 2;
  if (!enough) {
    findings.push({ level: 'error', code: 'extinguishers', total, required: rule.total, additional: rule.additional });
  }

  const notAdr = chosen.filter((item) => config.notAdr.includes(item));
  if (notAdr.length) findings.push({ level: 'warn', code: 'not_adr', items: notAdr });

  /* ADR-предметы, которые этому грузу не нужны: не ошибка, но стоит знать. */
  const extra = chosen.filter(
    (item) => !EXTINGUISHERS[item] && !required.includes(item) && !config.notAdr.includes(item),
  );
  if (extra.length) findings.push({ level: 'warn', code: 'extra', items: extra });

  if (!findings.some((f) => f.level === 'error')) findings.unshift({ level: 'ok', code: 'ok' });
  return findings;
}
