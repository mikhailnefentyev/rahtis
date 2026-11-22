'use client';

import { useActionState, useState } from 'react';
import { Button, Field, Textarea } from '@/components/ui';
import { TERMINATION_REASONS } from '@/lib/installments/access';
import { terminateDealAction, type ActionState } from '@/lib/installments/actions';
import type { InstallmentUiCopy } from '@/lib/installments/copy';

const initial: ActionState = { error: null, saved: false };

/**
 * Продавец записывает прекращение сделки в рассрочке (22.11.2026):
 * причина — забрал машину по закону или стороны договорились, — и
 * пояснение. Отменить запись нельзя, поэтому два шага, как у отметки
 * оплаты взноса (ActionForm): первая кнопка только раскрывает вопрос,
 * отправляет вторая.
 */
export function TerminateForm({ locale, ui, dealId }: { locale: string; ui: InstallmentUiCopy; dealId: string }) {
  const [state, action, pending] = useActionState(terminateDealAction, initial);
  const [asking, setAsking] = useState(false);
  const t = ui.termination;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="deal_id" value={dealId} />
      <fieldset className="flex flex-col gap-2 text-[14px]">
        <legend className="mb-1 text-ink-muted">{t.reason}</legend>
        {TERMINATION_REASONS.map((reason) => (
          <label key={reason} className="flex items-start gap-2">
            <input type="radio" name="reason" value={reason} required className="mt-1" />
            <span>{t.reasons[reason]}</span>
          </label>
        ))}
      </fieldset>
      <Field label={t.note}>{(p) => <Textarea {...p} name="note" rows={3} maxLength={2000} />}</Field>
      {state.error && !pending && (
        <p role="alert" className="text-[14px] text-danger">
          {state.error}
        </p>
      )}
      {/* Разные key: вторая кнопка — новый элемент, и нажатие первой не отправит форму. */}
      {!asking ? (
        <div>
          <Button
            key="ask"
            type="button"
            variant="danger"
            onClick={(e) => {
              /* Причина обязательна: вопрос задаём, только когда форма заполнена. */
              if (e.currentTarget.form?.reportValidity()) setAsking(true);
            }}
          >
            {t.submit}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full text-[14px] text-ink">{t.confirm}</span>
          <Button key="send" type="submit" variant="primary" disabled={pending}>
            {t.submit}
          </Button>
          <Button key="back" type="button" variant="ghost" disabled={pending} onClick={() => setAsking(false)}>
            {ui.deal.cancel}
          </Button>
        </div>
      )}
    </form>
  );
}
