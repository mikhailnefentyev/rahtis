import { renderEmail, renderText, type EmailBlock } from '../layout';
import type { EmailMessage } from '../types';

/** Произвольное сообщение оператора компании. */
export function operatorNoticeEmail(input: {
  to: string;
  companyId: string;
  subject: string;
  body: string;
  operatorEmail: string;
}): EmailMessage {
  /*
   * Оператор пишет живым текстом, и абзацы в нём настоящие. Разбираем по
   * пустой строке: слепить всё в один блок значило бы потерять то
   * членение, которое человек задал сам.
   */
  const blocks: EmailBlock[] = input.body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((value) => ({ kind: 'text', value }));

  return {
    template: 'operator.notice',
    to: input.to,
    replyTo: input.operatorEmail,
    subject: `RAHTIS · ${input.subject}`,
    text: renderText({ heading: input.subject, blocks, operatorEmail: input.operatorEmail }),
    html: renderEmail({
      heading: input.subject,
      preheader: input.body.slice(0, 120),
      blocks,
      operatorEmail: input.operatorEmail,
    }),
    companyId: input.companyId,
  };
}

/**
 * Вопрос из кабинета оператору.
 *
 * Адрес ответа — почта спросившего: оператор жмёт «ответить» и попадает
 * человеку, а не в noreply. Без этого переписка обрывается на первом же
 * ответе.
 *
 * Это письмо читает свой, а не клиент, поэтому оформление здесь скромнее
 * по смыслу: важно, чтобы «кто спросил» стояло отдельной строкой и не
 * тонуло в тексте вопроса.
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
  const blocks: EmailBlock[] = [
    {
      kind: 'facts',
      rows: [
        ['Yritys', input.companyName],
        ['Rooli', input.role],
        ['Osoite', input.fromEmail],
      ],
    },
    { kind: 'text', value: input.body },
  ];

  return {
    template: 'support.question',
    to: input.operatorInbox,
    replyTo: input.fromEmail,
    subject: `RAHTIS · kysymys: ${input.subject}`,
    text: renderText({
      heading: input.subject,
      blocks,
      operatorEmail: input.operatorInbox,
      incoming: true,
    }),
    html: renderEmail({
      heading: input.subject,
      preheader: `${input.companyName} · ${input.fromEmail}`,
      blocks,
      operatorEmail: input.operatorInbox,
      incoming: true,
    }),
    companyId: input.companyId,
  };
}
