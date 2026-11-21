'use client';

import { useActionState } from 'react';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { confirmHandoverAction, type ActionState } from '@/lib/installments/actions';
import type { InstallmentUiCopy } from '@/lib/installments/copy';

const initial: ActionState = { error: null, saved: false };

/** Подтверждение передачи своей стороной: чек-лист договора 3.2, пробег, замечания. */
export function HandoverForm({
  locale,
  ui,
  dealId,
  odometer,
  notes,
}: {
  locale: string;
  ui: InstallmentUiCopy;
  dealId: string;
  odometer: string;
  notes: string;
}) {
  const [state, action, pending] = useActionState(confirmHandoverAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="deal_id" value={dealId} />
      <ul className="flex flex-col gap-2 text-[14px]">
        {ui.stage3.checklist.map((item, i) => (
          <li key={i}>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="check" value={String(i)} required className="mt-1" />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={ui.stage3.odometer}>
          {(p) => <Input {...p} name="odometer" inputMode="numeric" defaultValue={odometer} />}
        </Field>
      </div>
      <Field label={ui.stage3.notes}>
        {(p) => <Textarea {...p} name="notes" rows={3} maxLength={2000} defaultValue={notes} />}
      </Field>
      {state.error && <p className="text-[14px] text-danger">{state.error}</p>}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {ui.stage3.confirm}
        </Button>
      </div>
    </form>
  );
}
