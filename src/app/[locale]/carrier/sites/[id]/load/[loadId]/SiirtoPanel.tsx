'use client';

import { useActionState } from 'react';
import { Button, Field, Input, InputMono, Select } from '@/components/ui';
import { saveReceiverAction, sendToSiirtoAction, type ReceiverState, type SiirtoState } from '@/lib/siirto/actions';
import { TREATMENT_CODES, type SiirtoMissing } from '@/lib/siirto/document';
import { useI18n } from '@/lib/i18n/provider';

const RECEIVER_KEYS: SiirtoMissing[] = ['receiverCompany', 'receiverAddress', 'receiverContact', 'treatment'];

/**
 * Реестр SIIRTO у рейса (Финляндия): что не хватает, отправить, исправить,
 * удалить. Неполный документ не отправляется — список «что дописать» с
 * подсказкой, где это делается. Данные пункта приёмки можно дописать здесь.
 */
export function SiirtoPanel({
  loadId,
  enabled,
  test,
  documentId,
  sentAt,
  lastError,
  missing,
  receiver,
}: {
  loadId: string;
  /** Ключи SIIRTO заданы на сервере. */
  enabled: boolean;
  test: boolean;
  documentId: string | null;
  sentAt: string | null;
  lastError: string | null;
  /** null — документ полный. */
  missing: SiirtoMissing[] | null;
  receiver: {
    siteId: string;
    operatorName: string | null;
    operatorBusinessId: string | null;
    postalCode: string | null;
    contactName: string | null;
    contactPhone: string | null;
    treatmentCode: string | null;
  } | null;
}) {
  const { t, f, locale } = useI18n();
  const ts = t.siirto;
  const [state, send, sending] = useActionState<SiirtoState, FormData>(sendToSiirtoAction, { error: null, sent: false });
  const [rState, saveReceiver, saving] = useActionState<ReceiverState, FormData>(saveReceiverAction, { error: null, saved: false });
  const needsReceiver = receiver !== null && (missing ?? []).some((k) => RECEIVER_KEYS.includes(k));

  return (
    <section className="mt-6 rounded-card border border-line bg-surface p-5 print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{ts.title}</h2>
        {test && <span className="text-[12px] text-warn">{ts.testEnv}</span>}
      </div>

      <p className="mt-1.5 text-[13px] text-ink-muted">
        {documentId ? ts.sent.replace('{date}', sentAt ? f.dateTime(sentAt) : '—') : ts.notSent}
      </p>
      {lastError && !state.sent && <p className="mt-1.5 text-[13px] text-danger">{ts.failed.replace('{reason}', lastError)}</p>}

      {!enabled ? (
        <p className="mt-3 text-[13px]">{ts.off}</p>
      ) : missing ? (
        <div className="mt-3">
          <p className="text-[13px] font-semibold">{ts.incomplete}</p>
          <ul className="mt-1.5 list-disc pl-5 text-[13px] text-ink-muted">
            {missing.map((k) => (
              <li key={k}>{ts.missing[k]}</li>
            ))}
          </ul>
        </div>
      ) : (
        <form action={send} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="load_id" value={loadId} />
          <Button type="submit" name="intent" value="send" variant="primary" size="sm" disabled={sending}>
            {sending ? ts.sending : documentId ? ts.update : ts.send}
          </Button>
          {documentId && (
            <Button type="submit" name="intent" value="delete" variant="ghost" size="sm" disabled={sending}>
              {ts.remove}
            </Button>
          )}
        </form>
      )}
      {state.error && <p className="mt-2 text-[13px] text-danger" role="alert">{state.error}</p>}
      {state.sent && <p className="mt-2 text-[13px] text-ok" role="status">{ts.done}</p>}

      {needsReceiver && receiver && (
        <form action={saveReceiver} className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <p className="text-[13px] font-semibold sm:col-span-2">{ts.receiverTitle}</p>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="site_id" value={receiver.siteId} />
          <Field label={ts.operatorName}>{(p) => <Input {...p} name="operator_name" defaultValue={receiver.operatorName ?? ''} />}</Field>
          <Field label={ts.operatorBusinessId}>
            {(p) => <InputMono {...p} name="operator_business_id" placeholder="1234567-8" defaultValue={receiver.operatorBusinessId ?? ''} />}
          </Field>
          <Field label={ts.postalCode}>{(p) => <InputMono {...p} name="postal_code" defaultValue={receiver.postalCode ?? ''} />}</Field>
          <Field label={ts.treatment}>
            {(p) => (
              <Select {...p} name="treatment_code" defaultValue={receiver.treatmentCode ?? ''}>
                <option value="">—</option>
                {TREATMENT_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code} · {ts.treatments[code]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={ts.receiverContact}>{(p) => <Input {...p} name="contact_name" defaultValue={receiver.contactName ?? ''} />}</Field>
          <Field label={ts.contactPhone}>
            {(p) => <InputMono {...p} name="contact_phone" type="tel" defaultValue={receiver.contactPhone ?? ''} />}
          </Field>
          {rState.error && <p className="text-[13px] text-danger sm:col-span-2">{rState.error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={saving}>
              {ts.receiverSave}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
