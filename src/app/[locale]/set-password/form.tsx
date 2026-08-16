'use client';

import { useActionState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { setPasswordAction, type SetPasswordState } from '@/lib/auth/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: SetPasswordState = { error: null };

export function SetPasswordForm() {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(setPasswordAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      <Field label={t.invite.password}>
        {(p) => (
          <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={8} />
        )}
      </Field>

      <Field label={t.invite.repeat}>
        {(p) => (
          <Input {...p} name="repeat" type="password" autoComplete="new-password" required minLength={8} />
        )}
      </Field>

      {state.error && (
        <p
          role="alert"
          className="rounded-control border border-danger/35 bg-danger/10 px-3 py-2 text-[13px] text-danger"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? t.auth.submitting : t.invite.submit}
      </Button>
    </form>
  );
}
