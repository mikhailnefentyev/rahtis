'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui';
import type { ButtonVariant } from '@/components/ui/buttonClass';
import type { ActionState } from '@/lib/installments/actions';
import { cn } from '@/lib/cn';

const initial: ActionState = { error: null, saved: false };

/**
 * Кнопка-действие раздела рассрочки (22.11.2026): форма из одной кнопки,
 * которая показывает отказ рядом с собой. Раньше действие при ошибке
 * молча возвращалось, и страница перерисовывалась без единого слова.
 *
 * confirm — шаг подтверждения перед отправкой, как у снятия простоя
 * (DowntimeCard): первая кнопка только раскрывает вопрос, отправляет
 * вторая. Нужен там, где действие не отменить, — отметка оплаты взноса.
 */
export function ActionForm({
  action,
  fields,
  label,
  variant = 'default',
  confirm,
  className,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  /** Скрытые поля формы: locale, deal_id и т. п. */
  fields: Record<string, string | number>;
  label: string;
  variant?: ButtonVariant;
  confirm?: { text: string; cancel: string };
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, initial);
  const [asking, setAsking] = useState(false);

  return (
    <form action={run} className={cn('flex flex-wrap items-center gap-2', className)}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {confirm && !asking ? (
        <Button type="button" size="sm" variant={variant} onClick={() => setAsking(true)}>
          {label}
        </Button>
      ) : (
        <>
          {confirm && <span className="text-[13px] text-ink">{confirm.text}</span>}
          <Button type="submit" size="sm" variant={confirm ? 'primary' : variant} disabled={pending}>
            {label}
          </Button>
          {confirm && (
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setAsking(false)}>
              {confirm.cancel}
            </Button>
          )}
        </>
      )}
      {state.error && !pending && (
        <p role="alert" className="w-full text-[13px] text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
