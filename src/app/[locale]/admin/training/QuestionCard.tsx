'use client';

import { useCallback, useState } from 'react';
import { Badge, Button, Card, CardBody, Input, Mono } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import { reviewQuestionAction, setQuestionActiveAction, unreviewQuestionAction } from '@/lib/training/admin';
import { QuestionForm, type QuestionDraft } from './QuestionForm';

export type AdminQuestion = QuestionDraft & {
  active: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

/** Вопрос в списке админки: как его увидит водитель, и что с ним можно сделать. */
export function QuestionCard({ question }: { question: AdminQuestion }) {
  const { t, f, locale } = useI18n();
  const texts = t.adminTraining;
  const [editing, setEditing] = useState(false);
  const stop = useCallback(() => setEditing(false), []);

  const state = !question.active ? 'inactive' : question.reviewed_at ? 'reviewed' : 'unreviewed';
  const tone = state === 'reviewed' ? 'ok' : state === 'inactive' ? 'neutral' : 'warn';

  return (
    <Card stripe={tone}>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Mono className="text-[13px] font-semibold">{question.card_key}</Mono>
          <Badge>{question.locale}</Badge>
          <Badge tone={tone}>{texts.states[state]}</Badge>
          {question.reviewed_at && (
            <span className="text-[12px] text-ink-muted">
              {texts.reviewedBy}: {question.reviewed_by} · {f.date(question.reviewed_at)}
            </span>
          )}
        </div>

        {editing ? (
          <QuestionForm question={question} onDone={stop} />
        ) : (
          <>
            <p className="text-[14px] font-semibold">{question.question}</p>
            <ol className="flex list-decimal flex-col gap-0.5 pl-5 text-[13px]">
              {question.options.map((option, i) => (
                <li key={i} className={cn(i === question.correct_index && 'font-semibold text-ok')}>
                  {option}
                  {i === question.correct_index && ` — ${texts.correctMark}`}
                </li>
              ))}
            </ol>
            <p className="text-[13px] text-ink-muted">{question.explanation}</p>
            {question.hint && (
              <p className="text-[13px] text-ink-muted">
                {texts.hint}: {question.hint}
              </p>
            )}
            {(question.legal_ref || question.valid_from) && (
              <p className="text-[12px] text-ink-faint">
                {question.legal_ref}
                {question.valid_from && ` · ${texts.validFrom} ${f.date(`${question.valid_from}T12:00:00Z`)}`}
              </p>
            )}

            <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
              <Button size="sm" onClick={() => setEditing(true)}>
                {texts.edit}
              </Button>

              {question.reviewed_at ? (
                <form action={unreviewQuestionAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={question.id} />
                  <Button size="sm" type="submit" variant="ghost">
                    {texts.unmark}
                  </Button>
                </form>
              ) : (
                <form action={reviewQuestionAction} className="flex items-center gap-2">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={question.id} />
                  <Input
                    name="reviewer"
                    required
                    placeholder={texts.reviewerHint}
                    aria-label={texts.reviewer}
                    className="h-7 w-40 text-xs"
                  />
                  <Button size="sm" type="submit" variant="primary">
                    {texts.markReviewed}
                  </Button>
                </form>
              )}

              <form action={setQuestionActiveAction} className="ml-auto">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={question.id} />
                <input type="hidden" name="active" value={String(!question.active)} />
                <Button size="sm" type="submit" variant={question.active ? 'danger' : 'default'}>
                  {question.active ? texts.deactivate : texts.activate}
                </Button>
              </form>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
