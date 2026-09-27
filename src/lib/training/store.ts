import type { Progress } from './leitner';

/**
 * Прогресс и настройки тренажёра на устройстве.
 *
 * У гостя это единственное хранилище. У водителя — кэш и очередь: ответ
 * из кабины без связи ложится сюда и уходит в базу при следующем
 * открытии. Ключ прогресса свой у каждого водителя — телефон бывает
 * общим, — гостевой переносится первому вошедшему и стирается.
 *
 * Хранилище может отсутствовать (приватный режим, запрет сайта) —
 * тогда тренажёр работает, просто ничего не помнит.
 */

const PROGRESS = 'rahtis-training:v1:';
const GUEST = `${PROGRESS}guest`;
const PREFS = 'rahtis-training:prefs';

export type TrainingPrefs = { mode: 'pro' | 'new' };

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Нет места или запрещено — тренажёр продолжает работать без памяти. */
  }
}

function isProgress(value: unknown): value is Progress {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function progressKey(driverId: string | null): string {
  return driverId ? `${PROGRESS}${driverId}` : GUEST;
}

export function readProgress(driverId: string | null): Progress {
  const value = read<unknown>(progressKey(driverId));
  return isProgress(value) ? value : {};
}

export function writeProgress(driverId: string | null, progress: Progress) {
  write(progressKey(driverId), progress);
}

/** Гостевой прогресс — один раз, первому вошедшему водителю. */
export function takeGuestProgress(): Progress {
  const value = read<unknown>(GUEST);
  try {
    window.localStorage.removeItem(GUEST);
  } catch {
    /* см. выше */
  }
  return isProgress(value) ? value : {};
}

export function readPrefs(): TrainingPrefs {
  const value = read<Partial<TrainingPrefs>>(PREFS);
  return { mode: value?.mode === 'new' ? 'new' : 'pro' };
}

export function writePrefs(prefs: TrainingPrefs) {
  write(PREFS, prefs);
}
