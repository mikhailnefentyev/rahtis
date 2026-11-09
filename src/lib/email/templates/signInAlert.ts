import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailMessage } from '../types';

/*
 * Вход с нового устройства (6.11.2026). Захват учётной записи — главный
 * способ увести груз: человек должен узнать о чужом входе в ту же
 * минуту. Языки — fi/en, как у всех писем; язык — того, кто входил.
 */
export function signInAlertEmail(input: {
  to: string;
  locale: EmailLocale;
  device: string;
  place: string;
  when: string;
  link: string;
  support: string;
  operatorEmail: string;
}): EmailMessage {
  const t = emailText(input.locale);
  const fi = input.locale === 'fi';

  const heading = fi ? 'Uusi kirjautuminen RAHTIS-tilillesi' : 'New sign-in to your RAHTIS account';
  const rows: [string, string][] = fi
    ? [
        ['Laite', input.device],
        ['Sijainti (arvio)', input.place],
        ['Aika', input.when],
      ]
    : [
        ['Device', input.device],
        ['Approximate location', input.place],
        ['Time', input.when],
      ];

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    {
      kind: 'text',
      value: fi
        ? 'tilillesi kirjauduttiin laitteelta, jota emme ole ennen nähneet.'
        : 'your account was signed in to from a device we have not seen before.',
    },
    { kind: 'facts', rows },
    {
      kind: 'note',
      value: fi
        ? `Jos se et ollut sinä, vaihda salasana heti ja ota yhteyttä RAHTIS-tukeen: ${input.support}.`
        : `If it wasn't you, change your password now and contact RAHTIS support: ${input.support}.`,
    },
    { kind: 'button', label: fi ? 'Avaa tilin asetukset' : 'Open account settings', href: input.link },
  ];

  const subject = heading;
  const preheader = `${input.device} · ${input.place} · ${input.when}`;

  return {
    template: 'auth.new_device',
    to: input.to,
    subject,
    text: renderText({ heading, blocks, operatorEmail: input.operatorEmail, signature: t.signature, neverAsk: t.neverAsk }),
    html: renderEmail({ heading, preheader, blocks, operatorEmail: input.operatorEmail, tagline: t.brandTagline, neverAsk: t.neverAsk }),
  };
}
