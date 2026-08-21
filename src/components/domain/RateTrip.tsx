'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { Button, RateStars, Stars, Textarea } from '@/components/ui';
import { rateOrderAction, type RatingState } from '@/lib/orders/rating';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Оценка перевозчика в карточке выполненного рейса (ТЗ §10).
 *
 * Звезда нажимается и сразу уходит: заставлять человека ткнуть звезду, а
 * потом ещё и «Сохранить», значит собрать половину оценок
 * незавершёнными. Поэтому действие вызывается напрямую, а не через
 * отправку формы — форма здесь всё равно была бы декорацией, звёзды не
 * работают без JavaScript.
 *
 * Комментарий отдельный и по желанию: он нужен там, где оценка низкая, и
 * требовать его от довольного заказчика незачем.
 *
 * Поставленную оценку видно и можно поправить. Промах по звезде
 * неизбежен, а неисправимая оценка заставляет звонить оператору — тому
 * самому, от звонков которому платформа и избавляет.
 */
export function RateTrip({
  orderId,
  score,
  comment,
  className,
}: {
  orderId: string;
  /** Уже поставленная оценка. NULL — рейс ещё не оценён. */
  score: number | null;
  comment: string | null;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const [state, rate, pending] = useActionState<RatingState, FormData>(rateOrderAction, {
    error: null,
    score: null,
  });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(comment ?? '');

  /* Свежепоставленная важнее пришедшей с сервера: она новее. */
  const current = state.score ?? score;

  function submit(stars: number, withComment: string) {
    const data = new FormData();
    data.set('locale', locale);
    data.set('order_id', orderId);
    data.set('score', String(stars));
    data.set('comment', withComment);
    rate(data);
  }

  return (
    <div className={className}>
      <p className="label-micro mb-2">{t.rating.rate}</p>

      <div className="flex flex-wrap items-center gap-3">
        <RateStars disabled={pending} onRate={(stars) => submit(stars, draft)} />

        {current != null && <Stars value={current} />}

        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs text-ink-faint underline underline-offset-2 hover:text-ink-muted"
          >
            {comment ? t.rating.editComment : t.rating.addComment}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <Textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.rating.commentPlaceholder}
            aria-label={t.rating.addComment}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={pending || current == null}
              onClick={() => current != null && submit(current, draft)}
            >
              {pending ? t.rating.saving : t.rating.save}
            </Button>
            {current == null && <span className="text-xs text-ink-dim">{t.rating.starFirst}</span>}
          </div>
        </div>
      )}

      {/* Комментарий, уже сохранённый раньше, виден и без раскрытия поля. */}
      {!open && comment && (
        <p className="mt-2 rounded-control border border-line bg-sunken px-3 py-2 text-xs text-ink-muted">
          {comment}
        </p>
      )}

      {state.error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}
