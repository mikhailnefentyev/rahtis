import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { EMAIL_LOCALE, emailFrom, emailReplyTo } from './config';
import type { EmailMessage } from './types';

/**
 * Журнал писем.
 *
 * Пишет сюда общий слой, а не конкретный провайдер: строка появляется
 * ДО попытки отправки. Поэтому упавший провайдер, просроченный ключ и
 * отвалившаяся сеть оставляют след, а не тишину — и письмо можно
 * отправить повторно, ничего не собирая заново.
 *
 * Служебным ключом, а не сессией пользователя: письма пишутся и в тех
 * действиях, где пользователя нет вовсе — по расписанию, из очереди.
 */

export type OutboxRow = {
  id: number;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
};

/** Кладёт письмо в журнал со статусом PENDING и возвращает его id. */
export async function recordEmail(
  message: EmailMessage,
  provider: string,
): Promise<number | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('email_outbox')
    .insert({
      template: message.template,
      locale: EMAIL_LOCALE,
      from_email: emailFrom(),
      reply_to: message.replyTo ?? emailReplyTo(),
      to_email: message.to,
      to_name: message.toName ?? null,
      subject: message.subject,
      body_text: message.text,
      body_html: message.html ?? null,
      attachments: message.attachments ?? [],
      company_id: message.companyId ?? null,
      provider,
    })
    .select('id')
    .single();

  if (error) {
    /*
     * Журнал не должен ронять действие, которое его вызвало. Одобрение
     * компании важнее записи о письме, поэтому здесь консоль, а не
     * исключение.
     */
    console.error('email_outbox: строка не записана:', error.message);
    return null;
  }

  return data.id;
}

/** Отмечает исход отправки. Без id — писать некуда, и это не ошибка. */
export async function finishEmail(
  outboxId: number | null,
  outcome:
    | { status: 'SENT'; providerMessageId?: string | null }
    | { status: 'FAILED'; error: string }
    | { status: 'SKIPPED' },
): Promise<void> {
  if (outboxId === null) return;

  const admin = createAdminClient();

  const { error } = await admin
    .from('email_outbox')
    .update({
      status: outcome.status,
      attempts: 1,
      sent_at: outcome.status === 'SENT' ? new Date().toISOString() : null,
      provider_message_id: outcome.status === 'SENT' ? (outcome.providerMessageId ?? null) : null,
      error: outcome.status === 'FAILED' ? outcome.error.slice(0, 1000) : null,
    })
    .eq('id', outboxId);

  if (error) {
    console.error('email_outbox: исход не записан:', error.message);
  }
}
