import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailMessage } from '../types';

/**
 * Восстановление пароля.
 *
 * Срок жизни ссылки — сутки, как у приглашения. Хотелось час: чем
 * короче окно, тем меньше пользы от письма, попавшего не в те руки. Но
 * у Supabase срок один на все ссылки из писем (otp_expiry), а часовое
 * приглашение не доживало до клиента: первые заявки 25.09.2026 одобрили
 * днём, и к вечеру ссылки уже не работали, хотя письмо обещало сутки.
 *
 * Последним абзацем — что делать тому, кто ничего не запрашивал.
 * Человек, получивший такое письмо ни с того ни с сего, должен понимать,
 * что его учётная запись цела: ссылку никто, кроме него, не откроет, и
 * пароль сам по себе не меняется.
 *
 * Язык здесь единственное место, где он может не найтись: пароль
 * восстанавливают по адресу почты, а компания к этому моменту ещё не
 * известна. Тогда письмо уходит по-фински — тем же умолчанием, что у
 * компании без выбранного языка.
 */
export function recoveryEmail(input: {
  to: string;
  link: string;
  operatorEmail: string;
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);
  const heading = t.recovery.heading;

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    { kind: 'text', value: t.recovery.body },
    { kind: 'button', label: t.recovery.button, href: input.link },
    { kind: 'note', value: t.recovery.note },
  ];

  return {
    template: 'recovery',
    to: input.to,
    subject: t.recovery.subject,
    text: renderText({
      heading,
      blocks,
      operatorEmail: input.operatorEmail,
      signature: t.signature,
      neverAsk: t.neverAsk,
    }),
    html: renderEmail({
      heading,
      preheader: t.recovery.preheader,
      blocks,
      operatorEmail: input.operatorEmail,
      tagline: t.brandTagline,
      neverAsk: t.neverAsk,
    }),
  };
}
