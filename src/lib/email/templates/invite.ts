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
 */
export function inviteEmail(input: {
  to: string;
  companyName: string;
  companyId: string;
  link: string;
  operatorEmail: string;
}): EmailMessage {
  const subject = 'RAHTIS · tunnukset yritykselle ' + input.companyName;

  const text = [
    `Hei,`,
    ``,
    `${input.companyName} on hyväksytty RAHTIS-palveluun.`,
    ``,
    `Aseta salasana ja kirjaudu sisään tästä linkistä:`,
    input.link,
    ``,
    `Linkki on kertakäyttöinen ja voimassa vuorokauden. Jos se ehtii`,
    `vanhentua, pyydä uusi osoitteesta ${input.operatorEmail}.`,
    ``,
    `Emme koskaan kysy salasanaasi sähköpostitse emmekä puhelimessa.`,
    ``,
    `Aivomaa Oy · Y-tunnus 3592993-6`,
    input.operatorEmail,
  ].join('\n');

  return {
    template: 'invite',
    to: input.to,
    subject,
    text,
    companyId: input.companyId,
  };
}
