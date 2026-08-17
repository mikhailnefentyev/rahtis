'use client';

import { Badge, Button, Countdown, Mono, Plate, Stars } from '@/components/ui';
import { MATCHING } from '@/lib/config';
import { cancelOrderAction, chooseOfferAction } from '@/lib/orders/matching';
import { useI18n } from '@/lib/i18n/provider';
import type { Order } from '@/types/db';

export type OfferRow = {
  id: string;
  carrier_company_id: string;
  vehicle_id: string;
  carrier_name: string;
  plate: string;
  driver_name: string;
  axles: number;
  languages: string[];
  /** Средняя оценка компании-перевозчика. Появится на Этапе 7. */
  rating: number | null;
};

/**
 * Отклики на заказ и выбор перевозчика.
 *
 * Отклики отсортированы по рейтингу компании (ТЗ §6): заказчик решает
 * быстро, и лучший кандидат должен стоять первым, а не первым нажавшим.
 */
export function OffersPanel({ order, offers }: { order: Order; offers: OfferRow[] }) {
  const { t, m, locale } = useI18n();

  const awaiting = order.status === 'AWAIT_DRIVER';

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="label-micro">
          {awaiting
            ? t.matching.awaitDriver
            : m('matching.offersCount', {
                count: offers.length,
                max: MATCHING.maxOffersPerOrder,
              })}
        </p>

        <div className="flex items-center gap-3">
          {order.deadline_at && <Countdown deadline={order.deadline_at} />}
          <form action={cancelOrderAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="order_id" value={order.id} />
            <Button type="submit" variant="danger" size="sm">
              {t.matching.cancel}
            </Button>
          </form>
        </div>
      </div>

      {!awaiting && offers.length > 0 && (
        <p className="mb-2.5 text-[13px] text-ink-muted">{t.matching.chooseCarrier}</p>
      )}

      <div className="flex flex-col gap-2">
        {offers.map((offer) => {
          const chosen = order.chosen_offer_id === offer.id;

          return (
            <div
              key={offer.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-sunken px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Plate>{offer.plate}</Plate>
                  <Stars value={offer.rating} />
                  {chosen && <Badge tone="live">{t.matching.awaitDriver}</Badge>}
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {m('vehicle.axlesCount', { count: offer.axles })} · {offer.driver_name} ·{' '}
                  <Mono>{offer.languages.join('/')}</Mono>
                </p>
                <p className="text-xs text-ink-dim">{offer.carrier_name}</p>
              </div>

              {!awaiting && (
                <form action={chooseOfferAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="offer_id" value={offer.id} />
                  <Button type="submit" variant="primary" size="sm">
                    {t.matching.choose}
                  </Button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
