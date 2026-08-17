'use client';

import { useActionState, useTransition } from 'react';
import { Badge, Button, Card, CardBody, Field, Input, Mono } from '@/components/ui';
import { documentUrlAction, uploadDocumentAction, type UploadState } from '@/lib/fleet/actions';
import { useI18n } from '@/lib/i18n/provider';
import type { CompanyDocument, DocumentKind } from '@/types/db';

const initial: UploadState = { error: null };

/**
 * Лицензия или страховка компании.
 *
 * Состояние документа показывается тремя словами, а не только цветом:
 * «просрочен» читается и без различения красного.
 */
export function DocumentCard({
  kind,
  document,
  daysLeft,
}: {
  kind: DocumentKind;
  document: CompanyDocument | null;
  /** Считается на сервере: рендер обязан быть чистым, а часы клиента могут врать. */
  daysLeft: number | null;
}) {
  const { t, m, f, locale } = useI18n();
  const [state, formAction, pending] = useActionState(uploadDocumentAction, initial);
  const [opening, startOpening] = useTransition();

  const validUntil = document?.valid_until ?? null;
  const expired = daysLeft != null && daysLeft < 0;
  const expiringSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 30;

  const tone = !document ? 'warn' : expired ? 'danger' : expiringSoon ? 'warn' : 'ok';

  function open() {
    if (!document) return;
    startOpening(async () => {
      const url = await documentUrlAction(document.storage_path);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <Card stripe={tone}>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="text-[13px] font-semibold tracking-tight">{t.documents[kind]}</h3>
          <Badge tone={tone}>
            {!document
              ? t.documents.notUploaded
              : expired
                ? t.documents.expired
                : t.companyStatus.ACTIVE}
          </Badge>
        </div>

        {document ? (
          <div className="flex flex-col gap-1 text-[13px] text-ink-muted">
            <span className="truncate">{document.file_name}</span>
            <Mono className="text-xs">
              {validUntil
                ? expired
                  ? m('documents.expiredAgo', { count: Math.abs(daysLeft!) })
                  : expiringSoon
                    ? m('documents.expiresIn', { count: daysLeft! })
                    : m('documents.validUntilDate', { date: f.date(validUntil) })
                : t.documents.perpetual}
            </Mono>
            <Button size="sm" className="mt-1 self-start" onClick={open} disabled={opening}>
              {t.documents.view}
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">{t.documents.subtitle}</p>
        )}

        <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="kind" value={kind} />

          <Field label={t.documents.file}>
            {(p) => (
              <input
                {...p}
                type="file"
                name="file"
                required
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="w-full text-[13px] text-ink-muted file:mr-3 file:cursor-pointer file:rounded-control file:border file:border-line file:bg-raised file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-ink"
              />
            )}
          </Field>

          <Field
            label={t.documents.validUntil}
            required={kind === 'INSURANCE'}
            hint={kind === 'CARRIER_LICENSE' ? t.documents.perpetual : undefined}
          >
            {(p) => (
              <Input
                {...p}
                type="date"
                name="valid_until"
                required={kind === 'INSURANCE'}
                defaultValue={document?.valid_until ?? ''}
              />
            )}
          </Field>

          {state.error && (
            <p role="alert" className="text-[13px] text-danger">
              {state.error}
            </p>
          )}

          <Button type="submit" variant="primary" size="sm" disabled={pending} className="self-start">
            {pending ? t.documents.uploading : document ? t.documents.replace : t.documents.upload}
          </Button>

          {document && <p className="text-xs text-ink-dim">{t.documents.replacedNotice}</p>}
        </form>
      </CardBody>
    </Card>
  );
}
