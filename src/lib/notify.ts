import 'server-only';

import { sendEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

/**
 * Событие для стороны: в кабинет обязательно, на почту по возможности.
 *
 * Два канала, и порядок между ними не симметричный. Уведомление в
 * кабинете пишется первым и считается состоявшимся: оно живёт в нашей
 * базе и не зависит ни от одного внешнего сервиса. Письмо идёт следом и
 * может не дойти — спам-фильтр, переполненный ящик, домен в списке.
 *
 * Поэтому текст уведомления самодостаточен. «Подробности в письме» —
 * запрещённая формулировка: письма может не быть.
 */

export type NotificationKind = Database['public']['Enums']['notification_kind'];

type NotifyInput = {
  companyId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  /** Куда вести в кабинете: относительный путь без языка, '/carrier/desk'. */
  link?: string | null;
  /** Дублировать письмом. Нужен адрес — без него канал просто не используется. */
  email?: {
    to: string | null | undefined;
    toName?: string | null;
    template: string;
    subject: string;
    text: string;
    html?: string | null;
  };
};

export type NotifyResult = {
  notificationId: number | null;
  emailSent: boolean;
};

export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const admin = createAdminClient();

  /*
   * Прямая вставка служебным ключом, а не через notify_company.
   *
   * Та функция требует app.is_admin(), а служебный ключ его не проходит:
   * за ним нет пользователя, у которого есть роль. Она нужна админке,
   * где действует живой оператор. Здесь же уведомление пишет сам код —
   * почти всегда чужой компании, к которой у вызвавшего нет отношения.
   */
  const { data, error } = await admin
    .from('notifications')
    .insert({
      company_id: input.companyId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    })
    .select('id')
    .single();

  const notificationId = data?.id ?? null;

  if (error) {
    console.error('уведомление не записано:', error.message);
  }

  if (!input.email?.to) {
    return { notificationId, emailSent: false };
  }

  const result = await sendEmail({
    template: input.email.template,
    to: input.email.to,
    toName: input.email.toName ?? null,
    subject: input.email.subject,
    text: input.email.text,
    html: input.email.html ?? null,
    companyId: input.companyId,
  });

  return { notificationId, emailSent: result.sent };
}
