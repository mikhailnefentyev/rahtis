'use client';

import Link from 'next/link';
import { publishCapacityAction, withdrawCapacityAction } from '@/lib/capacity/actions';
import { useI18n } from '@/lib/i18n/provider';

/** Свободное место рейса для карточки: что считано и что опубликовано. */
export type TripCapacity = {
  vehicleId: string;
  anchorOrderId: string;
  /** «6 ldm · 9 t» — уже собранная строка. */
  label: string;
  published: boolean;
  offerId: string | null;
  canPublish: boolean;
};

/**
 * Строка «Vapaa tila: 6 ldm · 9 t» на карточке закреплённого рейса:
 * показать другим одним нажатием, поправить (страница места) или снять.
 */
export function CapacityLine({ capacity }: { capacity: TripCapacity }) {
  const { t, locale } = useI18n();
  const c = t.capacity;
  const href = `/${locale}/carrier/capacity#cap-${capacity.vehicleId}-${capacity.anchorOrderId}`;
  const button = 'h-7 rounded-control border border-line bg-surface px-2.5 text-[12px] font-semibold hover:border-ink-dim';

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-control border border-line bg-sunken px-3 py-2 text-[13px]">
      <span>
        {c.freeLine.replace('{space}', capacity.label)}
        {capacity.published && <span className="ml-2 text-[12px] font-semibold text-ok">{c.statusPublished}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        {!capacity.published && capacity.canPublish && (
          <form action={publishCapacityAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="vehicle_id" value={capacity.vehicleId} />
            <input type="hidden" name="order_id" value={capacity.anchorOrderId} />
            <button type="submit" className={button}>
              {c.publish}
            </button>
          </form>
        )}
        <Link href={href} className={button + ' inline-flex items-center'}>
          {c.correct}
        </Link>
        {capacity.published && capacity.offerId && (
          <form action={withdrawCapacityAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="offer_id" value={capacity.offerId} />
            <button type="submit" className={button}>
              {c.withdraw}
            </button>
          </form>
        )}
      </span>
    </div>
  );
}
