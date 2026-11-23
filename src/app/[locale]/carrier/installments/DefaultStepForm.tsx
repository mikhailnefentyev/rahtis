'use client';

import { useActionState, useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { recordDefaultStepAction, type ActionState } from '@/lib/installments/actions';
import { fill } from '@/lib/installments/copy';
import type { DefaultStepsCopy } from '@/lib/installments/countryTexts/defaultSteps';
import { graceDeadline, type DefaultStep, type DefaultStepPlan } from '@/lib/installments/defaultSteps';

const initial: ActionState = { error: null, saved: false };

/**
 * Продавец записывает шаг после порога просрочки (24.11.2026): день письма
 * (не позже сегодняшнего), у срока — последний день оплаты по правилу страны
 * (graceDeadline, тот же расчёт делает сервер). Предупреждение (срок ещё идёт,
 * порог по данным платформы не достигнут) не запрещает шаг: нужен флажок.
 */
export function DefaultStepForm({
  locale,
  dealId,
  step,
  plan,
  today,
  label,
  warning,
  t,
  formatDate,
}: {
  locale: string;
  dealId: string;
  step: DefaultStep;
  plan: DefaultStepPlan;
  today: string;
  label: string;
  warning: string | null;
  t: DefaultStepsCopy;
  /** Вид дат страны сделки: «ГГГГ-ММ-ДД» (Швеция, Литва), «5.1.2027» (Финляндия) или «05.01.2027». */
  formatDate: 'iso' | 'short' | 'padded';
}) {
  const [state, action, pending] = useActionState(recordDefaultStepAction, initial);
  const [givenOn, setGivenOn] = useState(today);
  const deadline = step === 'GRACE' && /^\d{4}-\d{2}-\d{2}$/.test(givenOn) ? graceDeadline(plan, givenOn) : null;
  const show = (iso: string) => {
    if (formatDate === 'iso') return iso;
    const [y, m, d] = iso.split('-');
    return formatDate === 'short' ? `${Number(d)}.${Number(m)}.${y}` : `${d}.${m}.${y}`;
  };

  return (
    <form action={action} className="flex flex-col gap-3 rounded-card border border-line p-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="step" value={step} />
      <p className="font-semibold">{label}</p>
      <div className="max-w-[220px]">
        <Field label={t.sentOn}>
          {(p) => <Input {...p} type="date" name="given_on" value={givenOn} max={today} required onChange={(e) => setGivenOn(e.target.value)} />}
        </Field>
      </div>
      {deadline && (
        <p className="text-[14px]">
          {fill(t.deadline, { deadline: show(deadline) })} <span className="text-ink-muted">{t.holidayHint}</span>
        </p>
      )}
      {warning && (
        <div className="rounded-card border border-warn/35 bg-warn/10 px-3 py-2 text-[14px] text-warn">
          <p>{warning}</p>
          <label className="mt-2 flex items-start gap-2 text-ink">
            <input type="checkbox" name="confirm" value="1" required className="mt-1" />
            <span>{t.confirm}</span>
          </label>
        </div>
      )}
      {state.error && !pending && (
        <p role="alert" className="text-[14px] text-danger">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {t.record}
        </Button>
      </div>
    </form>
  );
}
