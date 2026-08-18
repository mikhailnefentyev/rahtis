'use client';

import { Badge, Button, Countdown, Mono, Plate, Stars } from '@/components/ui';
import { MATCHING } from '@/lib/config';
import { EURO_LABEL } from '@/lib/fleet/labels';
import { cancelOrderAction, chooseOfferAction } from '@/lib/orders/matching';
import { useI18n } from '@/lib/i18n/provider';
import type { Order, ShipperOffer } from '@/types/db';

/**
 * Машина и перевозчик одной карточкой.
 *
 * Заказчик выбирает по рейтингу компании и по машине: сколько осей
 * (пройдёт ли по массе), какая марка, кто за рулём и на каких языках
 * говорит. Телефона водителя здесь нет и быть не может — до старта рейса
 * заказчику он не нужен, и функция offers_for_shipper его не отдаёт.
 */
function CarrierLine({ offer, badge }: { offer: ShipperOffer; badge?: React.ReactNode }) {
  const { m } = useI18n();

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <Plate>{offer.plate}</Plate>
        <Stars value={offer.rating} />
        {badge}
      </div>

      <p className="mt-1 text-xs text-ink-muted">
        <Mono>{m('vehicle.axlesCount', { count: offer.axles })}</Mono> · {offer.make} ·{' '}
        {offer.driver_name}
      </p>

      <p className="text-xs text-ink-dim">
        {offer.carrier_name} · {offer.base_city} · <Mono>{EURO_LABEL[offer.euro_class]}</Mono>
        {offer.languages.length > 0 && (
          <>
            {' · '}
            <Mono>{offer.languages.join('/')}</Mono>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Отклики на заказ и выбор перевозчика.
 *
 * Отклики отсортированы по рейтингу компании (ТЗ §6): заказчик решает
 * быстро, и лучший кандидат должен стоять первым, а не первым нажавшим.
 * Пока оценок нет (они появятся на Этапе 7), порядок остаётся тем, в
 * каком отклики пришли.
 */
export function OffersPanel({ order, offers }: { order: Order; offers: ShipperOffer[] }) {
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
        {offers.map((offer) => (
          <div
            key={offer.offer_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-sunken px-3 py-2.5"
          >
            <CarrierLine
              offer={offer}
              badge={offer.is_chosen && <Badge tone="live">{t.matching.awaitDriver}</Badge>}
            />

            {!awaiting && (
              <form action={chooseOfferAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="offer_id" value={offer.offer_id} />
                <Button type="submit" variant="primary" size="sm">
                  {t.matching.choose}
                </Button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Кто везёт груз — после того как водитель подтвердил работу.
 *
 * Отдельный блок, а не карточка отклика: выбирать больше не из чего, и
 * кнопки выбора здесь были бы ложным обещанием. Раньше этого блока не
 * было вовсе, и с переходом заказа в IN_PROGRESS заказчик переставал
 * видеть, кому отдал груз.
 */
export function AssignedCarrier({ offer }: { offer: ShipperOffer }) {
  const { t } = useI18n();

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="label-micro mb-3">{t.matching.assignedCarrier}</p>
      <div className="rounded-control border border-line bg-sunken px-3 py-2.5">
        <CarrierLine offer={offer} />
      </div>
    </div>
  );
}
