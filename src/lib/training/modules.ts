import type { ShiftScenario } from './shift';

/**
 * Реестр модулей тренажёра.
 *
 * Модуль — это вопросы в training_questions с его префиксом card_key,
 * строка здесь и название в словаре (training.modules). Своя практика —
 * по желанию: без неё вкладка «Практика» модулю просто не показывается.
 * ADR, Työturva, Ensiapu и остальные добавляются так же, без переделки
 * экранов.
 */
export const TRAINING_MODULES = [
  { id: 'tacho', practice: 'shift' },
  { id: 'cargo', practice: 'cargo' },
] as const satisfies ReadonlyArray<{ id: string; practice: 'shift' | 'cargo' | null }>;

export type TrainingModuleId = (typeof TRAINING_MODULES)[number]['id'];

export function isTrainingModule(value: unknown): value is TrainingModuleId {
  return TRAINING_MODULES.some((module) => module.id === value);
}

/**
 * Сценарии «Спланируй смену». Числа — задание сценария; тексты — в
 * словаре (training.shift.scenarios) под тем же id.
 */
export const SHIFT_SCENARIOS = [
  { id: 'short', driveMinutes: 480, workMinutes: 60, limitMinutes: 540 },
  { id: 'long', driveMinutes: 570, workMinutes: 0, limitMinutes: 600 },
  { id: 'unload', driveMinutes: 480, workMinutes: 45, limitMinutes: 540 },
] as const satisfies ReadonlyArray<ShiftScenario & { id: string }>;

export type ShiftScenarioId = (typeof SHIFT_SCENARIOS)[number]['id'];

/** Вопрос, готовый к показу: уже на одном языке. */
export type TrainingCard = {
  key: string;
  module: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  hint: string | null;
  ref: string | null;
};
