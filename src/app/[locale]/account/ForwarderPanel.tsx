'use client';

import { useActionState, useTransition } from 'react';
import { Badge, Button, Card, CardBody, Field, FileDrop, Input, Mono, Select } from '@/components/ui';
import type { StatusTone } from '@/components/ui/tone';
import { documentUrlAction } from '@/lib/fleet/actions';
import {
  setShipperRoleAction,
  uploadForwarderDocumentAction,
  type ForwarderUploadState,
  type ShipperRoleState,
} from '@/lib/forwarders/actions';
import { FORWARDER_TERMS, type ForwarderStatus, type ReviewStatus } from '@/lib/forwarders/policy';
import { useI18n } from '@/lib/i18n/provider';
import { CURRENCIES } from '@/lib/money/currency';
import type { CompanyDocument, ShipperRole } from '@/types/db';

const reviewTone: Record<ReviewStatus, StatusTone> = { PENDING: 'warn', APPROVED: 'ok', REJECTED: 'danger' };

/**
 * Экспедитор или грузовладелец, полис экспедитора и польская лицензия.
 *
 * Полис добровольный: с 6.11.2026 это отметка для перевозчика, а не
 * допуск. Здесь — что проверяем, состояние документа и что увидит
 * перевозчик (app.forwarder_policy_until).
 */
export function ForwarderPanel({
  role,
  canEditRole,
  status,
  insurance,
  license,
}: {
  role: ShipperRole;
  canEditRole: boolean;
  status: ForwarderStatus | null;
  /** Последние загруженные документы (любой статус). */
  insurance: CompanyDocument | null;
  license: CompanyDocument | null;
}) {
  const forwarder = role === 'FORWARDER';
  return (
    <>
      <RoleCard role={role} canEdit={canEditRole} />
      {forwarder && (
        <InsuranceCard status={status} document={insurance} />
      )}
      {forwarder && status?.needs_license && <LicenseCard document={license} ok={status.license_ok} />}
    </>
  );
}

const roleIdle: ShipperRoleState = { error: null, saved: false };

function RoleCard({ role, canEdit }: { role: ShipperRole; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const fw = t.forwarder;
  const [state, action, pending] = useActionState(setShipperRoleAction, roleIdle);

  return (
    <Card>
      <CardBody>
        <h2 className="text-[15px] font-semibold tracking-tight">{fw.roleTitle}</h2>
        <p className="mt-1 mb-4 max-w-xl text-[13px] leading-relaxed text-ink-muted">{fw.roleHint}</p>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          {(['FORWARDER', 'CARGO_OWNER'] as const).map((value) => (
            <label key={value} className="flex cursor-pointer items-start gap-2 text-[13px]">
              <input
                type="radio"
                name="shipper_role"
                value={value}
                defaultChecked={role === value}
                disabled={!canEdit || pending}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                <span className="font-semibold">{fw[value]}</span>
                <span className="block text-xs text-ink-muted">
                  {value === 'FORWARDER' ? fw.forwarderHint : fw.cargoOwnerHint}
                </span>
              </span>
            </label>
          ))}
          {canEdit ? (
            <Button type="submit" variant="primary" size="sm" disabled={pending} className="self-start">
              {fw.roleSave}
            </Button>
          ) : (
            <p className="text-xs text-ink-dim">{fw.roleOwnerOnly}</p>
          )}
          {state.error && <p className="text-[13px] text-danger">{state.error}</p>}
          {state.saved && !pending && <p className="text-[13px] text-ok">{fw.roleSaved}</p>}
        </form>
      </CardBody>
    </Card>
  );
}

/** Что видит перевозчик одной строкой: полис проверен до … или не подтверждён. */
function DirectLine({ status }: { status: ForwarderStatus | null }) {
  const { t, f } = useI18n();
  const fw = t.forwarder;
  if (!status) return null;

  if (status.policy_until) {
    return <p className="text-[13px] text-ok">{fw.directOpen.replace('{date}', f.date(`${status.policy_until}T12:00:00Z`))}</p>;
  }
  return <p className="text-[13px] text-ink-muted">{fw.directClosed}</p>;
}

function DocumentSummary({ document }: { document: CompanyDocument }) {
  const { t, f } = useI18n();
  const fw = t.forwarder;
  const [opening, startOpening] = useTransition();
  const review = (document.review_status ?? 'PENDING') as ReviewStatus;

  function open() {
    startOpening(async () => {
      const url = await documentUrlAction(document.storage_path);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  const currency = document.limit_currency ?? 'EUR';
  return (
    <div className="flex flex-col gap-1.5 rounded-control border border-line px-3 py-2.5 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={reviewTone[review]}>{fw[`status${review}`]}</Badge>
        <span className="break-all text-ink-muted">{document.file_name}</span>
      </div>
      {document.insurer && (
        <p className="text-ink-muted">
          {document.insurer} · <Mono>{document.policy_number}</Mono>
        </p>
      )}
      {document.limit_event_cents != null && document.limit_year_cents != null && (
        <p className="text-ink-muted">
          {fw.limitEvent}: <span className="text-ink">{f.money(document.limit_event_cents, currency)}</span> ·{' '}
          {fw.limitYear}: <span className="text-ink">{f.money(document.limit_year_cents, currency)}</span>
        </p>
      )}
      <Mono className="text-xs text-ink-dim">
        {document.valid_until
          ? `${fw.validUntil}: ${f.date(`${document.valid_until}T12:00:00Z`)}`
          : t.documents.perpetual}
      </Mono>
      {review === 'REJECTED' && document.review_note && (
        <p className="text-danger">{fw.rejectedReason.replace('{note}', document.review_note)}</p>
      )}
      <Button size="sm" onClick={open} disabled={opening} className="self-start">
        {t.documents.view}
      </Button>
    </div>
  );
}

const uploadIdle: ForwarderUploadState = { error: null, done: 0 };

function InsuranceCard({ status, document }: { status: ForwarderStatus | null; document: CompanyDocument | null }) {
  const { t, locale } = useI18n();
  const fw = t.forwarder;
  const [state, action, pending] = useActionState(uploadForwarderDocumentAction, uploadIdle);

  return (
    <Card stripe={status?.policy_until ? 'ok' : 'warn'}>
      <CardBody className="flex flex-col gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{fw.insuranceTitle}</h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-muted">{fw.insuranceIntro}</p>
        </div>

        <DirectLine status={status} />

        <div>
          <p className="label-micro mb-1">{fw.requirements}</p>
          <ul className="list-disc space-y-0.5 pl-5 text-[13px] leading-relaxed text-ink-muted">
            <li>{fw.reqLimits}</li>
            <li>{fw.reqTerritory}</li>
            <li>{fw.reqActivity}</li>
            <li>{fw.reqCmr}</li>
            {status?.needs_license && <li>{fw.reqLicensePl}</li>}
          </ul>
        </div>

        {document ? <DocumentSummary document={document} /> : <p className="text-[13px] text-ink-muted">{fw.notSent}</p>}

        {/* Новый документ — новой версией; одобренный прежде действует, пока новый на проверке. */}
        <form key={state.done} action={action} className="flex flex-col gap-3 border-t border-line pt-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="kind" value="FORWARDER_INSURANCE" />

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
            <Field label={fw.insurer} required>
              {(p) => <Input {...p} name="insurer" required maxLength={200} />}
            </Field>
            <Field label={fw.policyNumber} required>
              {(p) => <Input {...p} name="policy_number" required maxLength={100} />}
            </Field>
            <Field label={fw.limitEvent} required>
              {(p) => <Input {...p} name="limit_event" inputMode="decimal" required placeholder="250 000" />}
            </Field>
            <Field label={fw.limitYear} required>
              {(p) => <Input {...p} name="limit_year" inputMode="decimal" required placeholder="500 000" />}
            </Field>
            <Field label={fw.currency}>
              {(p) => (
                <Select {...p} name="limit_currency" defaultValue="EUR">
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={fw.validUntil} required>
              {(p) => <Input {...p} type="date" name="valid_until" required />}
            </Field>
            <Field label={fw.territory}>
              {(p) => <Input {...p} name="territory" maxLength={300} placeholder={fw.territoryPlaceholder} />}
            </Field>
            <Field label={fw.terms}>
              {(p) => (
                <Select {...p} name="terms" defaultValue="">
                  <option value="">—</option>
                  {FORWARDER_TERMS.map((v) => (
                    <option key={v} value={v}>
                      {fw[`terms${v}`]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" name="cmr_covered" value="1" className="mt-0.5 size-4 accent-[var(--color-accent)]" />
            <span>{fw.cmrCovered}</span>
          </label>

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
      </CardBody>
    </Card>
  );
}

function LicenseCard({ document, ok }: { document: CompanyDocument | null; ok: boolean }) {
  const { t, locale } = useI18n();
  const fw = t.forwarder;
  const [state, action, pending] = useActionState(uploadForwarderDocumentAction, uploadIdle);

  return (
    <Card stripe={ok ? 'ok' : 'warn'}>
      <CardBody className="flex flex-col gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{fw.licenseTitle}</h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-muted">{fw.licenseIntro}</p>
        </div>

        {document ? <DocumentSummary document={document} /> : <p className="text-[13px] text-ink-muted">{fw.notSent}</p>}

        <form key={state.done} action={action} className="flex flex-col gap-3 border-t border-line pt-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="kind" value="FORWARDER_LICENSE" />
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
          <Field label={fw.validUntil} hint={fw.licenseValidHint}>
            {(p) => <Input {...p} type="date" name="valid_until" />}
          </Field>
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
      </CardBody>
    </Card>
  );
}
