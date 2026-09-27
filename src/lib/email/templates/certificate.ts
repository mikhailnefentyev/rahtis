import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailMessage } from '../types';

/**
 * Срок удостоверения водителя подходит к концу — письмо перевозчику.
 *
 * Только срок и вид документа: никаких результатов тренажёра, их
 * перевозчик не получает ни в каком виде.
 */
export function certificateEmail(input: {
  to: string;
  companyId: string;
  locale: EmailLocale;
  driverName: string;
  typeLabel: string;
  expires: string;
  link: string;
  operatorEmail: string;
}): EmailMessage {
  const t = emailText(input.locale);
  const heading = t.certificate.heading(input.driverName);

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    { kind: 'text', value: t.certificate.lead(input.driverName, input.typeLabel, input.expires) },
    { kind: 'button', label: t.certificate.button, href: input.link },
    { kind: 'note', value: t.certificate.note },
  ];

  return {
    template: 'certificate.expiring',
    to: input.to,
    subject: t.certificate.subject(input.driverName, input.typeLabel),
    text: renderText({
      heading,
      blocks,
      operatorEmail: input.operatorEmail,
      signature: t.signature,
      neverAsk: t.neverAsk,
    }),
    html: renderEmail({
      heading,
      preheader: t.certificate.preheader(input.typeLabel, input.expires),
      blocks,
      operatorEmail: input.operatorEmail,
      tagline: t.brandTagline,
      neverAsk: t.neverAsk,
    }),
    companyId: input.companyId,
  };
}
