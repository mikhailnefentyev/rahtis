import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
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
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    { kind: 'text', value: input.lead },
    { kind: 'facts', rows: input.rows },
    { kind: 'note', value: t.billing.questions(input.operatorEmail) },
  ];

  return {
    template: input.template,
    to: input.to,
    subject: input.subject,
    text: renderText({
      heading: input.heading,
      blocks,
      operatorEmail: input.operatorEmail,
      signature: t.signature,
      neverAsk: t.neverAsk,
    }),
    html: renderEmail({
      heading: input.heading,
      preheader: input.preheader,
      blocks,
      operatorEmail: input.operatorEmail,
      tagline: t.brandTagline,
      neverAsk: t.neverAsk,
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
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);

  const rows: Array<[string, string]> = [
    [t.billing.fieldOrder, input.orderRef],
    [t.billing.fieldAmount, input.amount],
  ];
  if (input.invoiceRef) rows.push([t.billing.fieldInvoice, input.invoiceRef]);

  return build({
    template: 'billing.invoiced',
    to: input.to,
    companyId: input.companyId,
    subject: t.billing.invoicedSubject(input.orderRef),
    heading: t.billing.invoicedHeading(input.orderRef),
    preheader: t.billing.preheader(input.amount),
    /*
     * Ставка ноль, а не 25,5 %.
     *
     * Заказчики — иностранные компании, и перевозка между плательщиками
     * ALV разных стран ЕС идёт по обратному начислению. Прежний текст
     * обещал к счёту налог, которого в нём нет, — см. VAT_BPS в
     * lib/config.ts.
     */
    lead: t.billing.invoicedLead,
    rows,
    operatorEmail: input.operatorEmail,
    locale: input.locale,
  });
}

export function settledEmail(input: {
  to: string;
  companyName: string;
  companyId: string;
  orderRef: string;
  amount: string;
  operatorEmail: string;
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);

  return build({
    template: 'billing.settled',
    to: input.to,
    companyId: input.companyId,
    subject: t.billing.settledSubject(input.orderRef),
    heading: t.billing.settledHeading(input.orderRef),
    preheader: t.billing.preheader(input.amount),
    lead: t.billing.settledLead,
    rows: [
      [t.billing.fieldOrder, input.orderRef],
      [t.billing.fieldAmount, input.amount],
    ],
    operatorEmail: input.operatorEmail,
    locale: input.locale,
  });
}
