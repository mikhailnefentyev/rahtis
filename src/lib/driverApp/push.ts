import 'server-only';

import webpush from 'web-push';
import { getI18n } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Отправка push-уведомления водителю.
 *
 * Зовёт маршрут /api/push/driver по сигналу из базы (триггер
 * driver_notifications_push). Текст собирается здесь, на языке, в котором
 * водитель пользуется приложением: в базе лежат только код события и
 * подстановки — так же, как у уведомлений кабинета.
 *
 * Подписка, которую служба push объявила мёртвой (404/410 — приложение
 * удалено, разрешение снято), удаляется: слать в неё незачем.
 */

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@rahtis.eu';

  configured = Boolean(publicKey && privateKey);
  if (configured) webpush.setVapidDetails(subject, publicKey!, privateKey!);
  return configured;
}

export type PushResult = { sent: number; removed: number; skipped?: string };

export async function sendDriverPush(notificationId: number): Promise<PushResult> {
  if (!configure()) return { sent: 0, removed: 0, skipped: 'VAPID keys are not set' };

  const admin = createAdminClient();

  const { data: note } = await admin
    .from('driver_notifications')
    .select('id, driver_id, code, params, order_id')
    .eq('id', notificationId)
    .maybeSingle();
  if (!note) return { sent: 0, removed: 0, skipped: 'notification not found' };

  const { data: subscriptions } = await admin
    .from('driver_push_subscriptions')
    .select('id, endpoint, p256dh, auth, locale')
    .eq('driver_id', note.driver_id);

  let sent = 0;
  let removed = 0;

  for (const sub of subscriptions ?? []) {
    const { t, m } = await getI18n(sub.locale === 'en' ? 'en' : 'fi');

    let body: string;
    try {
      body = m(`driverEvent.${note.code}` as Parameters<typeof m>[0], (note.params ?? {}) as Record<string, string>);
    } catch {
      body = note.code;
    }

    const payload = JSON.stringify({
      title: t.driverApp.title,
      body,
      url: note.order_id ? `/${sub.locale}/driver/task/${note.order_id}` : `/${sub.locale}/driver/inbox`,
      tag: note.order_id ?? `note-${note.id}`,
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 24, urgency: 'high' },
      );
      sent += 1;
      await admin
        .from('driver_push_subscriptions')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', sub.id);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin.from('driver_push_subscriptions').delete().eq('id', sub.id);
        removed += 1;
      } else {
        console.error('push не ушёл:', status, error instanceof Error ? error.message : error);
      }
    }
  }

  return { sent, removed };
}
