'use client';

import { useActionState, useTransition } from 'react';
import { Badge, Button, Card, CardBody, Field, FileDrop, Input } from '@/components/ui';
import type { StatusTone } from '@/components/ui/tone';
import { documentUrlAction } from '@/lib/fleet/actions';
import type { ReviewStatus } from '@/lib/forwarders/policy';
import { useI18n } from '@/lib/i18n/provider';
import { uploadShipperDocumentAction, type ShipperDocUploadState } from '@/lib/shipper-docs/actions';
import { SHIPPER_DOC_KINDS, docNameFor, needsIssuedOn, type ShipperDocKind } from '@/lib/shipper-docs/model';
import type { CompanyDocument } from '@/types/db';

const reviewTone: Record<ReviewStatus, StatusTone> = { PENDING: 'warn', APPROVED: 'ok', REJECTED: 'danger' };
const day = (d: string) => `${d}T12:00:00Z`;

/**
 * Документы заказчика (6.11.2026): выписка из реестра, налоговые справки,
 * право подписи. Всё по желанию; проверяет оператор, перевозчик видит
 * только отметку и даты. Подсказка — официальное название документа в
 * стране компании.
 */
export function ShipperDocumentsPanel({
  country,
  documents,
}: {
  country: string | null;
  /** Последние загруженные документы этих видов (любой статус), новые первыми. */
  documents: CompanyDocument[];
}) {
  const { t } = useI18n();
  const sd = t.shipperDocs;

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{sd.title}</h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-muted">{sd.intro}</p>
        </div>
        {SHIPPER_DOC_KINDS.map((kind) => (
          <KindBlock
            key={kind}
            kind={kind}
            country={country}
            document={documents.find((d) => d.kind === kind) ?? null}
          />
        ))}
      </CardBody>
    </Card>
  );
}

const idle: ShipperDocUploadState = { error: null, done: 0 };

function KindBlock({
  kind,
  country,
  document,
}: {
  kind: ShipperDocKind;
  country: string | null;
  document: CompanyDocument | null;
}) {
  const { t, locale } = useI18n();
  const sd = t.shipperDocs;
  const fw = t.forwarder;
  const [state, action, pending] = useActionState(uploadShipperDocumentAction, idle);
  const example = docNameFor(country, kind);
  const issuedRequired = needsIssuedOn(kind);

  return (
    <section className="flex flex-col gap-2.5 border-t border-line pt-4">
      <div>
        <h3 className="text-[14px] font-semibold">
          {t.documents[kind]} <span className="font-normal text-ink-dim">· {sd.optional}</span>
        </h3>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-muted">{sd[`hint${kind}`]}</p>
        {example && (
          <p className="mt-1 text-[13px] text-ink-muted">{sd.countryExample.replace('{name}', example)}</p>
        )}
        {kind === 'SIGNATORY_AUTHORITY' && (
          <p className="mt-1.5 max-w-xl text-[13px] font-semibold leading-relaxed text-warn">{sd.signatoryWarning}</p>
        )}
      </div>

      {document ? <DocumentLine document={document} /> : <p className="text-[13px] text-ink-dim">{fw.notSent}</p>}

      {/* Новая версия; прежняя отметка действует, пока новая на проверке. */}
      <form key={state.done} action={action} className="flex flex-col gap-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="kind" value={kind} />
        <FileDrop
          name="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          maxBytes={10 * 1024 * 1024}
          required
          choose={t.documents.chooseFile}
          drop={t.documents.dropFile}
          tooLarge={t.documents.tooLarge}
          wrongType={t.documents.wrongType}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={sd.issuedOn} required={issuedRequired}>
            {(p) => <Input {...p} type="date" name="issued_on" required={issuedRequired} />}
          </Field>
          <Field label={sd.validUntil} hint={sd.validUntilHint}>
            {(p) => <Input {...p} type="date" name="valid_until" />}
          </Field>
        </div>
        {state.error && (
          <p role="alert" className="text-[13px] text-danger">
            {state.error}
          </p>
        )}
        {state.done > 0 && !state.error && <p className="text-[13px] text-ok">{fw.sent}</p>}
        <Button type="submit" variant="primary" size="sm" disabled={pending} className="self-start">
          {pending ? fw.sending : fw.send}
        </Button>
      </form>
    </section>
  );
}

function DocumentLine({ document }: { document: CompanyDocument }) {
  const { t, f } = useI18n();
  const sd = t.shipperDocs;
  const fw = t.forwarder;
  const [opening, startOpening] = useTransition();
  const review = (document.review_status ?? 'PENDING') as ReviewStatus;
  const dates = [
    document.issued_on ? sd.issuedShort.replace('{date}', f.date(day(document.issued_on))) : null,
    document.valid_until ? sd.untilShort.replace('{date}', f.date(day(document.valid_until))) : null,
  ].filter(Boolean);

  function open() {
    startOpening(async () => {
      const url = await documentUrlAction(document.storage_path);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-control border border-line px-3 py-2.5 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={reviewTone[review]}>{fw[`status${review}`]}</Badge>
        <span className="break-all text-ink-muted">{document.file_name}</span>
      </div>
      {dates.length > 0 && <p className="text-xs text-ink-dim">{dates.join(' · ')}</p>}
      {review === 'REJECTED' && document.review_note && (
        <p className="text-danger">{fw.rejectedReason.replace('{note}', document.review_note)}</p>
      )}
      <Button size="sm" onClick={open} disabled={opening} className="self-start">
        {t.documents.view}
      </Button>
    </div>
  );
}
