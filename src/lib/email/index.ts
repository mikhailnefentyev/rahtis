import 'server-only';

import { emailProviderName } from './config';
import { resendProvider } from './resend';
import { stubProvider } from './stub';
import type { EmailMessage, EmailProvider, EmailResult } from './types';

export type { EmailAttachment, EmailMessage, EmailProvider, EmailResult } from './types';
export { emailFrom, emailReplyTo, operatorInbox } from './config';

/** Кто отправляет сейчас. Решает одна переменная окружения. */
export function getEmailProvider(): EmailProvider {
  return emailProviderName() === 'resend' ? resendProvider : stubProvider;
}

/**
 * Отправить письмо.
 *
 * Никогда не бросает: письмо — это дубль внутреннего уведомления, и
 * упавшая почта не должна отменять действие, которое её вызвало.
 * Одобрение компании состоялось даже тогда, когда письмо не ушло —
 * оператор увидит это в журнале и нажмёт «отправить повторно».
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  try {
    return await getEmailProvider().send(message);
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    console.error('почта: отправка сорвалась:', error);
    return { outboxId: null, sent: false, error };
  }
}
