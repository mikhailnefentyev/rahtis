'use client';

import { startTransition, useActionState, useState, useTransition } from 'react';
import { completeStopAction, type DriverState } from '@/lib/driverApp/actions';
import { useI18n } from '@/lib/i18n/provider';
import { askPosition } from '@/lib/orders/position';

const idle: DriverState = { error: null, done: false };

/**
 * Отметка точки водителем.
 *
 * Место берётся в момент нажатия — одна точка с точностью, как у отметки
 * из кабинета. Не дал браузер — отметка идёт без него: доказательство не
 * должно останавливать рейс.
 */
export function StopDone({ stopId }: { stopId: string }) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(completeStopAction, idle);
  const [locating, startLocating] = useTransition();
  const [note, setNote] = useState('');

  function submit() {
    startLocating(async () => {
      const form = new FormData();
      form.set('locale', locale);
      form.set('stop_id', stopId);
      form.set('damage_note', note);
      const position = await askPosition(6000);
      if (position) {
        form.set('lat', String(position.lat));
        form.set('lon', String(position.lon));
        if (position.accuracyM != null) form.set('accuracy', String(position.accuracyM));
      }
      /* После await контекст перехода потерян — отправка оборачивается заново. */
      startTransition(() => action(form));
    });
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
        disabled={locating}
        className="h-14 rounded-control bg-accent text-[17px] font-semibold text-accent-ink disabled:opacity-60"
      >
        {locating ? t.driverApp.locating : `✓ ${t.driverApp.markDone}`}
      </button>

      {state.error && (
        <p role="alert" className="text-[15px] text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}
