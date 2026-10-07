'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { activateLegalVersionAction } from '@/lib/legal/actions';

/**
 * «Ota käyttöön» с подтверждением (8.10.2026).
 *
 * Кнопка стояла у каждой старой редакции, и одно нажатие возвращало в
 * действие устаревшие условия для всех компаний. Теперь первое нажатие
 * спрашивает, какую версию вместо какой, второе — делает. Архивная
 * редакция (старее действующей) получает спокойную кнопку и пометку.
 */
export function ActivateVersion({
  locale,
  documentId,
  version,
  activeVersion,
}: {
  locale: string;
  documentId: string;
  version: number;
  activeVersion: number | null;
}) {
  const { t, m } = useI18n();
  const [asking, setAsking] = useState(false);
  const older = activeVersion !== null && version < activeVersion;

  if (!asking) {
    return (
      <Button size="sm" variant={older ? 'default' : 'primary'} className="ml-auto" onClick={() => setAsking(true)}>
        {t.legal.activate}
      </Button>
    );
  }

  return (
    <form action={activateLegalVersionAction} className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="document_id" value={documentId} />
      <span className={`text-xs ${older ? 'font-semibold text-warn' : 'text-ink-muted'}`} role="status">
        {activeVersion === null
          ? m('legal.confirmFirst', { n: version })
          : m(older ? 'legal.confirmOlder' : 'legal.confirmNewer', { n: version, current: activeVersion })}
      </span>
      <Button size="sm" onClick={() => setAsking(false)}>
        {t.action.cancel}
      </Button>
      <Button type="submit" size="sm" variant={older ? 'danger' : 'primary'} formNoValidate>
        {t.action.confirm}
      </Button>
    </form>
  );
}
