'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui';
import { applyEmailChangesAction, type AmendState } from '@/lib/orders/amend';
import { changeKey, type TripChanges } from '@/lib/inbound/changes';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Сравнение «сейчас → в письме» с галочками. Отмечено всё, что можно
 * применить: письмо клиента — обычно правда, человек снимает лишнее.
 * Строки без галочки (пройденная точка, адрес без координат) видны с
 * причиной — их правят в самом рейсе.
 */
export function EmailChangesForm({
  locale,
  draftId,
  changes,
  stopLabels,
}: {
  locale: string;
  draftId: string;
  changes: TripChanges;
  /** Подпись точки: «Погрузка · Helsinki (Vuosaaren satama)». */
  stopLabels: Record<string, string>;
}) {
  const { t } = useI18n();
  const tc = t.emailChanges;
  const [state, action, pending] = useActionState<AmendState, FormData>(applyEmailChangesAction, { error: null, saved: false });
  const dash = '—';

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="draft_id" value={draftId} />

      {changes.stops.map((stop) => (
        <fieldset key={stop.stopId} className="flex flex-col gap-2">
          <legend className="label-micro mb-1">{stopLabels[stop.stopId] ?? stop.city}</legend>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-ink-faint">
                <th className="w-8 pb-1" />
                <th className="pb-1 pr-3 font-normal" />
                <th className="pb-1 pr-3 font-normal">{tc.now}</th>
                <th className="pb-1 font-normal">{tc.next}</th>
              </tr>
            </thead>
            <tbody>
              {stop.fields.map((field) => {
                const key = changeKey(stop.stopId, field.key);
                const why = field.blocked === 'done' ? tc.blockedDone : field.blocked === 'noCoordinates' ? tc.blockedNoCoordinates : null;
                return (
                  <tr key={key} className="border-t border-line align-top">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        name="c"
                        value={key}
                        defaultChecked={field.patch !== null}
                        disabled={field.patch === null}
                        aria-label={tc.fields[field.key]}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="py-2 pr-3 font-semibold">{tc.fields[field.key]}</td>
                    <td className="py-2 pr-3 text-ink-muted line-through decoration-ink-faint">{field.now || dash}</td>
                    <td className="py-2">
                      <span className="font-semibold">{field.next}</span>
                      {why && <span className="block text-[12px] text-warn">{why}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </fieldset>
      ))}

      {changes.vehicle && (
        <fieldset className="flex flex-col gap-2">
          <legend className="label-micro mb-1">{tc.vehicle}</legend>
          {changes.vehicle.vehicleId ? (
            <label className="flex items-center gap-3 text-[13px]">
              <input type="checkbox" name="c" value="vehicle" defaultChecked className="h-4 w-4" />
              <span className="text-ink-muted line-through decoration-ink-faint">{changes.vehicle.now ?? tc.noVehicle}</span>
              <span aria-hidden>→</span>
              <span className="font-semibold">{changes.vehicle.next}</span>
            </label>
          ) : (
            <p className="text-[13px] text-warn" role="status">
              {tc.vehicleUnknown.replace('{plate}', changes.vehicle.next)}
            </p>
          )}
        </fieldset>
      )}

      {changes.stopCountDiffers && (
        <p className="text-[13px] text-warn" role="status">
          {tc.stopCountDiffers}
        </p>
      )}

      {state.error && (
        <p className="text-[13px] text-danger" role="alert">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? tc.applying : tc.apply}
        </Button>
      </div>
    </form>
  );
}
