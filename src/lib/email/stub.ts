import 'server-only';

import { finishEmail, recordEmail } from './outbox';
import type { EmailMessage, EmailProvider, EmailResult } from './types';

/**
 * Провайдер по умолчанию: письмо готовится полностью, но не уходит.
 *
 * Это не «ничего не делать». Письмо собирается тем же кодом, что будет
 * работать в бою, проходит те же проверки и ложится в журнал — там его
 * можно прочитать целиком и убедиться, что тема, адрес и ссылка верны.
 * Заглушка отличается ровно одним: не зовёт внешний сервис.
 *
 * Статус SKIPPED, а не SENT: иначе журнал будет врать, что письма ушли.
 */
export const stubProvider: EmailProvider = {
  name: 'stub',

  async send(message: EmailMessage): Promise<EmailResult> {
    const outboxId = await recordEmail(message, 'stub');
    await finishEmail(outboxId, { status: 'SKIPPED' });

    console.info(
      [
        '',
        '─── письмо не отправлено (провайдер: stub) ───',
        `шаблон : ${message.template}`,
        `кому   : ${message.toName ? `${message.toName} <${message.to}>` : message.to}`,
        `тема   : ${message.subject}`,
        message.attachments?.length ? `вложения: ${message.attachments.length}` : null,
        '',
        message.text,
        '──────────────────────────────────────────────',
      ]
        .filter((line) => line !== null)
        .join('\n'),
    );

    return { outboxId, sent: false };
  },
};
