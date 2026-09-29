'use client';

import { useActionState, useState } from 'react';
import { Button, Field, Input, Mono } from '@/components/ui';
import { createWebhookAction, type CreateWebhookState } from '@/lib/api/actions';
import type { Locale } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/provider';

const INITIAL: CreateWebhookState = { error: null, secret: null, url: null };

const EVENTS = [
  'order.taken',
  'order.reopened',
  'order.stop_completed',
  'order.closed',
  'order.cancelled',
  'document.added',
] as const;

/** Новый вебхук: адрес, события; секрет подписи — один раз. */
export function CreateWebhookForm({ locale }: { locale: Locale }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(createWebhookAction, INITIAL);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="locale" value={locale} />
        <Field label={t.api.hooks.url} hint={t.api.hooks.urlHint}>
          {(props) => (
            <Input {...props} name="url" type="url" required maxLength={500} placeholder="https://erp.example.fi/rahtis" />
          )}
        </Field>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="label-micro mb-1">{t.api.hooks.events}</legend>
          {EVENTS.map((e) => (
            <label key={e} className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="events" value={e} defaultChecked />
              <Mono className="text-[12px]">{e}</Mono>
              <span className="text-ink-muted">— {t.api.hooks.eventNames[e]}</span>
            </label>
          ))}
        </fieldset>
        <div>
          <Button type="submit" disabled={pending}>
            {t.api.hooks.create}
          </Button>
        </div>
      </form>

      {state.error && <p className="text-[13px] text-danger">{state.error}</p>}

      {state.secret && (
        <div className="rounded-control border border-warn/40 bg-warn/5 p-4">
          <p className="text-[13px] font-semibold">{t.api.hooks.createdTitle}</p>
          <p className="mt-1 text-[13px] text-ink-muted">{t.api.hooks.createdHint}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Mono className="break-all rounded-control border border-line bg-surface px-3 py-2 text-[12px]">
              {state.secret}
            </Mono>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                void navigator.clipboard
                  .writeText(state.secret!)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false))
              }
            >
              {copied ? t.api.copied : t.api.copy}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
