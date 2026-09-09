import 'server-only';

import { siteUrl } from '@/lib/config';
import { operatorInbox, sendEmail } from '@/lib/email';
import { orderPublishedEmail } from '@/lib/email/templates/dispatch';
import { emailLocaleOf } from '@/lib/email/text';
import { createFormat } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Рассылка о новом заказе.
 *
 * Письмо здесь — дубль. Уведомление в кабинет пишет триггер базы в той же
 * транзакции, что и публикацию, и оно доходит всегда; почта уходит наружу
 * и там не наша. Поэтому ни одна ошибка в этом файле не должна отменять
 * публикацию: заказ опубликован, даже если ни одно письмо не ушло.
 *
 * Круг получателей и содержимое письма считает база — теми же правилами,
 * которыми живёт стол. Собирать «кто видит заказ» вторым определением в
 * коде значит однажды разослать письмо тому, кому заказ не открыт.
 *
 * Служебным ключом: адреса чужих компаний заказчику не видны, и это
 * правильно. Наружу они и не уходят — попадают прямо в письмо.
 */

type Recipient = {
  company_id: string;
  company_name: string;
  contact_email: string;
  language: string;
};

type Card = {
  ref: string;
  haul_kind: string | null;
  container_feet: number | null;
  trailer: string | null;
  distance_km: number | null;
  rate_cents: number | null;
  pickup_city: string | null;
  pickup_place: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  delivery_city: string | null;
};

/**
 * Единица рейса словами: «Kontti 40 ft» или номер полуприцепа.
 *
 * Контейнер и прицеп различаются здесь, а не в шаблоне письма: шаблон
 * переводится на два языка, и логика выбора, размноженная по локалям,
 * разойдётся на первой же правке.
 */
function unitLabel(card: Card, t: Awaited<ReturnType<typeof getDictionary>>): string | null {
  if (card.haul_kind === 'CONTAINER') {
    const kind = t.haulKind.CONTAINER;
    return card.container_feet ? `${kind} ${card.container_feet} ft` : kind;
  }
  return card.trailer ?? t.haulKind.TRAILER;
}

export async function dispatchPublishedOrder(orderId: string): Promise<void> {
  try {
    const admin = createAdminClient();

    const [{ data: card }, { data: recipients }] = await Promise.all([
      admin.rpc('order_dispatch_card', { p_order_id: orderId }),
      admin.rpc('order_dispatch_recipients', { p_order_id: orderId }),
    ]);

    const order = card as Card | null;
    const list = (recipients ?? []) as Recipient[];

    /* Заказ уже не на столе или брать его некому — рассылать нечего. */
    if (!order || list.length === 0) return;

    const from = order.pickup_city ?? '—';
    const to = order.delivery_city ?? from;
    const operator = operatorInbox();
    const site = siteUrl();

    /*
     * Последовательно, а не Promise.all. Провайдеры почты считают запросы
     * в секунду, и веер из полусотни писем одним залпом получает отказ по
     * скорости — то есть ровно те письма, ради которых всё и затевалось.
     */
    for (const carrier of list) {
      const locale = emailLocaleOf(carrier.language) as Locale;
      const t = await getDictionary(locale);
      const f = createFormat(t.meta.intl);

      const pickupAt = order.pickup_date
        ? [f.date(order.pickup_date), order.pickup_time?.slice(0, 5)].filter(Boolean).join(' · ')
        : null;

      await sendEmail(
        orderPublishedEmail({
          to: carrier.contact_email,
          companyName: carrier.company_name,
          companyId: carrier.company_id,
          ref: order.ref,
          from,
          to_: to,
          pickup: [order.pickup_place, pickupAt].filter(Boolean).join(' · ') || null,
          unit: unitLabel(order, t),
          distance: order.distance_km ? `${f.number(order.distance_km)} km` : null,
          rate: order.rate_cents ? f.eur(order.rate_cents) : null,
          link: `${site}/${locale}/carrier/desk`,
          operatorEmail: operator,
          locale: emailLocaleOf(carrier.language),
        }),
      );
    }
  } catch (cause) {
    /*
     * Публикация уже состоялась и откату не подлежит. Молчать при этом
     * нельзя: неотправленная рассылка — это заказ, о котором никто не
     * узнал, и разбирать такое постфактум придётся по логу.
     */
    console.error('рассылка о заказе не ушла:', cause instanceof Error ? cause.message : cause);
  }
}
