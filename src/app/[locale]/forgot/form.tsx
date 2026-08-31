'use client';

import { useActionState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { requestPasswordReset, type RecoveryState } from '@/lib/auth/recovery';
import { useI18n } from '@/lib/i18n/provider';

const initial: RecoveryState = { done: false, error: null };

/**
 * Запрос ссылки на восстановление.
 *
 * После отправки форма исчезает и остаётся один абзац. Это не
 * оформление: пока форма на экране, человек жмёт кнопку второй и третий
 * раз, упирается в ограничитель и решает, что сайт сломан.
 */
export function ForgotForm({ locale }: { locale: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(requestPasswordReset, initial);

  if (state.done) {
    return <p className="text-[13px] leading-relaxed text-ink">{t.recovery.sent}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      <Field label={t.company.email} error={state.error ?? undefined} required>
        {(field) => (
          <Input
            {...field}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="ops@company.fi"
          />
        )}
      </Field>

      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? t.recovery.sending : t.recovery.submit}
      </Button>
    </form>
  );
}
