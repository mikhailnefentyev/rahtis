'use client';

import { useActionState, useEffect, useState } from 'react';
import { Badge, Button, Card, CardBody, Field, Input, Select } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { deleteMaintenanceDocumentAction, uploadMaintenanceDocumentAction, type MaintenanceFormState } from '@/lib/maintenance/actions';
import { DOCUMENT_KINDS, type DocumentKind } from '@/lib/maintenance/documents';

const initial: MaintenanceFormState = { error: null, done: false };

export const FILE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
export const FILE_INPUT_CLASS =
  'text-xs text-ink-muted file:mr-2 file:rounded-control file:border file:border-line file:bg-raised file:px-2.5 file:py-1 file:text-xs file:text-ink';

/** Документ для показа: без пути в хранилище — он клиенту не нужен. */
export type DocumentView = {
  id: string;
  kind: string;
  title: string | null;
  file_name: string;
  mime_type: string;
  created_at: string;
  url: string | null;
  /** Подпись строки книжки, к которой приложен: «12.10.2026 · Korjaus». */
  record: string | null;
};

/**
 * Архив документов машины или прицепа: счета, протоколы katsastus,
 * свидетельства тахографа, регистрационная справка, фото. Файл
 * открывается по ссылке на час (закрытое хранилище).
 */
export function DocumentsSection({
  asset,
  documents,
  records,
}: {
  asset: { id: string; type: 'VEHICLE' | 'TRAILER' };
  documents: DocumentView[];
  records: { id: string; label: string }[];
}) {
  const { t, f, locale } = useI18n();
  const s = t.maintenance.docs;
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-faint">{s.title}</h2>
        <Button size="sm" variant={open ? 'primary' : 'default'} onClick={() => setOpen(!open)}>
          {s.add}
        </Button>
      </div>

      {open && (
        <Card className="mb-3">
          <CardBody>
            <UploadForm asset={asset} records={records} onClose={() => setOpen(false)} />
          </CardBody>
        </Card>
      )}

      {documents.length === 0 ? (
        !open && <p className="text-[13px] text-ink-muted">{s.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{s.kinds[doc.kind as DocumentKind] ?? doc.kind}</Badge>
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate text-[13px] font-semibold text-accent hover:underline">
                      {doc.title ?? doc.file_name}
                    </a>
                  ) : (
                    <span className="truncate text-[13px] font-semibold">{doc.title ?? doc.file_name}</span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {[doc.title ? doc.file_name : null, f.date(doc.created_at), doc.record ? `${s.attachedTo}: ${doc.record}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <form action={deleteMaintenanceDocumentAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={doc.id} />
                <Button type="submit" size="sm" variant="ghost">
                  {s.delete}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UploadForm({
  asset,
  records,
  onClose,
}: {
  asset: { id: string; type: 'VEHICLE' | 'TRAILER' };
  records: { id: string; label: string }[];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const s = t.maintenance.docs;
  const [state, action, pending] = useActionState(uploadMaintenanceDocumentAction, initial);
  useEffect(() => {
    if (state.done) onClose();
  }, [state, onClose]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name={asset.type === 'TRAILER' ? 'trailer_id' : 'vehicle_id'} value={asset.id} />
      <h3 className="text-[13px] font-semibold">{s.add}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={s.kind} required>
          {(p) => (
            <Select {...p} name="kind" defaultValue="RECEIPT">
              {DOCUMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {s.kinds[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={s.name}>{(p) => <Input {...p} name="title" maxLength={80} placeholder={s.namePlaceholder} />}</Field>
        {records.length > 0 && (
          <Field label={s.record}>
            {(p) => (
              <Select {...p} name="record_id" defaultValue="">
                <option value="">{s.recordNone}</option>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>
      <Field label={s.file} required hint={s.fileHint}>
        {(p) => <input {...p} type="file" name="file" required accept={FILE_ACCEPT} className={FILE_INPUT_CLASS} />}
      </Field>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? s.uploading : s.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t.maintenance.form.cancel}
        </Button>
      </div>
    </form>
  );
}
