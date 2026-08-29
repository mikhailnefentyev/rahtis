import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { emailFrom, resendApiKey } from './config';
import { finishEmail, recordEmail } from './outbox';
import type { EmailAttachment, EmailMessage, EmailProvider, EmailResult } from './types';

/** Ограничение Resend — 40 МБ на письмо. Держимся заметно ниже. */
const ATTACHMENT_LIMIT_BYTES = 8 * 1024 * 1024;

/**
 * Файлы из Storage в вид, который понимает Resend.
 *
 * Вложения хранятся ссылкой, а Resend принимает их base64 в теле
 * запроса, поэтому файл скачивается служебным ключом и кодируется здесь.
 * В журнале ссылка остаётся ссылкой: письмо уносит копию, а не файл.
 *
 * Недостающий файл не отменяет письмо. Отчёт без вложения — плохо, но
 * молчание вместо отчёта хуже: получатель хотя бы узнает, что неделя
 * закрыта, и заберёт PDF из кабинета.
 */
async function packAttachments(list: EmailAttachment[]) {
  const supabase = createAdminClient();
  const packed: Array<{ filename: string; content: string }> = [];

  for (const item of list) {
    const { data, error } = await supabase.storage.from(item.bucket).download(item.path);

    if (error || !data) {
      console.error('resend: вложение не скачалось:', item.path, error?.message);
      continue;
    }

    const bytes = Buffer.from(await data.arrayBuffer());

    if (bytes.byteLength > ATTACHMENT_LIMIT_BYTES) {
      console.error('resend: вложение больше предела, пропущено:', item.path);
      continue;
    }

    packed.push({ filename: item.filename, content: bytes.toString('base64') });
  }

  return packed;
}

/**
 * Адаптер Resend.
 *
 * Включается двумя переменными: EMAIL_PROVIDER=resend и RESEND_API_KEY.
 * Ни одно письмо при этом не меняется — тексты, получатели и вложения
 * написаны один раз и от провайдера не зависят.
 *
 * Запись в журнал идёт ДО отправки и остаётся там при любом исходе.
 * Порядок принципиален: письмо, о котором нет записи, невозможно ни
 * найти, ни отправить повторно, а провайдер отвечает не всегда.
 *
 * Библиотека Resend не используется намеренно. Весь их SDK для нашей
 * задачи — это один POST с JSON, который написан ниже; зависимость дала
 * бы обновления, ломающие сборку, и ничего взамен.
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
      const attachments = message.attachments?.length
        ? await packAttachments(message.attachments)
        : [];

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
          attachments: attachments.length ? attachments : undefined,
        }),
        /* Файлы кодируются в base64, и письмо с отчётом весит мегабайты. */
        signal: AbortSignal.timeout(30_000),
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
