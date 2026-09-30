import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailMessage } from '../types';

/**
 * Перевозчик приглашает своего заказчика в RAHTIS.
 *
 * Письмо идёт человеку, который нас не знает, — поэтому в нём сказано,
 * кто пригласил, что это даёт, и что заявку проверяют. Ссылка ведёт на
 * заявку с уже заполненными полями; сама ссылка в базе не хранится.
 */
export function shipperInviteEmail(input: {
  to: string;
  carrierName: string;
  link: string;
  operatorEmail: string;
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);
  const i = t.shipperInvite;
  const heading = i.heading(input.carrierName);

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    { kind: 'text', value: i.body(input.carrierName) },
    ...i.points.map((point): EmailBlock => ({ kind: 'text', value: `— ${point}` })),
    { kind: 'button', label: i.button, href: input.link },
    { kind: 'note', value: i.note(input.operatorEmail) },
  ];

  return {
    template: 'shipper.invite',
    to: input.to,
    subject: i.subject(input.carrierName),
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
