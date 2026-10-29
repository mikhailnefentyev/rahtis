'use client';

import { useActionState, useState } from 'react';
import { Button, Card, CardBody, Field, Input, InputMono, Select } from '@/components/ui';
import { connectGpsAction, type GpsConnectState } from '@/lib/gps/actions';
import { PROVIDER_CATALOG } from '@/lib/gps/catalog';
import { GPS_PROVIDERS, type GpsProvider } from '@/lib/gps/types';
import { useI18n } from '@/lib/i18n/provider';

const initial: GpsConnectState = { error: null, done: false };

/**
 * Подключить систему слежения: выбрать провайдера, вставить ключ из его
 * кабинета. Для Wialon — прежние шаги со ссылкой Locator, для остальных —
 * где в кабинете создаётся ключ и ссылка на инструкцию провайдера.
 */
export function ConnectGps({ startOpen }: { startOpen: boolean }) {
  const { t, locale } = useI18n();
  const s = t.gps;
  const [open, setOpen] = useState(startOpen);
  const [provider, setProvider] = useState<GpsProvider>('WIALON');
  const [advanced, setAdvanced] = useState(false);
  const [state, action, pending] = useActionState(connectGpsAction, initial);
  const info = PROVIDER_CATALOG[provider];

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
            <input type="hidden" name="provider" value={provider} />
            <h3 className="text-[13px] font-semibold">{s.add}</h3>

            <Field label={s.providerLabel}>
              {(p) => (
                <Select
                  {...p}
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value as GpsProvider);
                    setAdvanced(false);
                  }}
                >
                  {GPS_PROVIDERS.map((id) => (
                    <option key={id} value={id}>
                      {PROVIDER_CATALOG[id].name} · {PROVIDER_CATALOG[id].markets}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <ol className="list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-ink-muted">
              {provider === 'WIALON' ? (
                <>
                  <li>{s.step1}</li>
                  <li>{s.step2}</li>
                </>
              ) : (
                <>
                  <li>
                    {s.genericStep1.replace('{provider}', info.name)}{' '}
                    <span className="font-mono text-ink">{info.keyPath}</span>
                  </li>
                  <li>{s.genericStep2}</li>
                </>
              )}
              <li>{s.step3}</li>
            </ol>
            <a href={info.docs} target="_blank" rel="noopener noreferrer" className="self-start text-[12px] text-accent">
              {s.providerDocs.replace('{provider}', info.name)} ↗
            </a>

            <Field label={provider === 'WIALON' ? s.keyLabel : s.genericKeyLabel} required>
              {(p) => <InputMono {...p} name="key" required autoComplete="off" spellCheck={false} placeholder={info.placeholder} />}
            </Field>
            <Field label={s.labelLabel}>{(p) => <Input {...p} name="label" maxLength={80} />}</Field>
            {info.customHost &&
              (advanced ? (
                <Field label={s.serverLabel} hint={provider === 'WIALON' ? s.serverHint : s.genericServerHint.replace('{provider}', info.name)}>
                  {(p) => <InputMono {...p} name="server" placeholder={info.defaultHost} />}
                </Field>
              ) : (
                <button type="button" className="self-start text-[12px] text-ink-muted underline" onClick={() => setAdvanced(true)}>
                  {s.serverToggle}
                </button>
              ))}
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
