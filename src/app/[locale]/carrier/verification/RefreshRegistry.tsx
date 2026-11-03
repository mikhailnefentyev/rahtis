'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui';
import { refreshRegistryAction, type RefreshState } from '@/lib/verification/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: RefreshState = { error: null };

/** «Päivitä PRH:sta» — та же сверка, что при заявке; снимок перезаписывается. */
export function RefreshRegistry() {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(refreshRegistryAction, initial);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t.verification.refreshing : t.verification.refresh}
      </Button>
      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
