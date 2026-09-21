'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { askPosition } from '@/lib/orders/position';
import { useOutbox } from '../../OutboxProvider';

/**
 * Отметка точки водителем.
 *
 * Место берётся в момент нажатия — одна точка с точностью, как у отметки
 * из кабинета. Не дал браузер — отметка идёт без него: доказательство не
 * должно останавливать рейс. Без связи отметка встаёт в очередь, а экран
 * сразу открывает следующую точку.
 */
export function StopDone({ stopId }: { stopId: string }) {
  const { t } = useI18n();
  const { enqueue } = useOutbox();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function submit() {
    setBusy(true);
    try {
      const fields: Record<string, string> = { stop_id: stopId, damage_note: note };
      const position = await askPosition(5000);
      if (position) {
        fields.lat = String(position.lat);
        fields.lon = String(position.lon);
        if (position.accuracyM != null) fields.accuracy = String(position.accuracyM);
      }
      await enqueue('COMPLETE', fields);
      setNote('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[15px] text-ink-muted">{t.driverApp.damage}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={t.driverApp.damagePlaceholder}
          className="rounded-control border border-line bg-sunken px-3 py-2 text-[16px]"
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="h-14 rounded-control bg-accent text-[17px] font-semibold text-accent-ink disabled:opacity-60"
      >
        {busy ? t.driverApp.locating : `✓ ${t.driverApp.markDone}`}
      </button>
    </div>
  );
}
