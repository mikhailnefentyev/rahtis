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
 */

export function invoicedEmail(input: {
  to: string;
  companyName: string;
  companyId: string;
  orderRef: string;
  amount: string;
  invoiceRef: string | null;
  operatorEmail: string;
}): EmailMessage {
  return {
    template: 'billing.invoiced',
    to: input.to,
    subject: `RAHTIS · lasku kuljetuksesta ${input.orderRef}`,
    text: [
      'Hei,',
      '',
      `Kuljetuksesta ${input.orderRef} on lähetetty lasku.`,
      '',
      `Summa: ${input.amount} (alv 0 %). Laskuun lisätään alv 25,5 %.`,
      input.invoiceRef ? `Laskun numero: ${input.invoiceRef}` : null,
      '',
      `Kysymykset: ${input.operatorEmail}`,
      '',
      'Aivomaa Oy · Y-tunnus 3592993-6',
    ]
      .filter((line) => line !== null)
      .join('\n'),
    companyId: input.companyId,
  };
}

export function settledEmail(input: {
  to: string;
  companyName: string;
  companyId: string;
  orderRef: string;
  amount: string;
  operatorEmail: string;
}): EmailMessage {
  return {
    template: 'billing.settled',
    to: input.to,
    subject: `RAHTIS · tilitys kuljetuksesta ${input.orderRef}`,
    text: [
      'Hei,',
      '',
      `Kuljetuksesta ${input.orderRef} on maksettu tilitys.`,
      '',
      `Summa: ${input.amount} (alv 0 %). Tilitykseen lisätään alv 25,5 %.`,
      '',
      `Kysymykset: ${input.operatorEmail}`,
      '',
      'Aivomaa Oy · Y-tunnus 3592993-6',
    ].join('\n'),
    companyId: input.companyId,
  };
}
