import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { DriverLocale } from '@/lib/i18n/driver';
import type { Progress } from './leitner';
import type { TrainingCard } from './modules';

/**
 * Вопросы тренажёра на языке водителя.
 *
 * Что показывать, решает база: водителю и гостю — только проверенные
 * инструктором, действующие и вступившие в силу; оператору — все, он их
 * и проверяет. Здесь только выбор перевода: язык водителя, потом
 * английский, потом финский. Вопрос без перевода на язык водителя
 * лучше показать по-английски, чем не показать.
 */
export async function getTrainingCards(locale: DriverLocale): Promise<TrainingCard[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('training_questions')
    .select('card_key, module, locale, question, options, correct_index, explanation, hint, legal_ref')
    .eq('active', true)
    .in('locale', [...new Set([locale, 'en', 'fi'])])
    .order('card_key');

  if (error) {
    console.error('тренажёр: вопросы не прочитаны:', error.message);
    return [];
  }

  const rank = (l: string) => (l === locale ? 0 : l === 'en' ? 1 : 2);
  const best = new Map<string, (typeof data)[number]>();
  for (const row of data ?? []) {
    const seen = best.get(row.card_key);
    if (!seen || rank(row.locale) < rank(seen.locale)) best.set(row.card_key, row);
  }

  return [...best.values()].flatMap((row) => {
    const options = Array.isArray(row.options) ? row.options.map(String) : [];
    if (options.length < 2 || row.correct_index >= options.length) return [];
    return [
      {
        key: row.card_key,
        module: row.module,
        question: row.question,
        options,
        correct: row.correct_index,
        explanation: row.explanation,
        hint: row.hint,
        ref: row.legal_ref,
      },
    ];
  });
}

/** Прогресс водителя из базы; для гостя и кабинетов — пусто. */
export async function getTrainingProgress(): Promise<Progress> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('training_progress')
    .select('card_key, box, due_at, last_answered_at, correct_count, wrong_count');

  return Object.fromEntries(
    (data ?? []).map((row) => [
      row.card_key,
      {
        box: row.box,
        due: Date.parse(row.due_at),
        last: Date.parse(row.last_answered_at),
        right: row.correct_count,
        wrong: row.wrong_count,
      },
    ]),
  );
}
