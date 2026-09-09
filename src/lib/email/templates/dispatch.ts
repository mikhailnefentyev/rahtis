import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailMessage } from '../types';

/**
 * Рассылка о новом заказе.
 *
 * Единственное письмо платформы, которое уходит не адресату события, а
 * всем, кому работа открыта. Из этого следует всё остальное в нём.
 *
 * Оно короткое. Перевозчик читает его на телефоне между рейсами и решает
 * ровно одно — открывать стол или нет. Поэтому суть письма — заголовок
 * «откуда → куда» и таблица из пяти строк, а не абзац, который надо
 * дочитать до ставки.
 *
 * Контактов получателя груза здесь нет, как нет их и на столе: пока
 * заказ не закреплён за перевозчиком, это данные третьего лица. Круг
 * полей письма умышленно совпадает с тем, что показывает desk_orders.
 *
 * Внизу сказано, почему письмо пришло. Рассылка приходит тому, кто на
 * неё не подписывался явно, и человек вправе понимать основание, не
 * спрашивая нас.
 */
export function orderPublishedEmail(input: {
  to: string;
  companyName: string;
  companyId: string;
  ref: string;
  from: string;
  to_: string;
  pickup: string | null;
  unit: string | null;
  distance: string | null;
  rate: string | null;
  link: string;
  operatorEmail: string;
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);
  const heading = t.dispatch.heading(input.from, input.to_);

  const rows: Array<[string, string]> = [[t.dispatch.fieldOrder, input.ref]];
  if (input.pickup) rows.push([t.dispatch.fieldPickup, input.pickup]);
  rows.push([t.dispatch.fieldRoute, `${input.from} → ${input.to_}`]);
  if (input.unit) rows.push([t.dispatch.fieldUnit, input.unit]);
  if (input.distance) rows.push([t.dispatch.fieldDistance, input.distance]);
  if (input.rate) rows.push([t.dispatch.fieldRate, input.rate]);

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.dispatch.lead },
    { kind: 'facts', rows },
    { kind: 'button', label: t.dispatch.button, href: input.link },
    { kind: 'note', value: t.dispatch.note },
  ];

  return {
    template: 'order.published',
    to: input.to,
    toName: input.companyName,
    subject: t.dispatch.subject(input.ref, input.from, input.to_),
    text: renderText({
      heading,
      blocks,
      operatorEmail: input.operatorEmail,
      signature: t.signature,
      neverAsk: t.neverAsk,
    }),
    html: renderEmail({
      heading,
      preheader: t.dispatch.preheader(input.ref),
      blocks,
      operatorEmail: input.operatorEmail,
      tagline: t.brandTagline,
      neverAsk: t.neverAsk,
    }),
    companyId: input.companyId,
  };
}
