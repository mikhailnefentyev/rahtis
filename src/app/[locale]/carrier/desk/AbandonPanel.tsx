'use client';

import { useActionState, useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { abandonOrderAction, type LifecycleState } from '@/lib/orders/lifecycle';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Отказ от взятого рейса.
 *
 * До сих пор перевозчик, подтвердивший рейс, не мог сказать платформе
 * ничего. Сломалась машина в два часа ночи — звонить диспетчеру и ждать
 * утра, пока заказ числится идущим и заказчик считает, что груз едет.
 *
 * Куда уйдёт заказ, решает не эта кнопка, а состояние груза: пока ни
 * одна точка не пройдена, рейс возвращается на стол и его берёт кто-то
 * другой; если прицеп уже в дороге, заказ снимается и дальше это работа
 * диспетчера. Выбора здесь нет намеренно — иначе перевозчик решал бы за
 * заказчика, можно ли ещё передать рейс.
 *
 * Кнопка стоит внизу карточки и открывается в два шага. Отказ — не
 * рабочий ход, и место рядом с «отметить точку» приглашало бы нажать её
 * по ошибке большим пальцем в кабине.
 */

const initial: LifecycleState = { error: null, done: false };

export function AbandonPanel({ orderId, className }: { orderId: string; className?: string }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(abandonOrderAction, initial);

  if (!open) {
    return (
      <div className={className}>
        <Button type="button" size="sm" variant="danger" onClick={() => setOpen(true)}>
          {t.lifecycle.abandon}
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className={className}>
      <p className="mb-3 text-xs text-ink-muted">{t.lifecycle.abandonHint}</p>

      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />

      {/*
        * Причина не обязательна для базы, но спрашивается всегда: она
        * уходит в журнал заказа, и заказчик, у которого рейс сорвался,
        * прочитает именно её. Пустое поле честнее выдуманной причины,
        * поэтому required здесь нет.
        */}
      <Field label={t.lifecycle.reason}>
        {(p) => <Input {...p} name="reason" placeholder={t.lifecycle.reasonPlaceholder} />}
      </Field>

      {state.error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={() => setOpen(false)}>
          {t.action.cancel}
        </Button>
        <Button type="submit" size="sm" variant="danger" disabled={pending}>
          {pending ? t.lifecycle.abandoning : t.lifecycle.abandon}
        </Button>
      </div>
    </form>
  );
}
