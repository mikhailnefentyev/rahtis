/**
 * Почта платформы: один интерфейс, две реализации.
 *
 * Провайдер меняется одной переменной окружения. Всё остальное — тексты,
 * получатели, темы, вложения — от провайдера не зависит и написано один
 * раз, поэтому переключение заглушки на Resend не требует трогать ни
 * одного письма.
 */

/** Вложение ссылкой на Storage, а не байтами: см. комментарий к email_outbox. */
export type EmailAttachment = {
  bucket: string;
  path: string;
  filename: string;
};

export type EmailMessage = {
  /** Какой шаблон породил письмо: 'invite', 'weekly_report', 'billing.invoiced'. */
  template: string;
  to: string;
  toName?: string | null;
  /** Куда придёт ответ. Для вопроса оператору — почта спросившего. */
  replyTo?: string | null;
  subject: string;
  text: string;
  html?: string | null;
  attachments?: EmailAttachment[];
  /** Кому письмо относится. Нужно, чтобы журнал можно было читать по компании. */
  companyId?: string | null;
};

export type EmailResult = {
  /** Строка в email_outbox. Есть всегда, даже когда отправка не удалась. */
  outboxId: number | null;
  sent: boolean;
  error?: string;
};

export interface EmailProvider {
  /** Как называется в журнале: 'stub' | 'resend'. */
  readonly name: string;
  send(message: EmailMessage): Promise<EmailResult>;
}
