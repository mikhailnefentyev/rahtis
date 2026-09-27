'use client';

import { useEffect, useState } from 'react';
import { pushSubscribeAction, pushUnsubscribeAction } from '@/lib/driverApp/actions';
import { useI18n } from '@/lib/i18n/provider';

type State = 'loading' | 'unsupported' | 'denied' | 'off' | 'on';

/* Ключ VAPID в формате base64url — в байты для pushManager.subscribe. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Включить push-уведомления на этом телефоне.
 *
 * Разрешение браузер спрашивает только по нажатию — поэтому кнопка, а не
 * автоматический запрос при входе: отказ по привычке потом не отменить
 * из приложения. На iPhone push есть только у приложения, установленного
 * на экран «Домой», и здесь это сказано вместо кнопки, которая не
 * сработает.
 *
 * compact — карточка на главном экране: показывается, только пока
 * уведомления не включены, и не мешает, когда включены.
 */
export function PushSetup({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useI18n();
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const supported =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      let next: State;
      if (!supported || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) next = 'unsupported';
      else if (Notification.permission === 'denied') next = 'denied';
      else {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        next = subscription ? 'on' : 'off';
      }
      if (active) setState(next);
    })().catch(() => active && setState('unsupported'));
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }

      const registration =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register('/driver-sw.js', { scope: '/' }));
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const json = subscription.toJSON();

      const form = new FormData();
      form.set('locale', locale);
      form.set('endpoint', subscription.endpoint);
      form.set('p256dh', json.keys?.p256dh ?? '');
      form.set('auth', json.keys?.auth ?? '');
      const { ok } = await pushSubscribeAction(form);
      setState(ok ? 'on' : 'off');
    } catch {
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const form = new FormData();
        form.set('endpoint', subscription.endpoint);
        await pushUnsubscribeAction(form);
        await subscription.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return null;
  if (compact && state !== 'off') return null;

  return (
    <section className="rounded-card border border-line bg-surface px-4 py-3.5">
      <p className="text-[16px] font-semibold">{t.driverApp.pushTitle}</p>
      <p className="mt-1 text-[15px] text-ink-muted">
        {state === 'unsupported'
          ? t.driverApp.pushUnsupported
          : state === 'denied'
            ? t.driverApp.pushDenied
            : state === 'on'
              ? t.driverApp.pushOn
              : t.driverApp.pushHint}
      </p>

      {state === 'off' && (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="mt-3 h-12 w-full rounded-control bg-accent text-[16px] font-semibold text-accent-ink disabled:opacity-60"
        >
          {t.driverApp.pushEnable}
        </button>
      )}
      {state === 'on' && !compact && (
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="mt-3 h-12 w-full rounded-control border border-line text-[15px] font-semibold disabled:opacity-60"
        >
          {t.driverApp.pushDisable}
        </button>
      )}
    </section>
  );
}
