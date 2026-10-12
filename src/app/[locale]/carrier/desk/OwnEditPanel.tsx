'use client';

import { useActionState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { repriceOrderAction, type LifecycleState } from '@/lib/orders/lifecycle';
import { useI18n } from '@/lib/i18n/provider';
import { useKeepOnError } from '@/lib/forms/keepOnError';

/**
 * Пробег и цена своего рейса.
 *
 * У своего рейса заказчика с входом нет: клиент перевозчика — запись
 * справочника. Поправить опечатку в километрах или цене мог только
 * оператор (прогон 12.10.2026). Процента со своего рейса нет, так что
 * эти числа идут только в отчёт самого перевозчика, и править их ему.
 */

const initial: LifecycleState = { error: null, done: false };

export function OwnEditPanel({
  orderId,
  distanceKm,
  rateCents,
  className,
}: {
  orderId: string;
  distanceKm: number | null;
  rateCents: number | null;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(repriceOrderAction, initial);
  const keepFormAction = useKeepOnError(state);

  return (
    <form {...keepFormAction} action={formAction} className={className}>
      <p className="label-micro mb-2.5">{t.own.editTitle}</p>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t.orderForm.distance} className="w-32">
          {(p) => <Input {...p} name="distance_km" inputMode="numeric" required defaultValue={distanceKm ?? ''} />}
        </Field>
        <Field label={t.own.rateLabel} className="w-36">
          {(p) => (
            <Input
              {...p}
              name="rate"
              inputMode="decimal"
              required
              defaultValue={rateCents != null ? (rateCents / 100).toFixed(2) : ''}
            />
          )}
        </Field>
        <Button type="submit" size="sm" disabled={pending}>
          {t.own.editSave}
        </Button>
        {state.done && <span className="text-xs text-ok">{t.own.editSaved}</span>}
      </div>

      {state.error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
