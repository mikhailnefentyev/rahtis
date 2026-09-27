'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { DRIVER_LOCALES, DRIVER_LOCALE_NAMES } from '@/lib/i18n/driverLocale';
import { useI18n } from '@/lib/i18n/provider';
import { saveQuestionAction, type QuestionState } from '@/lib/training/admin';

export type QuestionDraft = {
  id: string;
  card_key: string;
  locale: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  hint: string | null;
  legal_ref: string | null;
  valid_from: string | null;
};

/**
 * Форма вопроса: новый или правка существующего.
 *
 * Ключ и язык у существующего вопроса не меняются — это его адрес:
 * по card_key у водителей лежит прогресс, а язык — строка перевода.
 * Поле «Проверил» необязательное: заполнено — вопрос сохраняется сразу
 * проверенным, пусто — правка текста снимает прежнюю отметку.
 */
export function QuestionForm({ question, onDone }: { question?: QuestionDraft; onDone?: () => void }) {
  const { t, locale } = useI18n();
  const texts = t.adminTraining;
  const [state, action, pending] = useActionState<QuestionState, FormData>(saveQuestionAction, {
    error: null,
    done: false,
  });
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.done) return;
    if (!question) form.current?.reset();
    onDone?.();
  }, [state, question, onDone]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      {question && <input type="hidden" name="id" value={question.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={texts.cardKey} hint={texts.cardKeyHint} required>
          {(props) => (
            <Input
              {...props}
              name="card_key"
              required
              defaultValue={question?.card_key}
              readOnly={Boolean(question)}
              placeholder="tacho.b2"
            />
          )}
        </Field>
        <Field label={texts.locale} required>
          {(props) => (
            <Select {...props} name="question_locale" defaultValue={question?.locale ?? 'fi'} disabled={Boolean(question)}>
              {DRIVER_LOCALES.map((code) => (
                <option key={code} value={code}>
                  {DRIVER_LOCALE_NAMES[code]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {/* disabled-поле не уходит с формой — язык существующего вопроса передаётся отдельно. */}
      {question && <input type="hidden" name="question_locale" value={question.locale} />}

      <Field label={texts.question} required>
        {(props) => <Textarea {...props} name="question" rows={2} required defaultValue={question?.question} />}
      </Field>
      <Field label={texts.options} required>
        {(props) => (
          <Textarea {...props} name="options" rows={4} required defaultValue={question?.options.join('\n')} />
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={texts.correct} required>
          {(props) => (
            <Input
              {...props}
              name="correct"
              type="number"
              min={1}
              max={6}
              required
              defaultValue={question ? question.correct_index + 1 : 1}
            />
          )}
        </Field>
        <Field label={texts.legalRef}>
          {(props) => <Input {...props} name="legal_ref" defaultValue={question?.legal_ref ?? ''} />}
        </Field>
        <Field label={texts.validFrom}>
          {(props) => <Input {...props} name="valid_from" type="date" defaultValue={question?.valid_from ?? ''} />}
        </Field>
      </div>
      <Field label={texts.explanation} required>
        {(props) => <Textarea {...props} name="explanation" rows={3} required defaultValue={question?.explanation} />}
      </Field>
      <Field label={texts.hint}>
        {(props) => <Textarea {...props} name="hint" rows={2} defaultValue={question?.hint ?? ''} />}
      </Field>
      <Field label={texts.reviewer} hint={texts.reviewerHint}>
        {(props) => <Input {...props} name="reviewer" />}
      </Field>

      {state.error && (
        <p role="alert" className="text-[13px] text-danger">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {texts.save}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            {texts.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}
