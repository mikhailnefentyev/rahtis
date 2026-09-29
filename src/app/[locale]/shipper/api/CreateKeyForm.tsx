'use client';

import { useActionState, useState } from 'react';
import { Button, Field, Input, Mono, Select } from '@/components/ui';
import { createApiKeyAction, type CreateKeyState } from '@/lib/api/actions';
import type { Locale } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/provider';

const INITIAL: CreateKeyState = { error: null, key: null, name: null };

/**
 * Выпуск ключа. Ключ показывается один раз — прямо после выпуска, с
 * кнопкой копирования и предупреждением: второго показа нет.
 */
export function CreateKeyForm({ locale }: { locale: Locale }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(createApiKeyAction, INITIAL);
  const [copied, setCopied] = useState(false);

  async function copy(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="locale" value={locale} />
        <Field label={t.api.name} hint={t.api.nameHint} className="min-w-56 flex-1">
          {(props) => <Input {...props} name="name" maxLength={60} required placeholder="ERP" />}
        </Field>
        <Field label={t.api.scope} className="w-56">
          {(props) => (
            <Select {...props} name="scope" defaultValue="READ">
              <option value="READ">{t.api.scopes.READ}</option>
              <option value="WRITE">{t.api.scopes.WRITE}</option>
            </Select>
          )}
        </Field>
        <Button type="submit" disabled={pending}>
          {t.api.create}
        </Button>
      </form>

      {state.error && <p className="text-[13px] text-danger">{state.error}</p>}

      {state.key && (
        <div className="rounded-control border border-warn/40 bg-warn/5 p-4">
          <p className="text-[13px] font-semibold">
            {t.api.createdTitle}: {state.name}
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">{t.api.createdHint}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Mono className="break-all rounded-control border border-line bg-surface px-3 py-2 text-[12px]">
              {state.key}
            </Mono>
            <Button type="button" size="sm" onClick={() => void copy(state.key!)}>
              {copied ? t.api.copied : t.api.copy}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
