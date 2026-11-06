'use client';

import { useActionState, useState } from 'react';
import { Button, Card, CardBody, Field, Mono, Textarea } from '@/components/ui';
import { rotateInboxAddressAction, saveInboxSendersAction, type InboxSettingsState } from '@/lib/inbound/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: InboxSettingsState = { error: null, saved: false };

/** Адрес и «Копировать» — одной строкой (страница заказов, свои рейсы). */
export function OrderInboxLine({ address }: { address: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Буфер недоступен — адрес виден и выделяется руками. */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
      <span className="text-ink-muted">{t.emailInbox.forwardHere}</span>
      <Mono className="select-all break-all text-[13px] text-ink">{address}</Mono>
      <Button size="sm" onClick={copy}>
        {copied ? t.emailInbox.copied : t.emailInbox.copy}
      </Button>
    </div>
  );
}

/**
 * Настройки в /account: адрес, новый адрес (главный пользователь) и
 * дополнительные отправители — общий ящик заказов компании и т. п.
 */
export function OrderInboxSettings({ address, senders, canManage }: { address: string; senders: string[]; canManage: boolean }) {
  const { t, locale } = useI18n();
  const e = t.emailInbox;
  const [rotateState, rotate, rotating] = useActionState(rotateInboxAddressAction, initial);
  const [sendersState, saveSenders, saving] = useActionState(saveInboxSendersAction, initial);

  return (
    <Card id="order-email" className="scroll-mt-24">
      <CardBody className="flex flex-col gap-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{e.title}</h2>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-muted">{e.hint}</p>
        </div>
        <OrderInboxLine address={address} />
        <p className="max-w-xl text-xs text-ink-faint">{e.whoCanSend}</p>

        {canManage ? (
          <>
            <form action={saveSenders} className="flex flex-col gap-2">
              <input type="hidden" name="locale" value={locale} />
              <Field label={e.sendersLabel}>
                {(p) => (
                  <Textarea {...p} name="senders" rows={3} defaultValue={senders.join('\n')} placeholder="tilaukset@yritys.fi" disabled={saving} />
                )}
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" size="sm" disabled={saving}>
                  {e.sendersSave}
                </Button>
                {sendersState.error && <p className="text-[13px] text-danger">{sendersState.error}</p>}
                {sendersState.saved && !saving && <p className="text-[13px] text-ok">{e.saved}</p>}
              </div>
            </form>
            <form
              action={rotate}
              onSubmit={(event) => {
                if (!window.confirm(e.rotateConfirm)) event.preventDefault();
              }}
              className="flex flex-wrap items-center gap-3"
            >
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" size="sm" variant="ghost" disabled={rotating}>
                {e.rotate}
              </Button>
              <span className="text-xs text-ink-faint">{e.rotateHint}</span>
              {rotateState.error && <p className="w-full text-[13px] text-danger">{rotateState.error}</p>}
              {rotateState.saved && !rotating && <p className="w-full text-[13px] text-ok">{e.rotated}</p>}
            </form>
          </>
        ) : (
          senders.length > 0 && (
            <p className="text-[13px] text-ink-muted">
              {e.sendersLabel}: <Mono className="text-[13px]">{senders.join(', ')}</Mono>
            </p>
          )
        )}
      </CardBody>
    </Card>
  );
}
