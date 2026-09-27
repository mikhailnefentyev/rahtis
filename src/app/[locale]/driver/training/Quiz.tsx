'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import type { TrainingCard } from '@/lib/training/modules';
import { CheckIcon, CrossIcon } from './icons';
import { primaryButton, secondaryButton } from './ui';

type Session = {
  cards: TrainingCard[];
  i: number;
  /** Итог каждого отвеченного вопроса раунда — для шкалы сверху. */
  results: boolean[];
  /** Порядок вариантов текущего вопроса: перемешан, чтобы не запоминали место. */
  order: number[];
  picked: number | null;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function shuffled(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Шкала раунда: по делению на вопрос, пройденные — цветом ответа. */
function RoundBar({ total, results, current }: { total: number; results: boolean[]; current: number }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-pill',
            i < results.length
              ? results[i]
                ? 'bg-ok'
                : 'bg-danger'
              : i === current
                ? 'bg-accent'
                : 'bg-raised',
          )}
        />
      ))}
    </div>
  );
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
  const [finished, setFinished] = useState<{ results: boolean[] } | null>(null);
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
    setSession({ cards, i: 0, results: [], order: shuffled(cards[0].options.length), picked: null });
  }

  if (finished) {
    const right = finished.results.filter(Boolean).length;
    const total = finished.results.length;
    const perfect = right === total;
    return (
      <div className="flex flex-col gap-4">
        <RoundBar total={total} results={finished.results} current={-1} />
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'flex size-20 shrink-0 flex-col items-center justify-center rounded-card font-mono',
              perfect ? 'bg-ok/10 text-ok' : 'bg-accent-wash text-accent',
            )}
          >
            <span className="text-[30px] leading-none font-bold tabular-nums">{right}</span>
            <span className="text-[14px]">/ {total}</span>
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{perfect ? t.training.doneAll : t.training.doneTitle}</h2>
            <p className="mt-0.5 text-[15px] text-ink-muted">
              {m('training.score', { right, total, fresh: freshness })}
            </p>
          </div>
        </div>
        <p className="text-[15px]">{perfect ? t.training.doneAllHint : t.training.doneMistakesHint}</p>
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
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t.training.trainTitle}</h2>
          <p className="mt-1 text-[15px] text-ink-muted">
            {moduleIntro} {t.training.trainHint}
          </p>
        </div>

        {/* Одна строка чисел, а не три карточки-метрики: водителю нужно одно — есть ли что повторить. */}
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          <span className={cn('rounded-pill px-2.5 py-1 font-mono', due > 0 ? 'bg-accent text-accent-ink' : 'bg-raised text-ink-muted')}>
            {m('training.counts', { due, fresh })}
          </span>
        </p>

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
            className="flex min-h-11 items-center self-start text-[15px] text-ink-muted underline"
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
  const correct = session.picked === card.correct;

  function pick(index: number) {
    if (!session || session.picked != null) return;
    const ok = index === card.correct;
    onAnswer(card.key, ok);
    setSession({ ...session, picked: index, results: [...session.results, ok] });
  }

  function next() {
    if (!session) return;
    if (last) {
      setFinished({ results: session.results });
      setSession(null);
      onFinish();
      return;
    }
    const i = session.i + 1;
    setSession({ ...session, i, order: shuffled(session.cards[i].options.length), picked: null });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <RoundBar total={session.cards.length} results={session.results} current={session.i} />
        <p className="font-mono text-[13px] text-ink-muted">
          {m('training.progress', { n: session.i + 1, total: session.cards.length })}
        </p>
      </div>

      <p className="text-[19px] leading-snug font-semibold">{card.question}</p>

      {mode === 'new' && card.hint && (
        <p className="rounded-control border border-dashed border-warn/60 bg-warn/5 px-3 py-2.5 text-[15px]">
          <b className="text-warn">{t.training.hint}:</b> {card.hint}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {session.order.map((index, position) => {
          const isRight = answered && index === card.correct;
          const isWrong = answered && index === session.picked && index !== card.correct;
          return (
            <button
              key={index}
              type="button"
              disabled={answered}
              onClick={() => pick(index)}
              className={cn(
                'flex min-h-14 w-full items-center gap-3 rounded-control border-[1.5px] px-3 py-2.5 text-left text-[16px] font-medium',
                isRight
                  ? 'border-ok bg-ok/10 text-ink'
                  : isWrong
                    ? 'border-danger bg-danger/10 text-ink'
                    : answered
                      ? 'border-line bg-surface text-ink-faint'
                      : 'border-line bg-surface text-ink',
              )}
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-[14px] font-bold',
                  isRight ? 'bg-ok text-white' : isWrong ? 'bg-danger text-white' : 'bg-raised text-ink-muted',
                )}
              >
                {isRight ? <CheckIcon className="size-4" /> : isWrong ? <CrossIcon className="size-4" /> : LETTERS[position]}
              </span>
              <span>{card.options[index]}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <>
          <div
            className={cn(
              'rounded-r-control border-l-4 px-3.5 py-3 text-[15px]',
              correct ? 'border-ok bg-ok/10' : 'border-danger bg-danger/10',
            )}
            aria-live="polite"
          >
            <b className={correct ? 'text-ok' : 'text-danger'}>{correct ? t.training.right : t.training.wrong}</b>{' '}
            {card.explanation}
            {card.ref && <p className="mt-1.5 font-mono text-[13px] text-ink-muted">{card.ref}</p>}
          </div>
          <button ref={nextRef} type="button" className={primaryButton} onClick={next}>
            {last ? t.training.finish : t.training.next}
          </button>
        </>
      )}
    </div>
  );
}
