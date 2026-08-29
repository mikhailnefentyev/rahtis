import { renderEmail, renderText, type EmailBlock } from '../layout';
import type { EmailMessage } from '../types';

/**
 * Приглашение в платформу.
 *
 * По-фински и без вариантов языка: рынок финский, а английский кабинет
 * существует для тех, кто читает интерфейс, а не для переписки.
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
}): EmailMessage {
  const heading = `${input.companyName} on hyväksytty RAHTIS-palveluun`;

  const blocks: EmailBlock[] = [
    { kind: 'text', value: 'Hei,' },
    {
      kind: 'text',
      value:
        'Yrityksenne tiedot on tarkistettu ja pääsy palveluun on avattu. ' +
        'Aseta salasana alla olevasta linkistä, niin pääset kirjautumaan sisään.',
    },
    { kind: 'button', label: 'Aseta salasana', href: input.link },
    {
      kind: 'note',
      value:
        'Linkki on kertakäyttöinen ja voimassa vuorokauden. ' +
        `Jos se ehtii vanhentua, pyydä uusi osoitteesta ${input.operatorEmail}.`,
    },
  ];

  return {
    template: 'invite',
    to: input.to,
    subject: `RAHTIS · tunnukset yritykselle ${input.companyName}`,
    text: renderText({ heading, blocks, operatorEmail: input.operatorEmail }),
    html: renderEmail({
      heading,
      preheader: 'Aseta salasana ja kirjaudu sisään.',
      blocks,
      operatorEmail: input.operatorEmail,
    }),
    companyId: input.companyId,
  };
}
