/**
 * Расчёт в практике «Закрепи груз».
 *
 * Упрощённая учебная модель по принципу EN 12195-1: крепление прижимом
 * (ремень через верх груза) против сил инерции вперёд, вбок и назад.
 * Без коэффициентов запаса и без проверки прочности борта — и экран
 * обязан говорить это под результатом.
 *
 *   ремней = ⌈(c − μ) · m·g / (μ · 2 · STF · sin α)⌉, минимум 0
 *
 * Груз вплотную к переднему борту — направление «вперёд» держит борт.
 *
 * Возвращаются коды и числа, текст — из словаря. Все коэффициенты — в
 * CARGO_CONFIG: их должен подтвердить инструктор, и менять их не значит
 * трогать экран.
 *
 * Модуль без импортов намеренно: тесты гоняются голым `node --test`.
 */

/** Значения учебной задачи. ПОДТВЕРЖДАЕТ ИНСТРУКТОР. */
export const CARGO_CONFIG = {
  /** Вес груза 10 т: m·g в daN. */
  weightDaN: 9810,
  /** STF ремня с этикетки, daN. */
  stfDaN: 400,
  /** Коэффициент трения μ по основанию. */
  friction: { wood: 0.45, mat: 0.6 },
  /** Доля веса груза, которую держит крепление, по направлениям (EN 12195-1, дорога). */
  acceleration: { forward: 0.8, sideways: 0.5, backward: 0.5 },
  /** Сколько ремней есть в машине по задаче. */
  maxStraps: 12,
  /** Ремень положе этого угла прижимает заметно слабее — стоит сказать. */
  shallowAngle: 45,
} as const;

export type CargoConfig = typeof CARGO_CONFIG;

export type CargoOptions = {
  /** Зазор до переднего борта или груз вплотную к нему. */
  position: 'gap' | 'blocked';
  base: keyof CargoConfig['friction'];
  /** Угол ремня к полу, градусы. */
  angle: number;
  edges: boolean;
  /** На всех ремнях есть этикетка — или на одном нет. */
  labels: 'ok' | 'missing';
  straps: number;
};

export type CargoDirection = 'forward' | 'sideways' | 'backward';

export type CargoFinding =
  | { level: 'error'; code: 'unlabelled' }
  | { level: 'error'; code: 'too_few'; required: number; used: number; direction: CargoDirection }
  | { level: 'error'; code: 'no_straps' }
  | { level: 'warn'; code: 'gap' }
  | { level: 'warn'; code: 'shallow_angle' }
  | { level: 'warn'; code: 'no_edges' }
  | { level: 'ok'; code: 'ok'; required: number; used: number };

export type CargoResult = {
  mu: number;
  /** Сколько daN удерживает трением один ремень, округлено. */
  perStrapDaN: number;
  /** null — вперёд держит борт. */
  forward: number | null;
  sideways: number;
  backward: number;
  required: number;
  findings: CargoFinding[];
};

export function calcCargoSecuring(options: CargoOptions, config: CargoConfig = CARGO_CONFIG): CargoResult {
  const mu = config.friction[options.base];
  const perStrap = mu * 2 * config.stfDaN * Math.sin((options.angle * Math.PI) / 180);

  /* Минус эпсилон: 10,000000001 из-за плавающей точки — это всё ещё 10 ремней. */
  const need = (c: number) => Math.max(0, Math.ceil(((c - mu) * config.weightDaN) / perStrap - 1e-9));

  const forward = options.position === 'blocked' ? null : need(config.acceleration.forward);
  const sideways = need(config.acceleration.sideways);
  const backward = need(config.acceleration.backward);
  const required = Math.max(forward ?? 0, sideways, backward);

  const findings: CargoFinding[] = [];

  if (options.labels === 'missing') findings.push({ level: 'error', code: 'unlabelled' });

  if (options.straps < required) {
    const direction: CargoDirection =
      forward === required ? 'forward' : sideways === required ? 'sideways' : 'backward';
    findings.push({ level: 'error', code: 'too_few', required, used: options.straps, direction });
  }

  /* Трения хватает на бумаге, но на неровности груз подпрыгивает и прижим пропадает. */
  if (required === 0 && options.straps === 0) findings.push({ level: 'error', code: 'no_straps' });

  if (options.position === 'gap') findings.push({ level: 'warn', code: 'gap' });
  if (options.angle < config.shallowAngle) findings.push({ level: 'warn', code: 'shallow_angle' });
  if (!options.edges) findings.push({ level: 'warn', code: 'no_edges' });

  if (!findings.some((finding) => finding.level === 'error')) {
    findings.unshift({ level: 'ok', code: 'ok', required, used: options.straps });
  }

  return { mu, perStrapDaN: Math.round(perStrap), forward, sideways, backward, required, findings };
}
