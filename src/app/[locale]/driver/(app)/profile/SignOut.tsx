'use client';

import { useRef } from 'react';
import { driverSignOutAction, pushUnsubscribeAction } from '@/lib/driverApp/actions';
import { clearEvents } from '@/lib/driverApp/outbox';
import { useI18n } from '@/lib/i18n/provider';
import { useOutbox } from '../../OutboxProvider';

/**
 * Выход из приложения.
 *
 * Очередь и кэш страниц чистятся до выхода: следующий, кто войдёт на
 * этом телефоне, не должен ни отправить чужие отметки, ни увидеть чужие
 * задания из кэша. Если в очереди что-то ждёт, об этом сказано до
 * нажатия — после выхода отправить это уже некому.
 *
 * Подписка на push снимается тоже (22.11.2026): на сервере — пока вход ещё
 * есть, в браузере — в любом случае. Иначе уведомления вышедшего водителя
 * приходили бы на этот телефон, а следующему экран говорил бы «включены».
 */
export function SignOut() {
  const { t, m, locale } = useI18n();
  const { pending } = useOutbox();
  const form = useRef<HTMLFormElement>(null);

  async function signOut() {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager?.getSubscription();
        if (subscription) {
          const body = new FormData();
          body.set('endpoint', subscription.endpoint);
          /* Нет сети — сервер узнает сам: служба push ответит, что подписки больше нет, и строка удалится. */
          await pushUnsubscribeAction(body).catch(() => {});
          await subscription.unsubscribe();
        }
      }
    } catch {
      /* Как и чистка ниже — забота, а не условие выхода. */
    }
    try {
      await clearEvents();
      if ('caches' in window) {
        for (const key of await caches.keys()) await caches.delete(key);
      }
    } catch {
      /* Чистка — забота, а не условие выхода. */
    }
    form.current?.requestSubmit();
  }

  return (
    <form ref={form} action={driverSignOutAction} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      {pending.length > 0 && (
        <p className="text-[15px] text-warn">{m('driverApp.pendingSignOut', { count: pending.length })}</p>
      )}
      <button
        type="button"
        onClick={signOut}
        className="h-14 w-full rounded-control border border-line bg-surface text-[16px] font-semibold text-danger"
      >
        {t.driverApp.signOut}
      </button>
    </form>
  );
}
