'use client';

import { useActionState, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { resolveIncidentAction } from '@/lib/incidents/actions';
import { useI18n } from '@/lib/i18n/provider';

/** Закрытие записи — в два шага: заметка о причине нужна тому, кто откроет журнал через месяц. */
export function ResolveIncident({ id }: { id: number }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(resolveIncidentAction, { error: null });
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button size="sm" onClick={() => setAsking(true)}>
        {t.incidents.resolve}
      </Button>
    );
  }

  return (
    <form action={action} className="flex min-w-56 flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <Input name="note" maxLength={500} placeholder={t.incidents.notePlaceholder} aria-label={t.incidents.note} />
      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {t.incidents.resolve}
        </Button>
        <Button type="button" size="sm" onClick={() => setAsking(false)}>
          {t.action.cancel}
        </Button>
      </div>
    </form>
  );
}
