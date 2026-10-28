'use client';

import { useActionState, useState } from 'react';
import { Button, Card, CardBody, Field, Input, InputMono } from '@/components/ui';
import { connectWialonAction, type GpsConnectState } from '@/lib/gps/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: GpsConnectState = { error: null, done: false };

/** Подключить Wialon: вставить ссылку Locator или токен. */
export function ConnectWialon({ startOpen }: { startOpen: boolean }) {
  const { t, locale } = useI18n();
  const s = t.gps;
  const [open, setOpen] = useState(startOpen);
  const [advanced, setAdvanced] = useState(false);
  const [state, action, pending] = useActionState(connectWialonAction, initial);

  return (
    <Card>
      <CardBody>
        {!open ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-ink-muted">{s.addHint}</p>
            <Button onClick={() => setOpen(true)}>{s.add}</Button>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="locale" value={locale} />
            <h3 className="text-[13px] font-semibold">{s.connectTitle}</h3>
            <ol className="list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-ink-muted">
              <li>{s.step1}</li>
              <li>{s.step2}</li>
              <li>{s.step3}</li>
            </ol>
            <Field label={s.keyLabel} required>
              {(p) => <InputMono {...p} name="key" required autoComplete="off" spellCheck={false} placeholder="https://hosting.wialon.com/locator/index.html?t=…" />}
            </Field>
            <Field label={s.labelLabel}>{(p) => <Input {...p} name="label" maxLength={80} />}</Field>
            {advanced ? (
              <Field label={s.serverLabel} hint={s.serverHint}>
                {(p) => <InputMono {...p} name="server" placeholder="hst-api.wialon.com" />}
              </Field>
            ) : (
              <button type="button" className="self-start text-[12px] text-ink-muted underline" onClick={() => setAdvanced(true)}>
                {s.serverToggle}
              </button>
            )}
            <p className="text-[12px] leading-relaxed text-ink-muted">{s.privacyNote}</p>
            {state.error && <p className="text-xs text-danger">{state.error}</p>}
            {state.done && <p className="text-xs text-ok">{s.connected}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? s.checking : s.connect}
              </Button>
              {!startOpen && (
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  {t.action.close}
                </Button>
              )}
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
