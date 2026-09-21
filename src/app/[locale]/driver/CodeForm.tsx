'use client';

import { useActionState } from 'react';
import { acceptCodeAction, type CodeState } from '@/lib/driverApp/actions';
import { useI18n } from '@/lib/i18n/provider';

const idle: CodeState = { error: null };

/**
 * Вход по телефону и коду из приглашения — прямо в установленном
 * приложении, где нет адресной строки для ссылки.
 */
export function CodeForm() {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(acceptCodeAction, idle);

  return (
    <form action={action} className="flex w-full flex-col gap-3 text-left">
      <input type="hidden" name="locale" value={locale} />
      <h2 className="text-center text-[17px] font-semibold">{t.driverApp.codeTitle}</h2>

      <label className="flex flex-col gap-1">
        <span className="text-[15px] text-ink-muted">{t.driverApp.codePhone}</span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          defaultValue="+358"
          className="h-14 rounded-control border border-line bg-surface px-4 font-mono text-[18px]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[15px] text-ink-muted">{t.driverApp.codeLabel}</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          placeholder="123456"
          className="h-14 rounded-control border border-line bg-surface px-4 text-center font-mono text-2xl tracking-[0.3em]"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-[15px] text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-14 rounded-control bg-accent text-[17px] font-semibold text-accent-ink disabled:opacity-60"
      >
        {t.driverApp.codeSubmit}
      </button>
    </form>
  );
}
