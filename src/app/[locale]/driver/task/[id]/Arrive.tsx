'use client';

import { useTransition } from 'react';
import { arriveStopAction } from '@/lib/driverApp/actions';
import { useI18n } from '@/lib/i18n/provider';
import { askPosition } from '@/lib/orders/position';

/**
 * «Saapui» — первый шаг точки. От этого времени считается простой на
 * погрузке и выгрузке, поэтому оно отмечается отдельно от «готово».
 */
export function Arrive({ stopId }: { stopId: string }) {
  const { t, locale } = useI18n();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const form = new FormData();
          form.set('locale', locale);
          form.set('stop_id', stopId);
          const position = await askPosition(5000);
          if (position) {
            form.set('lat', String(position.lat));
            form.set('lon', String(position.lon));
          }
          await arriveStopAction(form);
        })
      }
      className="h-14 w-full rounded-control bg-accent text-[17px] font-semibold text-accent-ink disabled:opacity-60"
    >
      {pending ? t.driverApp.locating : t.driverApp.arrive}
    </button>
  );
}
