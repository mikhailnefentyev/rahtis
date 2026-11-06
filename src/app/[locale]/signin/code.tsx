'use client';

import { useActionState } from 'react';
import { Button, Field } from '@/components/ui';
import { CodeInput } from '@/components/domain/TwoStep';
import { signOutAction } from '@/lib/auth/actions';
import { verifySignInCodeAction, type CodeState } from '@/lib/auth/twoStepActions';
import { useI18n } from '@/lib/i18n/provider';

const initial: CodeState = { error: null, done: false };

/**
 * Шаг кода после пароля (или ссылки из письма) у тех, кто включил
 * двухэтапный вход. Одно поле, автозаполнение кода из приложения.
 */
export function CodeStep({ next }: { next: string | null }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(verifySignInCodeAction, initial);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{t.twoStep.signInTitle}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{t.twoStep.signInHint}</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        {next && <input type="hidden" name="next" value={next} />}

        <Field label={t.twoStep.code}>{(p) => <CodeInput {...p} autoFocus className="max-w-none" />}</Field>

        {state.error && (
          <p role="alert" className="rounded-control border border-danger/35 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {state.error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
          {t.twoStep.confirm}
        </Button>
      </form>

      <p className="text-xs leading-relaxed text-ink-faint">{t.twoStep.lostPhoneShort}</p>

      {/* Не тот человек за компьютером — выйти и войти своим. */}
      <form action={signOutAction}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="text-[13px] text-ink-muted hover:text-ink">
          {t.twoStep.signInOther}
        </button>
      </form>
    </div>
  );
}
