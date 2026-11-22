'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { applyDriverEventAction } from '@/lib/driverApp/actions';
import { allEvents, deleteEvent, putEvent, type OutboxEvent, type OutboxKind } from '@/lib/driverApp/outbox';
import { afterFailure, blobFits, reloadedRecently } from '@/lib/driverApp/outboxPolicy';
import { useI18n } from '@/lib/i18n/provider';

type Outbox = {
  /** Ждут отправки, в порядке нажатия. */
  pending: OutboxEvent[];
  online: boolean;
  sending: boolean;
  /** Сколько действий база отклонила по существу с последнего показа. */
  rejected: number;
  /** Последнее нажатие не записано и не отправлено — показать ошибку. */
  problem: boolean;
  /**
   * Записать действие и отправить. false — действие не принято вовсе
   * (файл слишком тяжёлый; очередь недоступна, а напрямую не ушло):
   * экран не должен вести себя так, будто оно сохранено.
   */
  enqueue: (kind: OutboxKind, fields: Record<string, string>, blob?: Blob) => Promise<boolean>;
  dismissRejected: () => void;
  dismissProblem: () => void;
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

/* Форма серверного действия из записи очереди. */
function formOf(event: OutboxEvent, locale: string): FormData {
  const form = new FormData();
  form.set('locale', locale);
  form.set('kind', event.kind);
  form.set('event_id', event.id);
  form.set('pressed_at', event.pressedAt);
  for (const [key, value] of Object.entries(event.fields)) form.set(key, value);
  if (event.blob) {
    form.set('file', new File([event.blob], 'photo', { type: event.blob.type || 'image/jpeg' }));
  }
  return form;
}

/**
 * Есть ли связь с сайтом на самом деле. navigator.onLine говорит только
 * про сеть телефона, а в порту она часто «есть», но не работает. Манифест
 * приложения — маленький статический файл мимо service worker: ответил
 * сайт (любым кодом) — связь есть, и неудача запроса не из-за сети.
 */
async function siteReachable(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    await fetch('/driver.webmanifest', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Запрос оборвала сеть (fetch отвечает на это TypeError, обрыв по времени —
 * AbortError), а не сервер. В порту маленький запрос часто проходит, а
 * снимок на два мегабайта — нет: это «нет связи», и считать такую неудачу
 * против действия нельзя — иначе снимок-доказательство пропустили бы.
 */
function networkError(error: unknown): boolean {
  return error instanceof TypeError || (error as { name?: string } | null)?.name === 'AbortError';
}

/* Отметка «страницу перезагружали»: переживает перезагрузку, но не закрытие приложения. */
const RELOAD_MARK = 'rahtis-driver-outbox-reload';

function reloadMark(): string | null {
  try {
    return sessionStorage.getItem(RELOAD_MARK);
  } catch {
    return null;
  }
}

function markReload(now: number): boolean {
  try {
    sessionStorage.setItem(RELOAD_MARK, String(now));
    return sessionStorage.getItem(RELOAD_MARK) === String(now);
  } catch {
    return false;
  }
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
 *
 * 22.11.2026. Неудача при живой сети — не «нет связи»: такое действие
 * считается (outboxPolicy), после трёх неудач страница один раз
 * перезагружается, а если не помогло — действие пропускается как «не
 * принято», и очередь идёт дальше. Потерян вход водителя — очередь
 * остаётся на телефоне и ждёт входа. Не записалось в очередь (нет места,
 * приватный режим) — действие уходит напрямую, а не пропадает молча.
 */
export function OutboxProvider({ driverId, children }: { driverId: string; children: React.ReactNode }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState<OutboxEvent[]>([]);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [sending, setSending] = useState(false);
  const [rejected, setRejected] = useState(0);
  const [problem, setProblem] = useState(false);
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
    let signIn = false;
    let reloadPage = false;
    try {
      for (const event of await allEvents()) {
        /* Действие прежнего водителя этого телефона: от имени нынешнего оно уйти не должно. */
        if (event.driverId && event.driverId !== driverId) {
          await deleteEvent(event.id);
          continue;
        }

        /* Тяжёлый файл из очереди прежней версии: сервер его не примет никогда — «не принято», очередь идёт дальше. */
        if (!blobFits(event.blob?.size)) {
          await deleteEvent(event.id);
          setRejected((n) => n + 1);
          applied = true;
          continue;
        }

        let status: 'ok' | 'rejected' | 'retry' | 'signin' | 'offline' | 'failed';
        try {
          status = (await applyDriverEventAction(formOf(event, locale))).status;
        } catch (error) {
          /*
           * Запрос не прошёл. Оборвала сеть или сайт не отвечает — остальное
           * подождёт вместе с ним; сервер ответил отказом при живой сети —
           * дело в самом запросе (outboxPolicy).
           */
          status = !networkError(error) && (await siteReachable()) ? 'failed' : 'offline';
        }

        if (status === 'retry' || status === 'offline') break;

        if (status === 'signin') {
          /* Вход потерян: очередь остаётся, а экран входа покажет раскладка после обновления. */
          signIn = true;
          break;
        }

        if (status === 'failed') {
          const now = Date.now();
          const { step, state } = afterFailure(event.delivery, now, reloadedRecently(reloadMark(), now));
          if (step === 'skip') {
            /* Не уходит и после перезагрузки: «не принято», и очередь идёт дальше. */
            await deleteEvent(event.id);
            setRejected((n) => n + 1);
            applied = true;
            continue;
          }
          let saved = true;
          try {
            await putEvent({ ...event, delivery: state });
          } catch {
            saved = false;
          }
          /*
           * Перезагрузка — только если отметка о ней записалась хоть куда-то
           * (в запись очереди или в sessionStorage): без отметки страница
           * перезагружалась бы по кругу.
           */
          if (step === 'reload' && (markReload(now) || saved)) reloadPage = true;
          break;
        }

        await deleteEvent(event.id);
        if (status === 'rejected') setRejected((n) => n + 1);
        applied = true;
      }
    } finally {
      busy.current = false;
      setSending(false);
      await reload();
    }

    if (reloadPage) {
      /* Новая версия сайта: старая страница зовёт действия, которых сервер уже не знает. */
      window.location.reload();
      return;
    }
    if (applied || signIn) router.refresh();
  }, [driverId, locale, reload, router]);

  const enqueue = useCallback(
    async (kind: OutboxKind, fields: Record<string, string>, blob?: Blob) => {
      setProblem(false);

      /*
       * Снимок не сжался (compressPhoto вернул исходник) или PDF вышел
       * тяжёлым: площадка такой запрос не примет никогда, и он стоял бы в
       * очереди первым, не пуская остальные. Лучше сказать сразу.
       */
      if (!blobFits(blob?.size)) {
        setProblem(true);
        return false;
      }

      const event: OutboxEvent = {
        id: crypto.randomUUID(),
        kind,
        fields,
        blob,
        pressedAt: new Date().toISOString(),
        driverId,
      };

      try {
        await putEvent(event);
      } catch {
        /*
         * IndexedDB недоступна или переполнена: раньше кнопка возвращалась
         * в обычный вид, а действие не было записано нигде. Отправляем
         * напрямую (сначала то, что уже ждёт, — порядок важен); не ушло —
         * говорим об этом.
         */
        await flush();
        let status: 'ok' | 'rejected' | 'retry' | 'signin' | 'failed';
        try {
          status = (await applyDriverEventAction(formOf(event, locale))).status;
        } catch {
          status = 'failed';
        }
        if (status === 'ok' || status === 'rejected') {
          if (status === 'rejected') setRejected((n) => n + 1);
          router.refresh();
          return true;
        }
        if (status === 'signin') router.refresh();
        setProblem(true);
        return false;
      }

      await reload();
      void flush();
      return true;
    },
    [driverId, flush, locale, reload, router],
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
      value={{
        pending,
        online,
        sending,
        rejected,
        problem,
        enqueue,
        dismissRejected: () => setRejected(0),
        dismissProblem: () => setProblem(false),
      }}
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
  const { pending, online, sending, rejected, problem, dismissRejected, dismissProblem } = useOutbox();

  /* Нажатие не записано и не отправлено — важнее всего остального: водитель должен повторить. */
  if (problem) {
    return (
      <button
        type="button"
        role="alert"
        onClick={dismissProblem}
        className="mb-3 w-full rounded-card bg-danger/10 px-4 py-2.5 text-left text-[15px] font-semibold text-danger"
      >
        {online ? t.driverApp.failed : t.driverApp.offline}
      </button>
    );
  }

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
