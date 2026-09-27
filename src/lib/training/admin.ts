'use server';

import { revalidatePath } from 'next/cache';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { DRIVER_LOCALES } from '@/lib/i18n/driverLocale';
import { createClient } from '@/lib/supabase/server';

/**
 * Вопросы тренажёра в админке: добавить, править, отметить проверку,
 * выключить.
 *
 * Писать может только оператор — это политика training_questions, а не
 * проверка здесь. Правка текста снимает отметку о проверке в самой базе
 * (триггер), поэтому «исправил и забыл перепроверить» невозможно.
 */

export type QuestionState = { error: string | null; done: boolean };

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

function revalidate(locale: Locale) {
  revalidatePath(`/${locale}/admin/training`);
}

export async function saveQuestionAction(_previous: QuestionState, formData: FormData): Promise<QuestionState> {
  const locale = toLocale(formData.get('locale'));
  const { adminTraining: t } = await getDictionary(locale);

  const id = str(formData, 'id');
  const cardKey = str(formData, 'card_key').toLowerCase();
  const questionLocale = str(formData, 'question_locale');
  const options = str(formData, 'options')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const correct = Number.parseInt(str(formData, 'correct'), 10) - 1;
  const validFrom = str(formData, 'valid_from');
  const reviewer = str(formData, 'reviewer');

  const topic = cardKey.split('.')[0];
  const valid =
    /^[a-z0-9]{2,20}\.[a-z0-9_-]{1,40}$/.test(cardKey) &&
    (DRIVER_LOCALES as readonly string[]).includes(questionLocale) &&
    options.length >= 2 &&
    options.length <= 6 &&
    correct >= 0 &&
    correct < options.length &&
    str(formData, 'question') !== '' &&
    str(formData, 'explanation') !== '' &&
    (!validFrom || /^\d{4}-\d{2}-\d{2}$/.test(validFrom));

  if (!valid) return { error: t.failed, done: false };

  const content = {
    question: str(formData, 'question'),
    options,
    correct_index: correct,
    explanation: str(formData, 'explanation'),
    hint: str(formData, 'hint') || null,
    legal_ref: str(formData, 'legal_ref') || null,
    valid_from: validFrom || null,
    /* Отметить проверку можно в той же правке — тогда триггер её не снимет. */
    ...(reviewer ? { reviewed_by: reviewer, reviewed_at: new Date().toISOString() } : {}),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('training_questions').update(content).eq('id', id)
    : await supabase
        .from('training_questions')
        .insert({ ...content, module: topic, card_key: cardKey, locale: questionLocale });

  if (error) {
    console.error('вопрос тренажёра не сохранён:', error.message);
    return { error: t.failed, done: false };
  }

  revalidate(locale);
  return { error: null, done: true };
}

export async function reviewQuestionAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const reviewer = str(formData, 'reviewer');
  const id = str(formData, 'id');
  if (!id || !reviewer) return;

  const supabase = await createClient();
  await supabase
    .from('training_questions')
    .update({ reviewed_by: reviewer, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  revalidate(locale);
}

export async function unreviewQuestionAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const id = str(formData, 'id');
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('training_questions').update({ reviewed_by: null, reviewed_at: null }).eq('id', id);
  revalidate(locale);
}

export async function setQuestionActiveAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const id = str(formData, 'id');
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from('training_questions')
    .update({ active: str(formData, 'active') === 'true' })
    .eq('id', id);
  revalidate(locale);
}
