'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button, Input } from '@/components/ui';
import { foremanApproveAction, type ForemanState } from '@/lib/sites/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: ForemanState = { error: null, done: false };
const NAME_KEY = 'rahtis-foreman-name';

/** Подтверждение дня прорабом: имя (запоминается в браузере) и необязательное примечание. */
export function ApproveDay({ token, dayId }: { token: string; dayId: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(foremanApproveAction, initial);
  const nameRef = useRef<HTMLInputElement>(null);

  /* Имя прораба помнит браузер: подставляется в поле, без лишнего рендера. */
  useEffect(() => {
    try {
      if (nameRef.current && !nameRef.current.value) nameRef.current.value = localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      /* без хранилища имя вводится каждый раз */
    }
  }, []);

  return (
    <form
      action={action}
      onSubmit={() => {
        try {
          localStorage.setItem(NAME_KEY, nameRef.current?.value ?? '');
        } catch {
          /* не страшно */
        }
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="day_id" value={dayId} />
      <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[12px] text-ink-muted">
        {t.sites.yourName}
        {/* Обычное поле: общему Input ref не передаётся, а имя подставляется через него. */}
        <input
          ref={nameRef}
          name="name"
          required
          className="h-9 w-full rounded-control border border-line bg-sunken px-3 text-[13px] text-ink hover:border-line-strong focus:border-accent focus:outline-none"
        />
      </label>
      <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[12px] text-ink-muted">
        {t.sites.note}
        <Input name="note" />
      </label>
      <Button type="submit" variant="primary" disabled={pending}>
        {t.sites.approve}
      </Button>
      {state.error && <p className="w-full text-[13px] text-danger">{state.error}</p>}
    </form>
  );
}
