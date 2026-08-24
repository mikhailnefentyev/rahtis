import type { EmailMessage } from '../types';

/** Произвольное сообщение оператора компании. */
export function operatorNoticeEmail(input: {
  to: string;
  companyId: string;
  subject: string;
  body: string;
  operatorEmail: string;
}): EmailMessage {
  return {
    template: 'operator.notice',
    to: input.to,
    replyTo: input.operatorEmail,
    subject: `RAHTIS · ${input.subject}`,
    text: [input.body, '', '—', 'Aivomaa Oy · Y-tunnus 3592993-6', input.operatorEmail].join('\n'),
    companyId: input.companyId,
  };
}

/**
 * Вопрос из кабинета оператору.
 *
 * Адрес ответа — почта спросившего: оператор жмёт «ответить» и попадает
 * человеку, а не в noreply. Без этого переписка обрывается на первом же
 * ответе.
 */
export function supportEmail(input: {
  operatorInbox: string;
  fromEmail: string;
  companyName: string;
  companyId: string;
  role: string;
  subject: string;
  body: string;
}): EmailMessage {
  return {
    template: 'support.question',
    to: input.operatorInbox,
    replyTo: input.fromEmail,
    subject: `RAHTIS · kysymys: ${input.subject}`,
    text: [
      `Yritys : ${input.companyName}`,
      `Rooli  : ${input.role}`,
      `Osoite : ${input.fromEmail}`,
      '',
      input.body,
    ].join('\n'),
    companyId: input.companyId,
  };
}
