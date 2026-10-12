import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailMessage } from '../types';

/**
 * Приглашение диспетчера в кабинет компании.
 *
 * Зовёт не платформа, а главный пользователь его же компании, поэтому в
 * письме названа компания, а с просроченной ссылкой человек идёт к нему,
 * а не к оператору: новое приглашение выдаёт главный.
 */
export function memberInviteEmail(input: {
  to: string;
  toName?: string | null;
  companyName: string;
  companyId: string;
  link: string;
  operatorEmail: string;
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);
  const i = t.memberInvite;
  const heading = i.heading(input.companyName);

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    { kind: 'text', value: i.body(input.companyName) },
    { kind: 'button', label: i.button, href: input.link },
    { kind: 'note', value: i.note },
  ];

  return {
    template: 'member.invite',
    to: input.to,
    toName: input.toName ?? null,
    subject: i.subject(input.companyName),
    text: renderText({
      heading,
      blocks,
      operatorEmail: input.operatorEmail,
      signature: t.signature,
      neverAsk: t.neverAsk,
    }),
    html: renderEmail({
      heading,
      preheader: i.preheader,
      blocks,
      operatorEmail: input.operatorEmail,
      tagline: t.brandTagline,
      neverAsk: t.neverAsk,
    }),
    companyId: input.companyId,
  };
}
