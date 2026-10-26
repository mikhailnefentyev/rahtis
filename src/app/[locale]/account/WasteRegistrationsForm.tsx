'use client';

import { useActionState } from 'react';
import { Button, Card, CardBody, Field, InputMono } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { saveWasteRegistrationsAction, type RegistrationsState } from '@/lib/waste/actions';
import { REGISTRATION_COUNTRIES, REGISTRATION_LABEL, type WasteRegistrations } from '@/lib/waste/registrations';

const initial: RegistrationsState = { error: null, saved: false };

/** Номера регистраций перевозчика отходов по странам — печатаются в документах на отходы. */
export function WasteRegistrationsForm({ registrations }: { registrations: WasteRegistrations }) {
  const { t, locale } = useI18n();
  const w = t.waste;
  const [state, action, pending] = useActionState(saveWasteRegistrationsAction, initial);
  const region = new Intl.DisplayNames([locale], { type: 'region' });

  return (
    <Card>
      <CardBody>
        <h2 className="text-[15px] font-semibold tracking-tight">{w.registrationsTitle}</h2>
        <p className="mt-1 mb-4 text-[13px] leading-relaxed text-ink-muted">{w.registrationsHint}</p>
        <form action={action} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          {REGISTRATION_COUNTRIES.map((c) => (
            <Field key={c} label={`${region.of(c) ?? c} · ${REGISTRATION_LABEL[c]}`}>
              {(p) => <InputMono {...p} name={`reg_${c}`} defaultValue={registrations[c] ?? ''} maxLength={80} />}
            </Field>
          ))}
          {state.error && <p className="text-[13px] text-danger sm:col-span-2">{state.error}</p>}
          {state.saved && !pending && <p className="text-[13px] text-ok sm:col-span-2">{w.registrationsSaved}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {w.save}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
