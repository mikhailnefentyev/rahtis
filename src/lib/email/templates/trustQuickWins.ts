import type { EmailBlock } from '../layout';
import type { EmailLocale } from '../text';

/*
 * Письма мер доверия (20261106170000_trust_quick_wins): смена реквизитов,
 * напоминание об оплате счёта перевозчика, напоминание по счёту объекта.
 * Языки — fi/en (язык компании, как у всех писем). Суммы и даты
 * приходят уже отформатированными.
 */

export type SensitiveField = 'IBAN' | 'CONTACT_EMAIL' | 'BILLING_EMAIL' | 'OWNER';

export type MailContent = { subject: string; heading: string; preheader: string; blocks: EmailBlock[] };

const FIELD: Record<EmailLocale, Record<SensitiveField, string>> = {
  fi: {
    IBAN: 'tilinumero (IBAN)',
    CONTACT_EMAIL: 'yhteyssähköposti',
    BILLING_EMAIL: 'laskutussähköposti',
    OWNER: 'pääkäyttäjä',
  },
  en: {
    IBAN: 'bank account (IBAN)',
    CONTACT_EMAIL: 'contact email',
    BILLING_EMAIL: 'invoicing email',
    OWNER: 'main user',
  },
};

/** Смена реквизитов: людям компании и на прежний адрес. */
export function sensitiveChangeContent(
  locale: EmailLocale,
  input: {
    company: string;
    field: SensitiveField;
    who: string;
    when: string;
    oldValue: string | null;
    newValue: string | null;
    support: string;
    link: string;
  },
): MailContent {
  const field = FIELD[locale][input.field];
  const change = [input.oldValue, input.newValue].filter(Boolean).join(' → ');
  const facts: EmailBlock[] = change ? [{ kind: 'facts', rows: [[field, change]] }] : [];
  if (locale === 'fi') {
    return {
      subject: `RAHTIS · ${input.company}: ${field} muutettiin`,
      heading: `Yrityksen ${field} muutettiin`,
      preheader: `${input.who} muutti tietoa ${input.when}.`,
      blocks: [
        { kind: 'text', value: 'Hei,' },
        { kind: 'text', value: `yrityksen ${input.company} ${field} muutettiin RAHTIS-palvelussa. Muutoksen teki ${input.who} ${input.when}.` },
        ...facts,
        {
          kind: 'note',
          value: `Jos muutos ei ollut teidän tai kollegan tekemä, ottakaa heti yhteyttä RAHTIS-tukeen: ${input.support}. Älkää maksako tai muuttako mitään puhelimessa tai sähköpostissa annettujen uusien tietojen perusteella ennen kuin olette tarkistaneet asian.`,
        },
        { kind: 'button', label: 'Avaa yrityksen tiedot', href: input.link },
      ],
    };
  }
  return {
    subject: `RAHTIS · ${input.company}: ${field} changed`,
    heading: `Your company's ${field} was changed`,
    preheader: `${input.who} changed it on ${input.when}.`,
    blocks: [
      { kind: 'text', value: 'Hello,' },
      { kind: 'text', value: `the ${field} of ${input.company} was changed in RAHTIS by ${input.who} on ${input.when}.` },
      ...facts,
      {
        kind: 'note',
        value: `If it wasn't you or a colleague, contact RAHTIS support right away: ${input.support}. Do not pay or change anything based on new details given by phone or email until you have checked.`,
      },
      { kind: 'button', label: 'Open company details', href: input.link },
    ],
  };
}

/** Напоминание заказчику об оплате счёта перевозчика по прямому рейсу. */
export function freightReminderContent(
  locale: EmailLocale,
  input: {
    stage: 1 | 2;
    carrier: string;
    number: string;
    dueOn: string;
    amount: string;
    orderRef: string;
    link: string;
  },
): MailContent {
  const first = input.stage === 1;
  if (locale === 'fi') {
    return {
      subject: `Maksumuistutus: ${input.carrier}, lasku ${input.number}`,
      heading: first ? `Maksumuistutus: lasku ${input.number}` : `Toinen maksumuistutus: lasku ${input.number}`,
      preheader: `Eräpäivä ${input.dueOn}, ${input.amount}.`,
      blocks: [
        { kind: 'text', value: 'Hei,' },
        {
          kind: 'text',
          value: `${input.carrier} muistuttaa laskusta ${input.number}, jonka eräpäivä oli ${input.dueOn}. Lähetämme muistutuksen kuljetusliikkeen puolesta RAHTIS-palvelun kautta.`,
        },
        {
          kind: 'facts',
          rows: [
            ['Laskuttaja', input.carrier],
            ['Lasku', input.number],
            ['Kuljetus', input.orderRef],
            ['Eräpäivä', input.dueOn],
            ['Summa', input.amount],
          ],
        },
        {
          kind: 'text',
          value: 'Maksu suoritetaan suoraan kuljetusliikkeelle laskun tietojen mukaisesti — ei RAHTIS-palvelulle eikä Aivomaa Oy:lle. Jos olette jo maksaneet, merkitkää lasku maksetuksi palvelussa, niin muistutukset loppuvat.',
        },
        { kind: 'button', label: 'Merkitse maksetuksi', href: input.link },
        {
          kind: 'note',
          value: 'Laskua ja tilitietoja koskevissa kysymyksissä kääntykää suoraan kuljetusliikkeen puoleen. Jos joku pyytää puhelimessa tai sähköpostissa maksua eri tilille, tarkistakaa asia ensin.',
        },
      ],
    };
  }
  return {
    subject: `Payment reminder: ${input.carrier}, invoice ${input.number}`,
    heading: first ? `Payment reminder: invoice ${input.number}` : `Second payment reminder: invoice ${input.number}`,
    preheader: `Due ${input.dueOn}, ${input.amount}.`,
    blocks: [
      { kind: 'text', value: 'Hello,' },
      {
        kind: 'text',
        value: `${input.carrier} is reminding you of invoice ${input.number}, which was due on ${input.dueOn}. We send this reminder on the carrier's behalf through RAHTIS.`,
      },
      {
        kind: 'facts',
        rows: [
          ['Invoiced by', input.carrier],
          ['Invoice', input.number],
          ['Transport', input.orderRef],
          ['Due date', input.dueOn],
          ['Amount', input.amount],
        ],
      },
      {
        kind: 'text',
        value: 'Pay directly to the carrier as stated on the invoice — not to RAHTIS or Aivomaa Oy. If you have already paid, mark the invoice as paid in RAHTIS and the reminders stop.',
      },
      { kind: 'button', label: 'Mark as paid', href: input.link },
      {
        kind: 'note',
        value: 'Questions about the invoice or bank details: contact the carrier directly. If anyone asks you by phone or email to pay to a different account, check first.',
      },
    ],
  };
}

/** Напоминание клиенту по счёту объекта: клиент не в RAHTIS, письмо на двух языках, ответ — перевозчику. */
export function siteReminderText(input: {
  stage: 1 | 2;
  seller: string;
  number: string;
  job: string;
  dueOn: string;
  amount: string;
  iban: string | null;
  reference: string;
  replyTo: string;
}): { subject: string; text: string } {
  const second = input.stage === 2;
  const account = input.iban ? `, tilille ${input.iban}` : '';
  const accountEn = input.iban ? `, account ${input.iban}` : '';
  return {
    subject: `${second ? 'Toinen maksumuistutus' : 'Maksumuistutus'} · Lasku ${input.number} · ${input.seller}`,
    text: [
      'Hei,',
      '',
      `${second ? 'toinen muistutus' : 'muistutus'}: lasku ${input.number} (työmaa ${input.job}) erääntyi ${input.dueOn}, eikä sitä ole merkitty maksetuksi.`,
      `Maksettava ${input.amount}${account}, viitenumero ${input.reference}. Laskuttaja: ${input.seller}.`,
      'Jos lasku on jo maksettu, vastatkaa tähän viestiin, niin laskuttaja merkitsee sen maksetuksi.',
      `Kysymykset: ${input.replyTo}.`,
      '',
      '—',
      `${second ? 'Second reminder' : 'Reminder'}: invoice ${input.number} from ${input.seller} (worksite ${input.job}) was due on ${input.dueOn} and is not marked as paid. Amount ${input.amount}${accountEn}, reference ${input.reference}. Already paid? Just reply to this email (${input.replyTo}).`,
      '',
      'RAHTIS lähettää muistutuksen laskuttajan puolesta. / Sent by RAHTIS on behalf of the invoicing company.',
    ].join('\n'),
  };
}
