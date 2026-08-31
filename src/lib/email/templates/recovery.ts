import { renderEmail, renderText, type EmailBlock } from '../layout';
import type { EmailMessage } from '../types';

/**
 * Восстановление пароля.
 *
 * Срок жизни ссылки — час, а не сутки как у приглашения, и это
 * осознанно: восстановление часто запрашивают именно потому, что с
 * ящиком или паролем что-то не так. Чем короче окно, тем меньше пользы
 * от письма, попавшего не в те руки.
 *
 * Последним абзацем — что делать тому, кто ничего не запрашивал.
 * Человек, получивший такое письмо ни с того ни с сего, должен понимать,
 * что его учётная запись цела: ссылку никто, кроме него, не откроет, и
 * пароль сам по себе не меняется.
 */
export function recoveryEmail(input: {
  to: string;
  link: string;
  operatorEmail: string;
}): EmailMessage {
  const heading = 'Salasanan palautus';

  const blocks: EmailBlock[] = [
    { kind: 'text', value: 'Hei,' },
    {
      kind: 'text',
      value:
        'Pyysit uutta salasanaa RAHTIS-tunnuksellesi. Aseta se alla olevasta linkistä.',
    },
    { kind: 'button', label: 'Aseta uusi salasana', href: input.link },
    {
      kind: 'note',
      value:
        'Linkki on kertakäyttöinen ja voimassa tunnin. ' +
        'Jos et pyytänyt uutta salasanaa, voit jättää viestin huomiotta — ' +
        'salasanasi ei muutu ennen kuin linkkiä käytetään.',
    },
  ];

  return {
    template: 'recovery',
    to: input.to,
    subject: 'RAHTIS · salasanan palautus',
    text: renderText({ heading, blocks, operatorEmail: input.operatorEmail }),
    html: renderEmail({
      heading,
      preheader: 'Aseta uusi salasana tunnin sisällä.',
      blocks,
      operatorEmail: input.operatorEmail,
    }),
  };
}
