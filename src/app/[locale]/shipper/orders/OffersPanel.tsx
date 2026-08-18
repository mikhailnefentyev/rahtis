'use client';

import { Badge, Button, Countdown, Kv, Plate, Stars } from '@/components/ui';
import { APP, MATCHING } from '@/lib/config';
import { EURO_LABEL } from '@/lib/fleet/labels';
import { cancelOrderAction, chooseOfferAction } from '@/lib/orders/matching';
import { useI18n } from '@/lib/i18n/provider';
import type { ShipperOffer, ShipperOrder } from '@/types/db';

/**
 * Машина в отклике — без опознавательных признаков перевозчика.
 *
 * Aivomaa работает принципалом-посредником (ТЗ §1): заказчик платит
 * оператору, оператор платит перевозчику. Контрагент заказчика —
 * Aivomaa, и в его кабинете исполнителем значится Aivomaa. Кто именно
 * из подрядчиков поехал — дело оператора.
 *
 * Что заказчик всё же видит и почему: рейтинг — по нему он выбирает
 * (ТЗ §6); марка, оси, эко-класс и база — по ним он понимает, пройдёт ли
 * сцепка по его площадке и успеет ли машина к окну погрузки.
 */
function VehicleLine({ offer, badge }: { offer: ShipperOffer; badge?: React.ReactNode }) {
  const { m } = useI18n();

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[13px] font-semibold tracking-tight text-ink">
          {m('matching.variant', { no: offer.variant_no })}
        </span>
        <Stars value={offer.rating} />
        {badge}
      </div>

      <p className="mt-1 text-xs text-ink-muted">
        {offer.make} · {m('vehicle.axlesCount', { count: offer.axles })} ·{' '}
        {EURO_LABEL[offer.euro_class]}
      </p>

      <p className="text-xs text-ink-dim">
        {m('matching.basedIn', { city: offer.base_city })}
        {offer.languages.length > 0 && <>{' · '}{offer.languages.join('/')}</>}
      </p>
    </div>
  );
}

/**
 * Отклики на заказ и выбор исполнителя.
 *
 * Отсортированы по рейтингу (ТЗ §6): заказчик решает быстро, и лучший
 * кандидат должен стоять первым, а не первым нажавшим. Пока оценок нет
 * (Этап 7), порядок остаётся тем, в каком отклики пришли.
 */
export function OffersPanel({ order, offers }: { order: ShipperOrder; offers: ShipperOffer[] }) {
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
            <VehicleLine
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
 * Кто везёт груз после подтверждения водителем.
 *
 * Исполнитель здесь — Aivomaa, и это не формальность: именно она отвечает
 * перед заказчиком по договору и выставляет ему счёт.
 *
 * Госномер и водитель показываются, потому что без них не выписать
 * пропуск в порт и не предупредить терминал, кого ждать. Опознавательный
 * признак это слабый: по номеру перевозчика можно найти в реестре, но
 * работать без этих данных заказчик не сможет.
 */
export function AssignedCarrier({ offer }: { offer: ShipperOffer }) {
  const { t, m } = useI18n();

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="label-micro mb-3">{t.matching.assignedCarrier}</p>

      <div className="rounded-control border border-line bg-sunken px-3 py-2.5">
        <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
          {offer.plate && <Plate>{offer.plate}</Plate>}
          <Badge tone="ok">{APP.operator.legalName}</Badge>
        </div>

        <div className="flex flex-col gap-1">
          {offer.driver_name && <Kv k={t.vehicle.driver} v={offer.driver_name} />}
          <Kv k={t.vehicle.make} v={offer.make} />
          {/*
            * Число осей заказчику нужно по делу: от него зависит
            * допустимая нагрузка и пройдёт ли сцепка по его площадке.
            */}
          <Kv k={t.vehicle.axles} v={m('vehicle.axlesCount', { count: offer.axles })} />
          <Kv k={t.vehicle.euro} v={EURO_LABEL[offer.euro_class]} />
          <Kv k={t.vehicle.base} v={offer.base_city} />
        </div>
      </div>
    </div>
  );
}
