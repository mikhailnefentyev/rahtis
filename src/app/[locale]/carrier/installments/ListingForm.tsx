'use client';

import { useActionState } from 'react';
import { Button, Field, Select, Textarea, Input } from '@/components/ui';
import { saveListingAction, type ActionState } from '@/lib/installments/actions';
import type { InstallmentUiCopy } from '@/lib/installments/copy';
import type { InstallmentCopy } from '@/lib/landing/installment';
import { TermsFields, type TermsDefaults } from './TermsFields';

const initial: ActionState = { error: null, saved: false };

/** Объявление о продаже своей машины в рассрочку (22.11.2026). */
export function ListingForm({
  locale,
  ui,
  calc,
  id,
  vehicles,
  vehicleId,
  defaults,
  odometer,
  description,
}: {
  locale: string;
  ui: InstallmentUiCopy;
  calc: InstallmentCopy;
  id: string | null;
  vehicles: { id: string; label: string }[];
  vehicleId: string;
  defaults: TermsDefaults;
  odometer: string;
  description: string;
}) {
  const [state, action, pending] = useActionState(saveListingAction, initial);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={ui.listing.vehicle}>
          {(p) => (
            <Select {...p} name="vehicle_id" defaultValue={vehicleId} required>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={ui.listing.odometer}>
          {(p) => <Input {...p} name="odometer" inputMode="numeric" defaultValue={odometer} />}
        </Field>
      </div>

      <TermsFields ui={ui} calc={calc} defaults={defaults} vatEditable withDates={false} locale={locale} />

      <Field label={ui.listing.description} hint={ui.listing.descriptionHint}>
        {(p) => <Textarea {...p} name="description" rows={4} maxLength={4000} defaultValue={description} />}
      </Field>

      {state.error && <p className="text-[14px] text-danger">{state.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="publish" value="1" variant="primary" disabled={pending}>
          {ui.listing.publish}
        </Button>
        <Button type="submit" name="publish" value="0" disabled={pending}>
          {ui.listing.save}
        </Button>
      </div>
    </form>
  );
}
