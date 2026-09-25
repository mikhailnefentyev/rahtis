import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailMessage } from '../types';
import type { RegistryCheck } from '@/lib/registry/prh';

/**
 * Два письма одной заявки.
 *
 * Заявка порождает два разных письма, потому что у неё два адресата с
 * несовпадающими нуждами. Заявитель должен убедиться, что форма
 * сработала, и понять, что дальше ждать. Оператор должен узнать, что
 * появилась работа, — иначе заявка лежит в очереди ровно столько,
 * сколько он не заходит в админку, а узнаёт он о ней по звонку.
 *
 * Ни одно из этих писем не выдаёт доступ. Коды уходят отдельно, после
 * ручной проверки Y-tunnus в реестре, — см. inviteEmail. Здесь важно не
 * создать у заявителя впечатление, будто он уже принят: «hakemus
 * vastaanotettu» и «yritys hyväksytty» — разные события, и между ними
 * стоит человек.
 */

/**
 * Заявителю: заявка принята.
 *
 * Без кнопки и без ссылки, и это намеренно. Вести отсюда некуда:
 * кабинета у него ещё нет, а единственное действие, которое ему
 * доступно, — ждать. Кнопка в письме, которая ведёт на страницу входа,
 * куда он войти не может, хуже её отсутствия.
 *
 * Реквизиты продублированы полями: человек заполнял форму руками и
 * должен увидеть, с каким Y-tunnus заявка ушла на самом деле. Опечатка
 * в номере — самая частая причина отказа, и заметить её лучше сейчас,
 * а не после проверки.
 *
 * Язык — тот, на котором была открыта форма заявки: человек уже выбрал,
 * на каком языке ему читать, и спрашивать второй раз незачем. Это же
 * значение записывается компании и дальше служит языком всей переписки.
 */
export function applicationReceivedEmail(input: {
  to: string;
  companyName: string;
  companyId: string;
  businessId: string;
  role: string;
  operatorEmail: string;
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);
  const heading = t.application.heading;

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    { kind: 'text', value: t.application.thanks },
    {
      kind: 'facts',
      rows: [
        [t.application.fieldCompany, input.companyName],
        [t.application.fieldBusinessId, input.businessId],
        [t.application.fieldRole, input.role],
        [t.application.fieldEmail, input.to],
      ],
    },
    { kind: 'text', value: t.application.next },
    { kind: 'note', value: t.application.note(input.operatorEmail) },
  ];

  return {
    template: 'application.received',
    to: input.to,
    toName: input.companyName,
    replyTo: input.operatorEmail,
    subject: t.application.subject(input.companyName),
    text: renderText({
      heading,
      blocks,
      operatorEmail: input.operatorEmail,
      signature: t.signature,
      neverAsk: t.neverAsk,
    }),
    html: renderEmail({
      heading,
      preheader: t.application.preheader,
      blocks,
      operatorEmail: input.operatorEmail,
      tagline: t.brandTagline,
      neverAsk: t.neverAsk,
    }),
    companyId: input.companyId,
  };
}

/**
 * Оператору: пришла новая заявка.
 *
 * Письмо приходит НАМ, поэтому подписи «Rahtis Team» под ним нет —
 * incoming, как у вопроса из кабинета.
 *
 * Адрес ответа — почта заявителя. Половина заявок требует одного
 * уточнения («у вас Y-tunnus от другого юрлица»), и оператор должен
 * решать это нажатием «ответить», а не поиском адреса в админке.
 *
 * Кнопка ведёт в очередь модерации, а не на карточку компании:
 * отдельного адреса у карточки нет, очередь — это и есть рабочее место,
 * где решение принимается.
 */
export function applicationFiledEmail(input: {
  operatorInbox: string;
  applicantEmail: string;
  companyName: string;
  companyId: string;
  businessId: string;
  role: string;
  queueLink: string;
  registry: RegistryCheck;
  ytjLink: string;
}): EmailMessage {
  const heading = `Uusi hakemus: ${input.companyName}`;
  const r = input.registry;

  /*
   * Итог сверки — в теме и первой строкой: по ним видно, можно ли
   * одобрять сразу или нужно разбираться, ещё до открытия письма.
   */
  const verdict = {
    OK: 'PRH: kaikki täsmää',
    ATTENTION: 'PRH: tarkistettavaa',
    NOT_FOUND: 'PRH: ei avoimessa datassa',
    ERROR: 'PRH: ei vastausta',
  }[r.verdict];
  const yes = (value: boolean | null) => (value === null ? '–' : value ? 'kyllä' : 'EI');

  const registryRows: Array<[string, string]> = r.officialName
    ? [
        ['Nimi rekisterissä', r.officialName],
        ['Yhtiömuoto', r.form ?? '–'],
        ['Rekisteröity', r.registeredOn ?? '–'],
        ['Ennakkoperintärekisteri', yes(r.prepayment)],
        ['Arvonlisäverorekisteri', yes(r.vat)],
        ['Työnantajarekisteri', yes(r.employer)],
      ]
    : [];

  const blocks: EmailBlock[] = [
    {
      kind: 'facts',
      rows: [
        ['Yritys', input.companyName],
        ['Y-tunnus', input.businessId],
        ['Rooli', input.role],
        ['Sähköposti', input.applicantEmail],
      ],
    },
    { kind: 'text', value: verdict },
    ...(registryRows.length > 0 ? [{ kind: 'facts' as const, rows: registryRows }] : []),
    ...r.issues.map((issue) => ({ kind: 'note' as const, value: issue })),
    {
      kind: 'text',
      value:
        'Avoin data ei kerro yrityksen vastuuhenkilöitä: se, että hakija edustaa yritystä, tarkistetaan edelleen käsin. Yrityksen kortti YTJ:ssä: ' +
        input.ytjLink,
    },
    { kind: 'button', label: 'Avaa tarkastusjono', href: input.queueLink },
  ];

  return {
    template: 'application.filed',
    to: input.operatorInbox,
    replyTo: input.applicantEmail,
    subject: `RAHTIS · uusi hakemus: ${input.companyName} · ${verdict}`,
    text: renderText({
      heading,
      blocks,
      operatorEmail: input.operatorInbox,
      incoming: true,
    }),
    html: renderEmail({
      heading,
      preheader: `${input.businessId} · ${input.role} · ${input.applicantEmail}`,
      blocks,
      operatorEmail: input.operatorInbox,
      incoming: true,
    }),
    companyId: input.companyId,
  };
}
