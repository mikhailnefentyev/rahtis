'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button, Card, CardBody, Field, Input, Select } from '@/components/ui';
import { saveLaneWatchAction, type LaneWatchState } from '@/lib/backhaul/actions';
import { DEFAULT_RADIUS, RADII } from '@/lib/backhaul/radius';
import { useI18n } from '@/lib/i18n/provider';

const initial: LaneWatchState = { error: null, done: false };
const KINDS = ['TRAILER', 'CONTAINER', 'VAN', 'TRUCK', 'SEMI', 'TIPPER'] as const;

/**
 * Новая подписка: откуда (город и радиус), куда (по желанию), вид
 * перевозки и даты. Города — подсказкой из тех, что RAHTIS знает: другой
 * город сохранить нельзя, координаты для него взять неоткуда.
 */
export function WatchForm({ places }: { places: string[] }) {
  const { t, locale } = useI18n();
  const b = t.backhaul;
  const [state, action] = useActionState(saveLaneWatchAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.done) formRef.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardBody>
        <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <input type="hidden" name="locale" value={locale} />
          <datalist id="lane-places">
            {places.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <Field label={b.from} required hint={b.placeHint}>
            {(p) => <Input {...p} name="from_city" list="lane-places" required autoComplete="off" />}
          </Field>
          <Field label={b.radius}>{(p) => <RadiusSelect {...p} name="from_radius_km" />}</Field>

          <Field label={b.to}>
            {(p) => <Input {...p} name="to_city" list="lane-places" autoComplete="off" />}
          </Field>
          <Field label={b.radius}>{(p) => <RadiusSelect {...p} name="to_radius_km" />}</Field>

          <Field label={b.haulKind}>
            {(p) => (
              <Select {...p} name="haul_kind" defaultValue="">
                <option value="">{b.anyKind}</option>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t.haulKind[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={b.dateFrom}>{(p) => <Input {...p} type="date" name="date_from" />}</Field>
            <Field label={b.dateTo}>{(p) => <Input {...p} type="date" name="date_to" />}</Field>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-ink sm:col-span-2">
            <input type="checkbox" name="notify_email" defaultChecked className="size-4 accent-accent" />
            {b.emailToo}
          </label>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" variant="primary">
              {b.save}
            </Button>
            {state.error && <p className="text-[12.5px] text-danger">{state.error}</p>}
            {state.done && !state.error && <p className="text-[12.5px] text-ok">{b.saved}</p>}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function RadiusSelect(props: { id: string; name: string }) {
  return (
    <Select {...props} defaultValue={String(DEFAULT_RADIUS)}>
      {RADII.map((r) => (
        <option key={r} value={r}>
          {r} km
        </option>
      ))}
    </Select>
  );
}
