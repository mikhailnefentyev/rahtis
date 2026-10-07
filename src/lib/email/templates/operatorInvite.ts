import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailMessage } from '../types';

/**
 * Приглашение от самой платформы — ежедневная рассылка оператора.
 *
 * Письмо уходит на общий адрес компании, опубликованный на её сайте.
 * В конце сказано, откуда адрес и как отказаться: ответить на письмо
 * (закон об электронной связи, 200 § — получателю-организации даётся
 * простой способ отказаться). Ответ приходит оператору, и строка
 * помечается OPTED_OUT.
 */
export function operatorInviteEmail(input: {
  to: string;
  kind: 'SHIPPER' | 'CARRIER';
  link: string;
  operatorEmail: string;
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);
  const i = t.operatorInvite[input.kind];

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    { kind: 'text', value: i.body },
    ...i.points.map((point): EmailBlock => ({ kind: 'text', value: `— ${point}` })),
    { kind: 'button', label: i.button, href: input.link },
    { kind: 'note', value: t.operatorInvite.note(input.operatorEmail) },
  ];

  return {
    template: input.kind === 'CARRIER' ? 'outreach.carrier' : 'outreach.shipper',
    to: input.to,
    subject: i.subject,
    text: renderText({ heading: i.heading, blocks, operatorEmail: input.operatorEmail, signature: t.signature, neverAsk: t.neverAsk }),
    html: renderEmail({
      heading: i.heading,
      preheader: i.preheader,
      blocks,
      operatorEmail: input.operatorEmail,
      tagline: t.brandTagline,
      neverAsk: t.neverAsk,
    }),
    companyId: null,
  };
}
