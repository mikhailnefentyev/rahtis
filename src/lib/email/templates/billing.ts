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

/** Деньги письма: без налога, налог, итог. Ставка — строкой, или null при обратном начислении. */
export type BillingAmounts = {
  net: string;
  vat: string | null;
  vatRate: string | null;
  total: string;
};

/** Реквизиты Aivomaa Oy в письме — продавца заказчику, плательщика перевозчику. */
export type OperatorFacts = {
  legalName: string;
  businessId: string;
  vatNumber: string | null;
  address: string;
  account: string | null;
};

function moneyRows(
  t: ReturnType<typeof emailText>,
  money: BillingAmounts,
): Array<[string, string]> {
  return money.vatRate && money.vat
    ? [
        [t.billing.fieldAmount, money.net],
        [t.billing.fieldVat(money.vatRate), money.vat],
        [t.billing.fieldTotal, money.total],
      ]
    : [[t.billing.fieldAmount, money.net]];
}

function operatorRows(
  t: ReturnType<typeof emailText>,
  label: string,
  operator: OperatorFacts,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    [label, operator.legalName],
    [t.billing.fieldBusinessId, operator.businessId],
  ];
  if (operator.vatNumber) rows.push([t.billing.fieldVatNumber, operator.vatNumber]);
  if (operator.address) rows.push([t.billing.fieldAddress, operator.address]);
  return rows;
}

export function invoicedEmail(input: {
  to: string;
  companyName: string;
  companyId: string;
  orderRef: string;
  money: BillingAmounts;
  invoiceRef: string | null;
  operator: OperatorFacts;
  operatorEmail: string;
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);

  /*
   * Счёт выставляет Aivomaa Oy под маркой RAHTIS — её реквизиты и счёт
   * для оплаты стоят в письме, а не только имя. Налог — по стране
   * заказчика: финской компании 25,5 %, иностранной обратное начисление.
   */
  const rows: Array<[string, string]> = [
    [t.billing.fieldOrder, input.orderRef],
    ...moneyRows(t, input.money),
  ];
  if (input.invoiceRef) rows.push([t.billing.fieldInvoice, input.invoiceRef]);
  rows.push(...operatorRows(t, t.billing.fieldSeller, input.operator));
  if (input.operator.account) rows.push([t.billing.fieldAccount, input.operator.account]);
  if (input.invoiceRef) rows.push([t.billing.fieldReference, input.invoiceRef]);

  return build({
    template: 'billing.invoiced',
    to: input.to,
    companyId: input.companyId,
    subject: t.billing.invoicedSubject(input.orderRef),
    heading: t.billing.invoicedHeading(input.orderRef),
    preheader: t.billing.preheader(input.money.total),
    lead: t.billing.invoicedLead(input.money.vatRate),
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
  money: BillingAmounts;
  operator: OperatorFacts;
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
    preheader: t.billing.preheader(input.money.total),
    lead: t.billing.settledLead(input.money.vatRate),
    rows: [
      [t.billing.fieldOrder, input.orderRef],
      ...moneyRows(t, input.money),
      ...operatorRows(t, t.billing.fieldPayer, input.operator),
    ],
    operatorEmail: input.operatorEmail,
    locale: input.locale,
  });
}
