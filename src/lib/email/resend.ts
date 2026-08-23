import 'server-only';

import { emailFrom, resendApiKey } from './config';
import { finishEmail, recordEmail } from './outbox';
import type { EmailMessage, EmailProvider, EmailResult } from './types';

/**
 * Адаптер Resend.
 *
 * Заготовка: тело запроса и разбор ответа написаны, ключа пока нет. Всё,
 * что нужно для включения, — RESEND_API_KEY и EMAIL_PROVIDER=resend в
 * окружении. Ни одно письмо при этом не меняется.
 *
 * Вложения пока не отправляются. Resend принимает их base64 в теле
 * запроса, а наши вложения лежат в Storage: понадобится скачать файл и
 * закодировать. Делать это до появления первого письма с вложением
 * незачем — недельный отчёт придёт вместе с этой работой.
 */
export const resendProvider: EmailProvider = {
  name: 'resend',

  async send(message: EmailMessage): Promise<EmailResult> {
    const outboxId = await recordEmail(message, 'resend');
    const key = resendApiKey();

    if (!key) {
      const error = 'RESEND_API_KEY не задан, письмо осталось в журнале';
      await finishEmail(outboxId, { status: 'FAILED', error });
      console.error('resend:', error);
      return { outboxId, sent: false, error };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom(),
          to: [message.to],
          reply_to: message.replyTo ?? undefined,
          subject: message.subject,
          text: message.text,
          html: message.html ?? undefined,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const error = `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`;
        await finishEmail(outboxId, { status: 'FAILED', error });
        return { outboxId, sent: false, error };
      }

      const body = (await response.json()) as { id?: string };
      await finishEmail(outboxId, { status: 'SENT', providerMessageId: body.id ?? null });
      return { outboxId, sent: true };
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      await finishEmail(outboxId, { status: 'FAILED', error });
      return { outboxId, sent: false, error };
    }
  },
};
