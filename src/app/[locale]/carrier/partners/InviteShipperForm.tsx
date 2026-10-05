'use client';

import { useActionState, useState } from 'react';
import { Button, Field, Input, InputMono, Select } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { inviteShipperAction, type InviteShipperState } from '@/lib/partners/actions';

const initial: InviteShipperState = { error: null, sentTo: null };

/** Перевозчик приглашает своего клиента: название, Y-tunnus, почта, язык письма. */
export function InviteShipperForm() {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(inviteShipperAction, initial);
  const [kind, setKind] = useState<'SHIPPER' | 'CARRIER'>('SHIPPER');

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="kind" value={kind} />
      {/* Кого зовём: заказчику и перевозчику — разные письма и роль в заявке. */}
      <div role="radiogroup" aria-label={t.partners.inviteKind} className="flex flex-wrap gap-2">
        {(['SHIPPER', 'CARRIER'] as const).map((value) => (
          <label
            key={value}
            className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-control border px-3 text-[13px] font-semibold ${kind === value ? 'border-accent text-ink' : 'border-line text-ink-muted hover:border-line-strong'}`}
          >
            <input
              type="radio"
              name="kind_choice"
              value={value}
              checked={kind === value}
              onChange={() => setKind(value)}
              className="accent-[var(--color-accent)]"
            />
            {value === 'SHIPPER' ? t.partners.inviteKindShipper : t.partners.inviteKindCarrier}
          </label>
        ))}
      </div>
      <p className="text-[12px] text-ink-dim">{kind === 'SHIPPER' ? t.partners.inviteKindShipperHint : t.partners.inviteKindCarrierHint}</p>
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
