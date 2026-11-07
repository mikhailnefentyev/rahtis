import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailMessage } from '../types';

/*
 * Пересланное письмо принято (6.11.2026): отправителю — что черновик
 * готов (или не прочитался) и ссылка на заполненную форму. Заказ не
 * опубликован: это делает человек. Языки — fi/en, язык компании.
 */
export function orderEmailReceivedEmail(input: {
  to: string;
  locale: EmailLocale;
  subject: string;
  parsed: boolean;
  /** Письмо — поправка к этому рейсу (тот же номер заказа клиента). */
  amendsRef?: string | null;
  link: string;
  operatorEmail: string;
  companyId: string;
}): EmailMessage {
  const t = emailText(input.locale);
  const fi = input.locale === 'fi';
  const subjectLine = input.subject || (fi ? '(ei aihetta)' : '(no subject)');

  const amends = input.parsed && input.amendsRef ? input.amendsRef : null;
  const heading = amends
    ? fi
      ? `Muutoksia keikkaan ${amends}`
      : `Changes to trip ${amends}`
    : input.parsed
    ? fi
      ? 'Tilausluonnos sähköpostista on valmis'
      : 'Order draft from your email is ready'
    : fi
      ? 'Sähköposti vastaanotettu – tilausta ei saatu luettua'
      : 'Email received – the order could not be read';

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    {
      kind: 'text',
      value: amends
        ? fi
          ? `välittämäsi viesti koskee keikkaa ${amends} (sama tilausnumero). Vertaa nykyisiä tietoja viestin tietoihin ja hyväksy muutokset – mitään ei muuteta ilman sinua.`
          : `the message you forwarded concerns trip ${amends} (same order number). Compare the current details with the message and accept the changes – nothing is changed without you.`
        : input.parsed
        ? fi
          ? 'välittämäsi viestin perusteella on tehty tilausluonnos. Tarkista tiedot ja julkaise tilaus – luonnosta ei julkaista ilman sinua.'
          : 'an order draft has been made from the message you forwarded. Check the details and publish the order – the draft is not published without you.'
        : fi
          ? 'välittämäsi viesti vastaanotettiin, mutta siitä ei saatu luettua tilausta. Voit täyttää tilauksen itse.'
          : 'the message you forwarded was received, but no order could be read from it. You can fill in the order yourself.',
    },
    { kind: 'facts', rows: [[fi ? 'Viesti' : 'Message', subjectLine]] },
    {
      kind: 'button',
      label: amends ? (fi ? 'Tarkista muutokset' : 'Review the changes') : fi ? 'Avaa tilauslomake' : 'Open the order form',
      href: input.link,
    },
  ];

  return {
    template: 'order.email_received',
    to: input.to,
    subject: `${heading}: ${subjectLine}`.slice(0, 200),
    companyId: input.companyId,
    text: renderText({ heading, blocks, operatorEmail: input.operatorEmail, signature: t.signature, neverAsk: t.neverAsk }),
    html: renderEmail({ heading, preheader: subjectLine, blocks, operatorEmail: input.operatorEmail, tagline: t.brandTagline, neverAsk: t.neverAsk }),
  };
}
