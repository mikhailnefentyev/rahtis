'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui';
import { deleteOrderAction, type LifecycleState } from '@/lib/orders/lifecycle';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Кнопка настоящего удаления заказа.
 *
 * Отдельным клиентским компонентом на строку, а не одной формой на
 * список: отказ базы относится к конкретному заказу — «к нему приложены
 * документы», — и показывать его надо там же, где нажимали, а не общей
 * строкой наверху таблицы.
 *
 * Подтверждения диалогом нет намеренно. Список показывает только то, что
 * база вообще разрешает удалить: черновики, заказы со стола и снятые, ни
 * разу не попавшие в счёт. Всё остальное сюда не попадает, а на вопрос
 * «вы уверены?» через неделю отвечают не глядя.
 */

const initial: LifecycleState = { error: null, done: false };

export function DeleteOrderButton({ orderId }: { orderId: string }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(deleteOrderAction, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />

      <Button type="submit" size="sm" variant="danger" disabled={pending}>
        {pending ? t.lifecycle.removing : t.lifecycle.remove}
      </Button>

      {state.error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
