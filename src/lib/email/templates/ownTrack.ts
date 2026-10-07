import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailMessage } from '../types';

/**
 * Клиенту перевозчика: ссылка на ход его рейса.
 *
 * Письмо уходит, только если перевозчик указал почту клиента. Клиент
 * нас не знает, поэтому сказано, кто везёт и к кому идти с вопросами, —
 * к перевозчику: договор перевозки у них.
 */
export function ownTrackEmail(input: {
  to: string;
  carrierName: string;
  ref: string;
  route: string;
  link: string;
  operatorEmail: string;
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);
  const i = t.ownTrack;
  const heading = i.heading(input.carrierName);

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    { kind: 'text', value: i.body(input.carrierName) },
    ...(input.route ? [{ kind: 'text', value: i.route(input.route) } as EmailBlock] : []),
    { kind: 'button', label: i.button, href: input.link },
    { kind: 'note', value: i.note(input.carrierName) },
  ];

  return {
    template: 'own.track',
    to: input.to,
    subject: i.subject(input.carrierName, input.ref),
    text: renderText({ heading, blocks, operatorEmail: input.operatorEmail, signature: t.signature, neverAsk: t.neverAsk }),
    html: renderEmail({
      heading,
      preheader: i.preheader,
      blocks,
      operatorEmail: input.operatorEmail,
      tagline: t.brandTagline,
      neverAsk: t.neverAsk,
    }),
    companyId: null,
  };
}
