'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import { statusToneClass } from '@/components/ui';
import type { TrainingCard } from '@/lib/training/modules';
import { primaryButton, secondaryButton } from './ui';

type Session = {
  cards: TrainingCard[];
  i: number;
  right: number;
  /** Порядок вариантов текущего вопроса: перемешан, чтобы не запоминали место. */
  order: number[];
  picked: number | null;
};

function shuffled(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Тренировка: стартовый экран, вопросы по одному, итог.
 *
 * Ответ фиксируется сразу по нажатию — второй попытки нет, иначе
 * повторение ничего не меряет. После ответа — объяснение и норма.
 */
export function Quiz({
  moduleIntro,
  due,
  fresh,
  mode,
  buildRound,
  onAnswer,
  onReset,
  onFinish,
  freshness,
  hasPractice,
  onPractice,
}: {
  moduleIntro: string;
  due: number;
  fresh: number;
  mode: 'pro' | 'new';
  buildRound: () => TrainingCard[];
  onAnswer: (key: string, correct: boolean) => void;
  onReset: () => void;
  onFinish: () => void;
  freshness: number;
  hasPractice: boolean;
  onPractice: () => void;
}) {
  const { t, m } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [finished, setFinished] = useState<{ right: number; total: number } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  const answered = session?.picked != null;
  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);

  function start() {
    const cards = buildRound();
    if (cards.length === 0) return;
    setFinished(null);
    setSession({ cards, i: 0, right: 0, order: shuffled(cards[0].options.length), picked: null });
  }

  if (finished) {
    const perfect = finished.right === finished.total;
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{perfect ? t.training.doneAll : t.training.doneTitle}</h2>
        <p className="text-[17px]">
          {m('training.score', { right: finished.right, total: finished.total, fresh: freshness })}
        </p>
        <p className="text-[15px] text-ink-muted">
          {perfect ? t.training.doneAllHint : t.training.doneMistakesHint}
        </p>
        <button type="button" className={primaryButton} onClick={start}>
          {t.training.oneMore}
        </button>
        {hasPractice && (
          <button type="button" className={secondaryButton} onClick={onPractice}>
            {t.training.toPractice}
          </button>
        )}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t.training.trainTitle}</h2>
        <p className="text-[15px] text-ink-muted">
          {moduleIntro} {t.training.trainHint}
        </p>
        <p className="text-[16px] font-semibold">{m('training.counts', { due, fresh })}</p>
        <button type="button" className={primaryButton} onClick={start}>
          {due || fresh ? t.training.start : t.training.startAnyway}
        </button>

        {confirmReset ? (
          <div className="flex flex-col gap-2 rounded-control border border-danger/35 bg-danger/10 p-3">
            <p className="text-[15px]">{t.training.resetConfirm}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={secondaryButton} onClick={() => setConfirmReset(false)}>
                {t.training.cancel}
              </button>
              <button
                type="button"
                className={cn(secondaryButton, 'border-danger text-danger')}
                onClick={() => {
                  setConfirmReset(false);
                  onReset();
                }}
              >
                {t.training.resetYes}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="self-start py-2 text-[15px] text-ink-muted underline"
            onClick={() => setConfirmReset(true)}
          >
            {t.training.reset}
          </button>
        )}
      </div>
    );
  }

  const card = session.cards[session.i];
  const last = session.i === session.cards.length - 1;

  function pick(index: number) {
    if (!session || session.picked != null) return;
    const correct = index === card.correct;
    onAnswer(card.key, correct);
    setSession({ ...session, picked: index, right: session.right + (correct ? 1 : 0) });
  }

  function next() {
    if (!session) return;
    if (last) {
      setFinished({ right: session.right, total: session.cards.length });
      setSession(null);
      onFinish();
      return;
    }
    const i = session.i + 1;
    setSession({ ...session, i, order: shuffled(session.cards[i].options.length), picked: null });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-ink-muted">{m('training.progress', { n: session.i + 1, total: session.cards.length })}</p>
      <p className="text-[19px] leading-snug font-semibold">{card.question}</p>

      {mode === 'new' && card.hint && (
        <p className="rounded-control border border-dashed border-warn/60 px-3 py-2.5 text-[15px]">
          <b className="text-warn">{t.training.hint}:</b> {card.hint}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {session.order.map((index) => {
          const isRight = answered && index === card.correct;
          const isWrong = answered && index === session.picked && index !== card.correct;
          return (
            <button
              key={index}
              type="button"
              disabled={answered}
              onClick={() => pick(index)}
              className={cn(
                'min-h-14 w-full rounded-control border-[1.5px] px-4 py-3 text-left text-[16px] font-medium',
                isRight
                  ? statusToneClass.ok
                  : isWrong
                    ? statusToneClass.danger
                    : 'border-line bg-surface text-ink disabled:text-ink-muted',
              )}
            >
              {card.options[index]}
            </button>
          );
        })}
      </div>

      {answered && (
        <>
          <div className="rounded-r-control border-l-4 border-accent bg-accent-wash px-3.5 py-3 text-[15px]">
            <b>{session.picked === card.correct ? t.training.right : t.training.wrong}</b> {card.explanation}
            {card.ref && <p className="mt-1.5 text-[13px] text-ink-muted">{card.ref}</p>}
          </div>
          <button ref={nextRef} type="button" className={primaryButton} onClick={next}>
            {last ? t.training.finish : t.training.next}
          </button>
        </>
      )}
    </div>
  );
}
