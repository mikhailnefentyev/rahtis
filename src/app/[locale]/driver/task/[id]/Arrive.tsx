'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { askPosition } from '@/lib/orders/position';
import { useOutbox } from '../../OutboxProvider';

/**
 * «Saapui» — первый шаг точки. От этого времени считается простой на
 * погрузке и выгрузке, поэтому оно отмечается отдельно от «готово» и
 * уходит временем нажатия, даже если сеть появится через час.
 */
export function Arrive({ stopId }: { stopId: string }) {
  const { t } = useI18n();
  const { enqueue } = useOutbox();
  const [busy, setBusy] = useState(false);

  async function arrive() {
    setBusy(true);
    try {
      const fields: Record<string, string> = { stop_id: stopId };
      const position = await askPosition(4000);
      if (position) {
        fields.lat = String(position.lat);
        fields.lon = String(position.lon);
      }
      await enqueue('ARRIVE', fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={arrive}
      className="h-14 w-full rounded-control bg-accent text-[17px] font-semibold text-accent-ink disabled:opacity-60"
    >
      {busy ? t.driverApp.locating : t.driverApp.arrive}
    </button>
  );
}
