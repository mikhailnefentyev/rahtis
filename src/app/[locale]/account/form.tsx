'use client';

import { useActionState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { changePasswordAction, type ChangePasswordState } from '@/lib/auth/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: ChangePasswordState = { error: null, done: false };

/**
 * Смена пароля.
 *
 * После успеха страница не уходит никуда: человек пришёл сюда сам и
 * может захотеть проверить остальное. Вместо редиректа — подтверждение
 * на месте и пустые поля, чтобы новый пароль не остался на экране.
 */
export function ChangePasswordForm() {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(changePasswordAction, initial);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      /*
       * key сбрасывает форму после успеха: React монтирует её заново и
       * поля очищаются. Иначе введённый пароль остался бы в разметке до
       * перезагрузки страницы.
       */
      key={state.done ? 'done' : 'editing'}
    >
      <input type="hidden" name="locale" value={locale} />

      <Field label={t.account.current}>
        {(p) => (
          <Input {...p} name="current" type="password" autoComplete="current-password" required />
        )}
      </Field>

      <Field label={t.account.newPassword}>
        {(p) => (
          <Input
            {...p}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        )}
      </Field>

      <Field label={t.account.repeat}>
        {(p) => (
          <Input
            {...p}
            name="repeat"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
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

      {state.done && (
        <p
          role="status"
          className="rounded-control border border-ok/35 bg-ok/10 px-3 py-2 text-[13px] text-ok"
        >
          {t.account.saved}
        </p>
      )}

      <Button type="submit" variant="primary" size="md" className="self-start" disabled={pending}>
        {pending ? t.account.saving : t.account.submit}
      </Button>
    </form>
  );
}
