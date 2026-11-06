'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { askPosition } from '@/lib/orders/position';
import { useOutbox } from '../../../OutboxProvider';

/**
 * Отметка точки водителем.
 *
 * Место берётся в момент нажатия — одна точка с точностью, как у отметки
 * из кабинета. Не дал браузер — отметка идёт без него: доказательство не
 * должно останавливать рейс. Без связи отметка встаёт в очередь, а экран
 * сразу открывает следующую точку.
 */
export function StopDone({
  stopId,
  plates = null,
}: {
  stopId: string;
  /** Первая погрузка: номера, которые водитель подтверждает (заполнены из рейса). */
  plates?: { truck: string | null; trailer: string | null } | null;
}) {
  const { t } = useI18n();
  const { enqueue } = useOutbox();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [truck, setTruck] = useState(plates?.truck ?? '');
  const [trailer, setTrailer] = useState(plates?.trailer ?? '');
  const [editing, setEditing] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const fields: Record<string, string> = { stop_id: stopId, damage_note: note };
      /* Сверку решает сервер: изменённый номер — флаг сторонам, не отказ. */
      if (plates) {
        fields.reported_plate = truck.trim();
        fields.reported_trailer = trailer.trim();
      }
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

  const plateInput = 'h-12 rounded-control border border-line bg-sunken px-3 font-mono text-[17px] font-bold uppercase';

  return (
    <div className="mt-2 flex flex-col gap-2">
      {/* Одна строка: номера заполнены, водитель меняет их, только если едет на другой машине. */}
      {plates && (plates.truck || plates.trailer) && (
        <div className="rounded-card border border-line bg-surface px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] text-ink-muted">{t.driverApp.vehiclePlates}</span>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="h-10 text-[15px] font-semibold text-accent">
                {t.driverApp.vehicleChange}
              </button>
            )}
          </div>
          {editing ? (
            <div className="mt-1 flex flex-col gap-2">
              <span className="text-[14px] text-ink-muted">{t.driverApp.vehicleHint}</span>
              {plates.truck && (
                <label className="flex flex-col gap-1">
                  <span className="text-[15px] text-ink-muted">{t.driverApp.vehicleTruck}</span>
                  <input value={truck} onChange={(e) => setTruck(e.target.value)} maxLength={20} autoCapitalize="characters" className={plateInput} />
                </label>
              )}
              {plates.trailer && (
                <label className="flex flex-col gap-1">
                  <span className="text-[15px] text-ink-muted">{t.driverApp.vehicleTrailer}</span>
                  <input value={trailer} onChange={(e) => setTrailer(e.target.value)} maxLength={20} autoCapitalize="characters" className={plateInput} />
                </label>
              )}
            </div>
          ) : (
            <p className="font-mono text-[17px] font-bold tracking-tight">
              {[truck && `${t.driverApp.vehicleTruck} ${truck}`, trailer && `${t.driverApp.vehicleTrailer} ${trailer}`].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}

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
