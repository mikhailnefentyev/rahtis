'use client';

import { useActionState, useState } from 'react';
import { Badge, Button, Card, CardBody, Field, Input, Mono } from '@/components/ui';
import { fill } from '@/lib/verification/fill';
import { createShareAction, revokeShareAction, type ShareState } from '@/lib/verification/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: ShareState = { error: null, done: 0 };

export type ShareRow = {
  id: string;
  url: string;
  label: string | null;
  created_at: string;
  expires_at: string | null;
  state: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
};

/**
 * Ссылки для заказчиков вне RAHTIS. Адрес собирает сервер (siteUrl):
 * ссылка уходит наружу и должна вести на боевой домен, а не на тот, с
 * которого открыт кабинет.
 */
export function ShareLinks({ rows, today }: { rows: ShareRow[]; today: string }) {
  const { t, f, locale } = useI18n();
  const v = t.verification;
  const [state, formAction, pending] = useActionState(createShareAction, initial);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardBody>
          <form key={state.done} action={formAction} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
            <input type="hidden" name="locale" value={locale} />
            <Field label={v.shareLabel}>{(p) => <Input {...p} name="label" maxLength={120} />}</Field>
            <Field label={v.shareExpires}>{(p) => <Input {...p} type="date" name="expires_on" min={today} />}</Field>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {v.shareCreate}
            </Button>
            {state.error && (
              <p role="alert" className="text-[13px] text-danger sm:col-span-3">
                {state.error}
              </p>
            )}
          </form>
        </CardBody>
      </Card>

      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-muted">{v.shareNone}</p>
      ) : (
        rows.map((row) => (
          <Card key={row.id} stripe={row.state === 'ACTIVE' ? 'ok' : 'neutral'}>
            <CardBody className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={row.state === 'ACTIVE' ? 'ok' : 'neutral'}>
                  {row.state === 'ACTIVE' ? v.shareActive : row.state === 'EXPIRED' ? v.shareExpired : v.shareRevoked}
                </Badge>
                {row.label && <span className="text-[13px] font-semibold">{row.label}</span>}
                <span className="text-xs text-ink-dim">
                  {fill(v.shareCreated, { date: f.date(row.created_at) })} ·{' '}
                  {row.expires_at ? fill(v.shareUntil, { date: f.date(row.expires_at) }) : v.shareNoExpiry}
                </span>
              </div>
              {row.state === 'ACTIVE' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Mono className="min-w-0 flex-1 truncate text-xs text-ink-muted">{row.url}</Mono>
                  <CopyButton text={row.url} />
                  <form action={revokeShareAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={row.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      {v.shareRevoke}
                    </Button>
                  </form>
                </div>
              )}
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {});
      }}
    >
      {copied ? t.verification.shareCopied : t.verification.shareCopy}
    </Button>
  );
}
