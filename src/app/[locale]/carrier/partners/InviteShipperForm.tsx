'use client';

import { useActionState } from 'react';
import { Button, Field, Input, InputMono, Select } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { inviteShipperAction, type InviteShipperState } from '@/lib/partners/actions';

const initial: InviteShipperState = { error: null, sentTo: null };

/** Перевозчик приглашает своего клиента: название, Y-tunnus, почта, язык письма. */
export function InviteShipperForm() {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(inviteShipperAction, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.partners.inviteName} required>
          {(p) => <Input {...p} name="name" required maxLength={200} placeholder="Asiakas Oy" />}
        </Field>
        <Field label={t.partners.inviteBusinessId} required>
          {(p) => <InputMono {...p} name="business_id" required placeholder="1234567-8" />}
        </Field>
        <Field label={t.partners.inviteEmail} required>
          {(p) => <Input {...p} name="email" type="email" required placeholder="ops@asiakas.fi" />}
        </Field>
        <Field label={t.partners.inviteLanguage}>
          {(p) => (
            <Select {...p} name="language" defaultValue={locale}>
              <option value="fi">Suomi</option>
              <option value="en">English</option>
            </Select>
          )}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {t.partners.inviteSend}
        </Button>
        {state.error && <p className="text-[13px] text-danger">{state.error}</p>}
        {state.sentTo && <p className="text-[13px] text-ok">{t.partners.inviteSent.replace('{email}', state.sentTo)}</p>}
      </div>
    </form>
  );
}
