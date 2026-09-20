import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailAttachment, EmailMessage } from '../types';
import type { ClaimEventKind, ClaimKind, ClaimStatus } from '@/types/db';

/**
 * Письма о claims.
 *
 * Тексты здесь, а не в общем text.ts: у claim свои четыре события, два
 * словаря статусов и видов, и в общем файле они растворились бы между
 * приглашением и восстановлением пароля.
 *
 * Письмо самодостаточно: номер claim, номер рейса, вид, статус, и что
 * произошло. Текст комментария в письмо не кладётся — переписка по спору
 * живёт в кабинете, где у неё есть история и доступ по ролям, а письмо
 * пересылают куда угодно.
 */

const TEXT = {
  fi: {
    kind: {
      CARGO_DAMAGE: 'Lastin tai perävaunun vaurio',
      SHORTAGE: 'Vajaus',
      DOWNTIME: 'Odotusaika',
      DEVIATION: 'Poikkeama reitistä tai ajasta',
      OTHER: 'Muu',
    } satisfies Record<ClaimKind, string>,
    status: {
      OPEN: 'Avoin',
      IN_REVIEW: 'Käsittelyssä',
      RESOLVED: 'Ratkaistu',
      REJECTED: 'Hylätty',
    } satisfies Record<ClaimStatus, string>,
    subject: {
      CREATED: (ref: string) => `RAHTIS · uusi reklamaatio ${ref}`,
      COMMENT: (ref: string) => `RAHTIS · uusi viesti reklamaatiossa ${ref}`,
      ATTACHMENT: (ref: string) => `RAHTIS · uusi liite reklamaatiossa ${ref}`,
      STATUS: (ref: string) => `RAHTIS · reklamaation ${ref} tila muuttui`,
    } satisfies Record<ClaimEventKind, (ref: string) => string>,
    lead: {
      CREATED:
        'Kuljetuksesta on tehty reklamaatio. RAHTIS käsittelee sen ja välittää osapuolten välillä.',
      COMMENT:
        'Reklamaatioon on tullut uusi viesti. Viestin voi lukea ja siihen voi vastata omilla sivuilla.',
      ATTACHMENT: 'Reklamaatioon on liitetty uusi tiedosto.',
      STATUS: 'Reklamaation tila on muuttunut.',
    } satisfies Record<ClaimEventKind, string>,
    claim: 'Reklamaatio',
    trip: 'Kuljetus',
    type: 'Tyyppi',
    state: 'Tila',
    resolution: 'Ratkaisu',
    button: 'Avaa reklamaatio',
    operatorLead: 'Uusi reklamaatio odottaa käsittelyä.',
    filedBy: 'Tekijä',
    party: { SHIPPER: 'Tilaaja', CARRIER: 'Kuljetusliike', ADMIN: 'RAHTIS' },
  },
  en: {
    kind: {
      CARGO_DAMAGE: 'Cargo or trailer damage',
      SHORTAGE: 'Shortage',
      DOWNTIME: 'Downtime',
      DEVIATION: 'Route or time deviation',
      OTHER: 'Other',
    } satisfies Record<ClaimKind, string>,
    status: {
      OPEN: 'Open',
      IN_REVIEW: 'In review',
      RESOLVED: 'Resolved',
      REJECTED: 'Rejected',
    } satisfies Record<ClaimStatus, string>,
    subject: {
      CREATED: (ref: string) => `RAHTIS · new claim ${ref}`,
      COMMENT: (ref: string) => `RAHTIS · new message in claim ${ref}`,
      ATTACHMENT: (ref: string) => `RAHTIS · new attachment in claim ${ref}`,
      STATUS: (ref: string) => `RAHTIS · claim ${ref} status changed`,
    } satisfies Record<ClaimEventKind, (ref: string) => string>,
    lead: {
      CREATED:
        'A claim has been filed on a trip. RAHTIS reviews it and mediates between the parties.',
      COMMENT: 'There is a new message in the claim. You can read and answer it in your account.',
      ATTACHMENT: 'A new file has been attached to the claim.',
      STATUS: 'The status of the claim has changed.',
    } satisfies Record<ClaimEventKind, string>,
    claim: 'Claim',
    trip: 'Trip',
    type: 'Type',
    state: 'Status',
    resolution: 'Resolution',
    button: 'Open claim',
    operatorLead: 'A new claim is waiting for review.',
    filedBy: 'Filed by',
    party: { SHIPPER: 'Shipper', CARRIER: 'Carrier', ADMIN: 'RAHTIS' },
  },
} as const;

export type ClaimEmailInput = {
  event: ClaimEventKind;
  to: string;
  companyId: string | null;
  locale: EmailLocale;
  claimRef: string;
  orderRef: string;
  kind: ClaimKind;
  status: ClaimStatus;
  filedBy: 'SHIPPER' | 'CARRIER';
  resolution: string | null;
  link: string;
  operatorEmail: string;
  /** Письмо оператору: другой вводный абзац и сторона-подавший в фактах. */
  forOperator?: boolean;
  /** Дополнительные строки фактов — оператору: куда ушло зеркало. */
  extraRows?: Array<[string, string]>;
  /** Текст сообщения — только в письме оператору, сторонам он не пересылается. */
  message?: string | null;
};

export function claimEmail(input: ClaimEmailInput): EmailMessage {
  const t = emailText(input.locale);
  const c = TEXT[input.locale];

  const subject = c.subject[input.event](input.claimRef);
  const lead =
    input.forOperator && input.event === 'CREATED' ? c.operatorLead : c.lead[input.event];

  const rows: Array<[string, string]> = [
    [c.claim, input.claimRef],
    [c.trip, input.orderRef],
    [c.type, c.kind[input.kind]],
    [c.state, c.status[input.status]],
  ];

  if (input.forOperator) rows.push([c.filedBy, c.party[input.filedBy]]);
  if (input.resolution && input.event === 'STATUS') rows.push([c.resolution, input.resolution]);
  if (input.extraRows) rows.push(...input.extraRows);

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    { kind: 'text', value: lead },
    { kind: 'facts', rows },
    ...(input.message ? [{ kind: 'text' as const, value: input.message }] : []),
    { kind: 'button', label: c.button, href: input.link },
  ];

  return {
    template: `claim.${input.event.toLowerCase()}`,
    to: input.to,
    /* Ответ на любое письмо о claim — оператору: он ведёт спор. */
    replyTo: input.operatorEmail,
    subject,
    companyId: input.companyId,
    text: renderText({
      heading: subject,
      blocks,
      operatorEmail: input.operatorEmail,
      signature: t.signature,
      neverAsk: t.neverAsk,
    }),
    html: renderEmail({
      heading: subject,
      preheader: lead,
      blocks,
      operatorEmail: input.operatorEmail,
      tagline: t.brandTagline,
      neverAsk: t.neverAsk,
    }),
  };
}

/* ── Зеркало claim второй стороне ────────────────────────────────── */

const MIRROR = {
  fi: {
    subject: (ref: string, order: string) => `RAHTIS · reklamaatio ${ref} · kuljetus ${order}`,
    heading: (order: string) => `Reklamaatio kuljetuksesta ${order}`,
    lead: {
      SHIPPER: (order: string) =>
        `Aivomaa Oy välittää teille kuljetusta ${order} koskevan reklamaation. Tilaaja on esittänyt sen Aivomaa Oy:lle sopimuskumppaninaan, ja Aivomaa Oy käsittelee asian kanssanne.`,
      CARRIER: (order: string) =>
        `Aivomaa Oy välittää teille kuljetusta ${order} koskevan reklamaation. Kuljetuksen suorittaja on esittänyt sen Aivomaa Oy:lle, ja Aivomaa Oy käsittelee asian kanssanne.`,
    },
    description: 'Kuvaus',
    route: 'Reitti',
    closed: 'Päättyi',
    vehicle: 'Ajoneuvo',
    place: 'Missä tapahtui',
    amount: 'Vaadittu summa (veroton)',
    files: 'Liitteet',
    filesAttached: (n: number) => `${n} kpl, liitteenä`,
    reply: (operator: string, ref: string) =>
      `Vastatkaa suoraan tähän viestiin: vastaus tulee RAHTIS-operaattorille osoitteeseen ${operator}. Asian käsittely jatkuu sähköpostitse — säilyttäkää otsikossa reklamaation numero ${ref}. Reklamaation tilan ja ratkaisun näette myös palvelussa.`,
    button: 'Avaa reklamaatio palvelussa',
  },
  en: {
    subject: (ref: string, order: string) => `RAHTIS · claim ${ref} · trip ${order}`,
    heading: (order: string) => `Claim on trip ${order}`,
    lead: {
      SHIPPER: (order: string) =>
        `Aivomaa Oy forwards to you a claim concerning trip ${order}. The shipper has presented it to Aivomaa Oy as its contracting party, and Aivomaa Oy handles the matter with you.`,
      CARRIER: (order: string) =>
        `Aivomaa Oy forwards to you a claim concerning trip ${order}. The performing carrier has presented it to Aivomaa Oy, and Aivomaa Oy handles the matter with you.`,
    },
    description: 'Description',
    route: 'Route',
    closed: 'Completed',
    vehicle: 'Vehicle',
    place: 'Where it happened',
    amount: 'Amount claimed (excl. VAT)',
    files: 'Attachments',
    filesAttached: (n: number) => `${n}, attached`,
    reply: (operator: string, ref: string) =>
      `Reply directly to this email: your answer goes to the RAHTIS operator at ${operator}. The matter continues by email — please keep the claim number ${ref} in the subject. You can also see the claim's status and resolution in the service.`,
    button: 'Open the claim in the service',
  },
} as const;

export type ClaimMirrorInput = {
  to: string;
  companyId: string;
  locale: EmailLocale;
  claimRef: string;
  orderRef: string;
  filedBy: 'SHIPPER' | 'CARRIER';
  kind: ClaimKind;
  description: string;
  route: string | null;
  closedAt: string | null;
  vehicle: string | null;
  place: string | null;
  amount: string | null;
  attachments: EmailAttachment[];
  link: string;
  operatorEmail: string;
};

/**
 * Claim, пересланный второй стороне от имени Aivomaa Oy.
 *
 * Самодостаточное письмо, а не «откройте кабинет»: с него начинается
 * переписка по почте, и всё, о чём спорят, должно быть в нём — текст,
 * сумма, место, вложения. Ответ приходит оператору (Reply-To), номер
 * claim стоит в теме, чтобы ветка писем не рассыпалась.
 *
 * Имя подавшего не называется: заказчику — потому что перевозчик ему
 * не раскрывается, перевозчику — потому что контрагент в этом споре
 * Aivomaa Oy, а не заказчик.
 */
export function claimMirrorEmail(input: ClaimMirrorInput): EmailMessage {
  const t = emailText(input.locale);
  const c = TEXT[input.locale];
  const m = MIRROR[input.locale];

  const subject = m.subject(input.claimRef, input.orderRef);
  const heading = m.heading(input.orderRef);
  const lead = m.lead[input.filedBy](input.orderRef);

  const rows: Array<[string, string]> = [
    [c.claim, input.claimRef],
    [c.trip, input.orderRef],
    [c.type, c.kind[input.kind]],
  ];
  if (input.route) rows.push([m.route, input.route]);
  if (input.closedAt) rows.push([m.closed, input.closedAt]);
  if (input.vehicle) rows.push([m.vehicle, input.vehicle]);
  if (input.place) rows.push([m.place, input.place]);
  if (input.amount) rows.push([m.amount, input.amount]);
  if (input.attachments.length) rows.push([m.files, m.filesAttached(input.attachments.length)]);

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    { kind: 'text', value: lead },
    { kind: 'facts', rows },
    { kind: 'text', value: `${m.description}: ${input.description}` },
    { kind: 'note', value: m.reply(input.operatorEmail, input.claimRef) },
    { kind: 'button', label: m.button, href: input.link },
  ];

  return {
    template: 'claim.mirror',
    to: input.to,
    replyTo: input.operatorEmail,
    subject,
    companyId: input.companyId,
    attachments: input.attachments,
    text: renderText({
      heading,
      blocks,
      operatorEmail: input.operatorEmail,
      signature: t.signature,
      neverAsk: t.neverAsk,
    }),
    html: renderEmail({
      heading,
      preheader: lead,
      blocks,
      operatorEmail: input.operatorEmail,
      tagline: t.brandTagline,
      neverAsk: t.neverAsk,
    }),
  };
}
