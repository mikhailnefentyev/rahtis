'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Card, CardBody, Field, Input, InputMono, Select } from '@/components/ui';
import { saveVehicleAction, type VehicleState } from '@/lib/fleet/actions';
import { REGIONS } from '@/lib/config';
import { useI18n } from '@/lib/i18n/provider';
import { DRIVER_LANGUAGES, type Vehicle } from '@/types/db';

const initial: VehicleState = { error: null, done: false };

/**
 * Карточка авто: создание и правка.
 *
 * Правка существенных полей у допущенной машины возвращает её на проверку —
 * это делает триггер в базе, а форма предупреждает об этом заранее, чтобы
 * пропавший допуск не выглядел поломкой.
 */
export function VehicleForm({
  vehicle,
  onClose,
}: {
  vehicle: Vehicle | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(saveVehicleAction, initial);
  const [languages, setLanguages] = useState<string[]>(vehicle?.languages ?? ['FI']);

  /* Закрываем форму после успешного сохранения — в эффекте, а не в рендере. */
  useEffect(() => {
    if (state.done) onClose();
  }, [state.done, onClose]);

  function toggleLanguage(code: string) {
    setLanguages((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );
  }

  return (
    <Card stripe="info">
      <CardBody>
        <h3 className="mb-4 text-[13px] font-semibold tracking-tight">
          {vehicle ? t.fleet.editVehicle : t.fleet.newVehicle}
        </h3>

        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          {vehicle && <input type="hidden" name="id" value={vehicle.id} />}
          {languages.map((code) => (
            <input key={code} type="hidden" name="languages" value={code} />
          ))}

          <Field label={t.vehicle.plate} required>
            {(p) => (
              <InputMono
                {...p}
                name="plate"
                required
                defaultValue={vehicle?.plate ?? ''}
                placeholder="HKO-441"
                className="uppercase"
              />
            )}
          </Field>

          <Field label={t.vehicle.make} required>
            {(p) => (
              <Input {...p} name="make" required defaultValue={vehicle?.make ?? ''} placeholder="Volvo FH" />
            )}
          </Field>

          <Field label={t.vehicle.driver} required>
            {(p) => (
              <Input
                {...p}
                name="driver_name"
                required
                defaultValue={vehicle?.driver_name ?? ''}
                placeholder="Antti Nieminen"
              />
            )}
          </Field>

          <Field label={t.vehicle.whatsapp} required>
            {(p) => (
              <InputMono
                {...p}
                name="whatsapp"
                required
                defaultValue={vehicle?.whatsapp ?? '+358'}
                placeholder="+358401112233"
              />
            )}
          </Field>

          <Field label={t.vehicle.axles} required>
            {(p) => (
              <Select {...p} name="axles" required defaultValue={String(vehicle?.axles ?? 3)}>
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label={t.vehicle.euro} required>
            {(p) => (
              <Select {...p} name="euro_class" required defaultValue={vehicle?.euro_class ?? 'EURO_6'}>
                <option value="EURO_6">Euro 6</option>
                <option value="EURO_5">Euro 5</option>
                <option value="EURO_4">Euro 4</option>
              </Select>
            )}
          </Field>

          <Field label={t.vehicle.base} required>
            {(p) => (
              <Select {...p} name="base_city" required defaultValue={vehicle?.base_city ?? REGIONS[0]}>
                {REGIONS.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="sm:col-span-2">
            <span className="label-micro mb-2 block">{t.vehicle.languages}</span>
            <div className="flex flex-wrap gap-1.5">
              {DRIVER_LANGUAGES.map((code) => {
                const on = languages.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleLanguage(code)}
                    className={
                      on
                        ? 'cursor-pointer rounded-control border border-accent bg-accent px-2.5 py-1 font-mono text-xs font-bold text-accent-ink'
                        : 'cursor-pointer rounded-control border border-line bg-raised px-2.5 py-1 font-mono text-xs text-ink-faint transition-colors duration-150 hover:border-accent-line hover:text-ink'
                    }
                  >
                    {code}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-faint">{t.fleet.languagesHint}</p>
          </div>

          {vehicle?.access === 'APPROVED' && (
            <p className="rounded-control border border-warn/35 bg-warn/10 px-3 py-2 text-[13px] text-warn sm:col-span-2">
              {t.fleet.onReview}
            </p>
          )}

          {state.error && (
            <p role="alert" className="text-[13px] text-danger sm:col-span-2">
              {state.error}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" onClick={onClose} className="flex-1">
              {t.action.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={pending || languages.length === 0}
              className="flex-[2]"
            >
              {t.action.save}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
