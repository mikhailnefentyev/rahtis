'use client';

import { useActionState, useState } from 'react';
import { Button, Modal, Select } from '@/components/ui';
import { countryChoices } from '@/lib/drivers/allowanceDays';
import { saveDayFactAction, type DayFactState } from '@/lib/drivers/dayFactsActions';
import { useI18n } from '@/lib/i18n/provider';
import { flag, useCountryName } from '../payCountry';

const NIGHTS = ['HOME', 'CAB', 'HOTEL', 'FREE'] as const;
const MEALS = ['B', 'L', 'D'] as const;

/**
 * Страна дня в отчёте и её правка: страна, ночёвка, бесплатное питание.
 * Пустая страна — снова автоматически (последняя страна точек рейсов).
 */
export function DayCountryCell({
  driverId,
  day,
  dayLabel,
  home,
  country,
  source,
  countries,
  manualCountry,
  night,
  meals,
}: {
  driverId: string;
  day: string;
  dayLabel: string;
  home: string;
  country: string | null;
  source: 'manual' | 'auto' | null;
  countries: string[];
  /** Страна из правки (для формы): автоматическая в поле не подставляется. */
  manualCountry: string | null;
  night: string | null;
  meals: string | null;
}) {
  const { t, locale } = useI18n();
  const d = t.dayPay;
  const name = useCountryName();
  const [open, setOpen] = useState(false);
  /* Сохранено — закрыть: страница пересчитается после revalidatePath. */
  const [state, action] = useActionState<DayFactState, FormData>(
    async (previous, formData) => {
      const result = await saveDayFactAction(previous, formData);
      if (result.ok) setOpen(false);
      return result;
    },
    { ok: false, error: false },
  );

  const { first, rest } = countryChoices(home);
  const choices = {
    first,
    rest: [...rest].sort((a, b) => name(a).localeCompare(name(b))),
  };

  const label = country ? (
    <span className="whitespace-nowrap">
      <span aria-hidden>{flag(country)}</span> {country}
    </span>
  ) : (
    <span className="text-ink-faint">{d.unknown}</span>
  );

  const extra = [night ? d.nights[night as (typeof NIGHTS)[number]] : null, meals ? meals.split('').join('·') : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-start text-left hover:underline"
        title={[
          source === 'manual' ? d.sourceManual : source === 'auto' ? d.sourceAuto : d.unknown,
          countries.length > 1 ? countries.join(', ') : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <span>
          {label}
          {source === 'manual' && <span className="ml-1 text-ink-faint">✎</span>}
        </span>
        {extra && <span className="text-[11px] text-ink-dim">{extra}</span>}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`${d.colCountry} · ${dayLabel}`}>
        <form action={action} className="flex flex-col gap-4 px-5 py-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="driver_id" value={driverId} />
          <input type="hidden" name="day" value={day} />

          <label className="flex flex-col gap-1.5">
            <span className="label-micro">{d.colCountry}</span>
            <Select name="country" defaultValue={manualCountry ?? ''}>
              <option value="">
                {d.autoOption}
                {source === 'auto' && country ? ` — ${name(country)}` : ''}
              </option>
              <optgroup label={d.neighbours}>
                {choices.first.map((c) => (
                  <option key={c} value={c}>
                    {flag(c)} {name(c)}
                  </option>
                ))}
              </optgroup>
              <optgroup label={d.allCountries}>
                {choices.rest.map((c) => (
                  <option key={c} value={c}>
                    {flag(c)} {name(c)}
                  </option>
                ))}
              </optgroup>
            </Select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label-micro">{d.night}</span>
            <Select name="night" defaultValue={night ?? ''}>
              <option value="">{d.nightNone}</option>
              {NIGHTS.map((n) => (
                <option key={n} value={n}>
                  {d.nights[n]}
                </option>
              ))}
            </Select>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="label-micro mb-1.5">{d.meals}</legend>
            <div className="flex flex-wrap gap-4 text-[13px]">
              {MEALS.map((m) => (
                <label key={m} className="flex items-center gap-1.5">
                  <input type="checkbox" name="meals" value={m} defaultChecked={(meals ?? '').includes(m)} />
                  {m === 'B' ? d.mealB : m === 'L' ? d.mealL : d.mealD}
                </label>
              ))}
            </div>
          </fieldset>

          {state.error && (
            <p role="alert" className="text-xs text-danger">
              {d.saveError}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button onClick={() => setOpen(false)}>{d.cancel}</Button>
            <Button type="submit" variant="primary">
              {d.save}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
