import { renderEmail, renderText } from '../layout';
import type { EmailMessage } from '../types';
import { noticeContent, type NoticeLocale } from './noSubcontractText';

/** Имя шаблона в email_outbox: по нему скрипт рассылки узнаёт, кому уже ушло. */
export const NO_SUBCONTRACT_TEMPLATE = 'notice.no_subcontract';

/**
 * Перевозчику, которого перевели с подряда на абонемент (6.11.2026).
 *
 * Разовое письмо, шлёт его scripts/send-no-subcontract-notice.mts.
 * Reply-To ставится явно: письмо зовёт «ответьте на это письмо», а
 * Resend без него отправляет ответ на noreply-адрес отправителя.
 */
export function noSubcontractNoticeEmail(input: {
  to: string;
  companyName: string;
  /** null — пробная отправка на чужой адрес: в журнале не числится за компанией. */
  companyId: string | null;
  /** Полный адрес страницы абонемента, с префиксом языка. */
  link: string;
  operatorEmail: string;
  replyTo: string;
  locale: NoticeLocale;
  template?: string;
}): EmailMessage {
  const c = noticeContent(input.locale, input.link);

  return {
    template: input.template ?? NO_SUBCONTRACT_TEMPLATE,
    to: input.to,
    toName: input.companyName,
    replyTo: input.replyTo,
    subject: c.subject,
    text: renderText({
      heading: c.heading,
      blocks: c.blocks,
      operatorEmail: input.operatorEmail,
      signature: c.signature,
      neverAsk: c.neverAsk,
    }),
    html: renderEmail({
      heading: c.heading,
      preheader: c.preheader,
      blocks: c.blocks,
      operatorEmail: input.operatorEmail,
      tagline: c.tagline,
      neverAsk: c.neverAsk,
    }),
    companyId: input.companyId,
  };
}
