'use client';

import { useActionState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { signInAction, type SignInState } from '@/lib/auth/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: SignInState = { error: null };

export function SignInForm({ next }: { next: string | null }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(signInAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}

      <Field label={t.auth.email}>
        {(p) => (
          <Input
            {...p}
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="ops@company.fi"
          />
        )}
      </Field>

      <Field label={t.auth.password}>
        {(p) => (
          <Input {...p} name="password" type="password" autoComplete="current-password" required />
        )}
      </Field>

      {/*
        role="alert" — программа чтения с экрана обязана произнести ошибку
        сразу, а не когда пользователь до неё доберётся табом.
      */}
      {state.error && (
        <p role="alert" className="rounded-control border border-danger/35 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
        {pending ? t.auth.submitting : t.auth.submit}
      </Button>
    </form>
  );
}
