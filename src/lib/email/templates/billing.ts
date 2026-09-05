import { renderEmail, renderText, type EmailBlock } from '../layout';
import type { EmailMessage } from '../types';

/**
 * Письма о расчётах.
 *
 * Текст самодостаточен и не отсылает к кабинету за сутью: письмо может
 * прийти человеку, у которого доступа в кабинет нет вовсе — бухгалтеру,
 * на общий ящик компании.
 *
 * Суммы уже отформатированы вызывающим: форматирование денег живёт в
 * одном месте на весь проект, и повторять его здесь значит завести
 * второй источник правды о том, как выглядит евро.
 *
 * Числа собраны в таблицу, а не размазаны по фразам. Бухгалтер ищет в
 * письме сумму и номер, а не читает его — колонка находится взглядом,
 * предложение приходится вычитывать.
 */

function build(input: {
  template: string;
  to: string;
  companyId: string;
  subject: string;
  heading: string;
  preheader: string;
  lead: string;
  rows: Array<[string, string]>;
  operatorEmail: string;
}): EmailMessage {
  const blocks: EmailBlock[] = [
    { kind: 'text', value: 'Hei,' },
    { kind: 'text', value: input.lead },
    { kind: 'facts', rows: input.rows },
    { kind: 'note', value: `Kysymykset: ${input.operatorEmail}` },
  ];

  return {
    template: input.template,
    to: input.to,
    subject: input.subject,
    text: renderText({ heading: input.heading, blocks, operatorEmail: input.operatorEmail }),
    html: renderEmail({
      heading: input.heading,
      preheader: input.preheader,
      blocks,
      operatorEmail: input.operatorEmail,
    }),
    companyId: input.companyId,
  };
}

export function invoicedEmail(input: {
  to: string;
  companyName: string;
  companyId: string;
  orderRef: string;
  amount: string;
  invoiceRef: string | null;
  operatorEmail: string;
}): EmailMessage {
  const rows: Array<[string, string]> = [
    ['Kuljetus', input.orderRef],
    ['Summa (alv 0 %)', input.amount],
  ];
  if (input.invoiceRef) rows.push(['Laskun numero', input.invoiceRef]);

  return build({
    template: 'billing.invoiced',
    to: input.to,
    companyId: input.companyId,
    subject: `RAHTIS · lasku kuljetuksesta ${input.orderRef}`,
    heading: `Lasku kuljetuksesta ${input.orderRef}`,
    preheader: `Summa ${input.amount} (alv 0 %).`,
    /*
     * Alv 0 %, ei 25,5 %.
     *
     * Asiakkaat ovat ulkomaisia yrityksiä, ja kuljetuspalvelu EU-maiden
     * alv-velvollisten välillä menee käännetyllä verovelvollisuudella.
     * Vanha teksti lupasi laskuun veron, jota siinä ei ole — ks.
     * VAT_BPS lib/config.ts.
     */
    lead:
      'Kuljetuksesta on lähetetty lasku. Käännetty verovelvollisuus: ostaja tilittää veron omassa maassaan.',
    rows,
    operatorEmail: input.operatorEmail,
  });
}

export function settledEmail(input: {
  to: string;
  companyName: string;
  companyId: string;
  orderRef: string;
  amount: string;
  operatorEmail: string;
}): EmailMessage {
  return build({
    template: 'billing.settled',
    to: input.to,
    companyId: input.companyId,
    subject: `RAHTIS · tilitys kuljetuksesta ${input.orderRef}`,
    heading: `Tilitys kuljetuksesta ${input.orderRef}`,
    preheader: `Summa ${input.amount} (alv 0 %).`,
    lead:
      'Kuljetuksesta on maksettu tilitys. Summa on alv 0 %: käännetty verovelvollisuus.',
    rows: [
      ['Kuljetus', input.orderRef],
      ['Summa (alv 0 %)', input.amount],
    ],
    operatorEmail: input.operatorEmail,
  });
}
