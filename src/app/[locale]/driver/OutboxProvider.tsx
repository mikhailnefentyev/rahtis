'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { applyDriverEventAction } from '@/lib/driverApp/actions';
import { allEvents, deleteEvent, putEvent, type OutboxEvent, type OutboxKind } from '@/lib/driverApp/outbox';
import { useI18n } from '@/lib/i18n/provider';

type Outbox = {
  /** Ждут отправки, в порядке нажатия. */
  pending: OutboxEvent[];
  online: boolean;
  sending: boolean;
  /** Сколько действий база отклонила по существу с последнего показа. */
  rejected: number;
  enqueue: (kind: OutboxKind, fields: Record<string, string>, blob?: Blob) => Promise<void>;
  dismissRejected: () => void;
};

const Context = createContext<Outbox | null>(null);

/* Состояние сети — внешний источник, а не своё состояние компонента. */
function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOutbox(): Outbox {
  const outbox = useContext(Context);
  if (!outbox) throw new Error('useOutbox outside OutboxProvider');
  return outbox;
}

/**
 * Очередь действий водителя.
 *
 * Каждое нажатие сначала записывается на телефон, потом отправляется.
 * Без связи оно ждёт; попытки — сразу после нажатия, при появлении сети,
 * при возврате в приложение и раз в 20 секунд, пока очередь не пуста.
 *
 * Отправка строго по одному и по порядку: отметка точки не должна
 * обогнать прибытие на неё. Первая же неудача связи останавливает проход —
 * следующие события всё равно упёрлись бы в ту же сеть.
 */
export function OutboxProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState<OutboxEvent[]>([]);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [sending, setSending] = useState(false);
  const [rejected, setRejected] = useState(0);
  const busy = useRef(false);

  const reload = useCallback(async () => {
    try {
      setPending(await allEvents());
    } catch {
      /* IndexedDB недоступна (приватный режим) — очередь просто пуста. */
    }
  }, []);

  const flush = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setSending(true);

    let applied = false;
    try {
      for (const event of await allEvents()) {
        const form = new FormData();
        form.set('locale', locale);
        form.set('kind', event.kind);
        form.set('event_id', event.id);
        form.set('pressed_at', event.pressedAt);
        for (const [key, value] of Object.entries(event.fields)) form.set(key, value);
        if (event.blob) {
          form.set('file', new File([event.blob], 'photo', { type: event.blob.type || 'image/jpeg' }));
        }

        let status: 'ok' | 'rejected' | 'retry';
        try {
          status = (await applyDriverEventAction(form)).status;
        } catch {
          /* Запрос не дошёл: сети нет. Остальное подождёт вместе с ним. */
          status = 'retry';
        }

        if (status === 'retry') break;

        await deleteEvent(event.id);
        if (status === 'rejected') setRejected((n) => n + 1);
        applied = true;
      }
    } finally {
      busy.current = false;
      setSending(false);
      await reload();
    }

    if (applied) router.refresh();
  }, [locale, reload, router]);

  const enqueue = useCallback(
    async (kind: OutboxKind, fields: Record<string, string>, blob?: Blob) => {
      await putEvent({ id: crypto.randomUUID(), kind, fields, blob, pressedAt: new Date().toISOString() });
      await reload();
      void flush();
    },
    [flush, reload],
  );

  useEffect(() => {
    /* Что осталось в очереди с прошлого раза — показать и отправить. */
    allEvents()
      .then((events) => {
        setPending(events);
        void flush();
      })
      .catch(() => {});

    const up = () => void flush();
    const visible = () => {
      if (document.visibilityState === 'visible') void flush();
    };

    window.addEventListener('online', up);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('online', up);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [flush]);

  useEffect(() => {
    if (pending.length === 0) return;
    const id = setInterval(() => void flush(), 20_000);
    return () => clearInterval(id);
  }, [pending.length, flush]);

  return (
    <Context.Provider
      value={{ pending, online, sending, rejected, enqueue, dismissRejected: () => setRejected(0) }}
    >
      {children}
    </Context.Provider>
  );
}

/**
 * Полоса состояния связи над экраном. Молчит, когда всё отправлено и сеть
 * есть: водителю незачем знать про очередь, пока она пуста.
 */
export function OutboxBanner() {
  const { t, m } = useI18n();
  const { pending, online, sending, rejected, dismissRejected } = useOutbox();

  if (rejected > 0) {
    return (
      <button
        type="button"
        onClick={dismissRejected}
        className="mb-3 w-full rounded-card bg-danger/10 px-4 py-2.5 text-left text-[15px] text-danger"
      >
        {m('driverApp.rejected', { count: rejected })}
      </button>
    );
  }

  if (online && pending.length === 0) return null;

  return (
    <div
      role="status"
      className={
        online
          ? 'mb-3 rounded-card bg-accent-wash px-4 py-2.5 text-[15px] text-accent'
          : 'mb-3 rounded-card bg-warn/10 px-4 py-2.5 text-[15px] text-warn'
      }
    >
      {!online && <span className="font-semibold">{t.driverApp.offlineShort} · </span>}
      {pending.length > 0
        ? sending && online
          ? t.driverApp.sending
          : m('driverApp.queued', { count: pending.length })
        : t.driverApp.offlineStale}
    </div>
  );
}
