/**
 * Интервальное повторение тренажёра (система Лейтнера).
 *
 * Шесть коробок с интервалами 0/1/3/7/16/35 дней. Верный ответ двигает
 * карточку в следующую коробку и откладывает её на интервал, ошибка
 * возвращает в первую — и карточка снова «к повтору» уже в следующем
 * раунде. «Свежесть знаний» — доля пройденных коробок, которая тает,
 * когда повтор просрочен.
 *
 * Состояние водителя — словарь по card_key: ключ вопроса общий для всех
 * переводов, поэтому смена языка прогресс не теряет.
 *
 * Модуль без импортов намеренно: тесты гоняются голым `node --test`.
 */

export const INTERVAL_DAYS = [0, 1, 3, 7, 16, 35] as const;
export const MAX_BOX = INTERVAL_DAYS.length - 1;
export const ROUND_SIZE = 8;
/** Сколько карточек «к повтору» берётся в раунд — остальное новые. */
export const ROUND_DUE = 6;

const DAY = 86_400_000;

export type CardState = {
  box: number;
  /** Когда повторить, мс. */
  due: number;
  /** Когда отвечал последний раз, мс: по нему сливаются устройства. */
  last: number;
  right: number;
  wrong: number;
};

export type Progress = Record<string, CardState>;

export function answerCard(prev: CardState | undefined, correct: boolean, now: number): CardState {
  const right = (prev?.right ?? 0) + (correct ? 1 : 0);
  const wrong = (prev?.wrong ?? 0) + (correct ? 0 : 1);

  if (!correct) return { box: 1, due: now, last: now, right, wrong };

  const box = Math.min((prev?.box ?? 0) + 1, MAX_BOX);
  return { box, due: now + INTERVAL_DAYS[box] * DAY, last: now, right, wrong };
}

/**
 * Свежесть знаний по модулю, 0–100.
 *
 * Карточка в коробке n даёт n/5. Просроченная теряет до 70 % веса за
 * два своих интервала плюс сутки — забывание, а не обнуление.
 */
export function freshness(keys: readonly string[], progress: Progress, now: number): number {
  if (keys.length === 0) return 0;

  let sum = 0;
  for (const key of keys) {
    const card = progress[key];
    if (!card || !card.box) continue;

    let value = card.box / MAX_BOX;
    if (now > card.due) {
      const span = (INTERVAL_DAYS[card.box] || 1) * DAY * 2 + DAY;
      value *= Math.max(0.3, 1 - (now - card.due) / span);
    }
    sum += value;
  }

  return Math.round((sum / keys.length) * 100);
}

export function isDue(card: CardState | undefined, now: number): boolean {
  return Boolean(card && card.box && card.due <= now);
}

export function dueCount(keys: readonly string[], progress: Progress, now: number): number {
  return keys.filter((key) => isDue(progress[key], now)).length;
}

export function newCount(keys: readonly string[], progress: Progress): number {
  return keys.filter((key) => !progress[key]).length;
}

export type FreshnessState = 'new' | 'fresh' | 'ok' | 'stale';

export function freshnessState(keys: readonly string[], progress: Progress, now: number): FreshnessState {
  if (!keys.some((key) => progress[key])) return 'new';
  const value = freshness(keys, progress, now);
  return value >= 75 ? 'fresh' : value >= 40 ? 'ok' : 'stale';
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Раунд: сначала «к повтору» (до шести, вперемешку), остальное — новые
 * по порядку. Повторять нечего и новых нет — просто шесть случайных:
 * водитель нажал «ещё раз», пустой экран ему не ответ.
 */
export function buildRound(
  keys: readonly string[],
  progress: Progress,
  now: number,
  random: () => number = Math.random,
): string[] {
  const due = shuffle(keys.filter((key) => isDue(progress[key], now)), random).slice(0, ROUND_DUE);
  const fresh = keys.filter((key) => !progress[key]);
  const round = due.concat(fresh.slice(0, Math.max(2, ROUND_SIZE - due.length))).slice(0, ROUND_SIZE);

  return round.length > 0 ? round : shuffle([...keys], random).slice(0, ROUND_DUE);
}

/** Слить прогресс двух устройств: по каждой карточке побеждает более поздний ответ. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const out: Progress = { ...a };
  for (const [key, card] of Object.entries(b)) {
    const mine = out[key];
    if (!mine || card.last > mine.last) out[key] = card;
  }
  return out;
}

/** Карточки, которые в `local` новее, чем в `remote`: их и нужно отправить. */
export function newerThan(local: Progress, remote: Progress): Progress {
  const out: Progress = {};
  for (const [key, card] of Object.entries(local)) {
    const theirs = remote[key];
    if (!theirs || card.last > theirs.last) out[key] = card;
  }
  return out;
}
