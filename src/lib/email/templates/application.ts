import { renderEmail, renderText, type EmailBlock } from '../layout';
import type { EmailMessage } from '../types';

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
 */
export function applicationReceivedEmail(input: {
  to: string;
  companyName: string;
  companyId: string;
  businessId: string;
  role: string;
  operatorEmail: string;
}): EmailMessage {
  const heading = 'Hakemuksenne on vastaanotettu';

  const blocks: EmailBlock[] = [
    { kind: 'text', value: 'Hei,' },
    {
      kind: 'text',
      value:
        'Kiitos hakemuksesta. Se on kirjattu ja siirtynyt tarkastukseen: ' +
        'käymme yrityksenne tiedot läpi PRH:n ja YTJ:n rekistereistä.',
    },
    {
      kind: 'facts',
      rows: [
        ['Yritys', input.companyName],
        ['Y-tunnus', input.businessId],
        ['Rooli', input.role],
        ['Sähköposti', input.to],
      ],
    },
    {
      kind: 'text',
      value:
        'Kun hakemus on hyväksytty, lähetämme tähän samaan osoitteeseen linkin, ' +
        'jolla asetat salasanan ja pääset kirjautumaan sisään. Sitä ennen ' +
        'palveluun ei pääse kirjautumaan.',
    },
    {
      kind: 'note',
      value:
        'Tarkastuksen tekee ihminen, joten vastaus tulee arkipäivien aikana. ' +
        `Jos jokin tiedoista on väärin tai haluat kysyä hakemuksesta, vastaa tähän viestiin tai kirjoita osoitteeseen ${input.operatorEmail}.`,
    },
  ];

  return {
    template: 'application.received',
    to: input.to,
    toName: input.companyName,
    replyTo: input.operatorEmail,
    subject: `RAHTIS · hakemus vastaanotettu — ${input.companyName}`,
    text: renderText({ heading, blocks, operatorEmail: input.operatorEmail }),
    html: renderEmail({
      heading,
      preheader: 'Hakemus on kirjattu ja siirtynyt tarkastukseen.',
      blocks,
      operatorEmail: input.operatorEmail,
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
}): EmailMessage {
  const heading = `Uusi hakemus: ${input.companyName}`;

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
    {
      kind: 'text',
      value: 'Hakemus odottaa tarkastusjonossa. Tarkista Y-tunnus rekisteristä ennen hyväksyntää.',
    },
    { kind: 'button', label: 'Avaa tarkastusjono', href: input.queueLink },
  ];

  return {
    template: 'application.filed',
    to: input.operatorInbox,
    replyTo: input.applicantEmail,
    subject: `RAHTIS · uusi hakemus: ${input.companyName}`,
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
