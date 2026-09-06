import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailMessage } from '../types';

/**
 * Приглашение в платформу.
 *
 * Язык — тот, что записан у компании: она указала его, подавая заявку.
 * Раньше письмо было финским всегда, и это было верно, пока рынок был
 * финским; датский экспедитор получил бы коды доступа на языке, которого
 * не знает, и без переключателя, какой есть у кабинета.
 *
 * Ссылка одноразовая и живёт сутки — это условие Supabase, а не наше.
 * Про это сказано прямо: человек, открывший письмо через неделю, должен
 * понимать, почему ссылка не работает, и что делать.
 *
 * Текстовая часть собирается из тех же блоков, что и вёрстка. Так они не
 * разъезжаются: переписать одно и забыть второе физически не выйдет.
 */
export function inviteEmail(input: {
  to: string;
  companyName: string;
  companyId: string;
  link: string;
  operatorEmail: string;
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);
  const heading = t.invite.heading(input.companyName);

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    { kind: 'text', value: t.invite.body },
    { kind: 'button', label: t.invite.button, href: input.link },
    { kind: 'note', value: t.invite.note(input.operatorEmail) },
  ];

  return {
    template: 'invite',
    to: input.to,
    subject: t.invite.subject(input.companyName),
    text: renderText({
      heading,
      blocks,
      operatorEmail: input.operatorEmail,
      signature: t.signature,
      neverAsk: t.neverAsk,
    }),
    html: renderEmail({
      heading,
      preheader: t.invite.preheader,
      blocks,
      operatorEmail: input.operatorEmail,
      tagline: t.brandTagline,
      neverAsk: t.neverAsk,
    }),
    companyId: input.companyId,
  };
}
