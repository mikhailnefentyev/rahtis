'use client';

import { useTransition } from 'react';
import { Badge, Button, Mono } from '@/components/ui';
import { claimFileUrlAction } from '@/lib/claims/actions';
import { useI18n } from '@/lib/i18n/provider';
import { tripDocumentUrlAction } from '@/lib/orders/trip';
import type { ClaimDetail } from '@/types/db';

type Doc = ClaimDetail['documents'][number];

/**
 * Доказательства из рейса: «до» и «после».
 *
 * Фото берутся из рейса, а не из claim, — claim_detail читает их в
 * момент открытия. Поэтому снимок, который приложение водителя пришлёт
 * после подачи, окажется здесь сам, и место под него видно заранее:
 * пустая колонка честнее, чем отсутствующая.
 *
 * Снимки с точки, к которой привязан claim, помечены: в споре о вмятине
 * на выгрузке смотрят прежде всего на выгрузку.
 */
export function ClaimEvidence({
  documents,
  stopId,
}: {
  documents: ClaimDetail['documents'];
  stopId: string | null;
}) {
  const { t } = useI18n();

  const photos = documents.filter((d) => d.kind !== 'CMR');
  const before = photos.filter((d) => d.phase === 'PICKUP');
  const after = photos.filter((d) => d.phase === 'DELIVERY');
  const other = documents.filter((d) => d.kind === 'CMR' || d.phase == null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-ink-dim">{t.claims.evidenceHint}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Column title={t.claims.before} docs={before} stopId={stopId} />
        <Column title={t.claims.after} docs={after} stopId={stopId} />
      </div>

      {other.length > 0 && <Column title={t.claims.otherDocuments} docs={other} stopId={stopId} />}
    </div>
  );
}

function Column({ title, docs, stopId }: { title: string; docs: Doc[]; stopId: string | null }) {
  const { t, f } = useI18n();
  const [pending, start] = useTransition();

  function open(path: string) {
    start(async () => {
      const url = await tripDocumentUrlAction(path);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <div className="rounded-control border border-line bg-sunken p-3">
      <p className="label-micro mb-2">{title}</p>

      {docs.length === 0 ? (
        <p className="text-xs text-ink-dim">{t.claims.noPhotos}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {docs.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="min-w-0 text-ink-muted">
                <span className="font-semibold text-ink">{t.tripDocument[doc.kind]}</span>
                {doc.source === 'DRIVER_APP' && (
                  <Badge tone="info" className="ml-1.5">
                    {t.claims.fromApp}
                  </Badge>
                )}
                {stopId && doc.stop_id === stopId && (
                  <Badge tone="warn" className="ml-1.5">
                    {t.claims.atClaimStop}
                  </Badge>
                )}
                {' · '}
                <Mono className="text-ink-faint">
                  {f.dateTime(doc.captured_at ?? doc.created_at)}
                </Mono>
              </span>
              <Button size="sm" onClick={() => open(doc.storage_path)} disabled={pending}>
                {t.documents.view}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Вложения самого claim — из своего бакета, своей ссылкой. */
export function ClaimAttachments({ attachments }: { attachments: ClaimDetail['attachments'] }) {
  const { t, f } = useI18n();
  const [pending, start] = useTransition();

  if (attachments.length === 0) return <p className="text-xs text-ink-dim">—</p>;

  function open(path: string) {
    start(async () => {
      const url = await claimFileUrlAction(path);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {attachments.map((file) => (
        <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="min-w-0 text-ink-muted">
            <span className="font-semibold text-ink">{t.claims.author[file.author_role]}</span>
            {' · '}
            <span className="truncate">{file.file_name}</span>
            {' · '}
            <Mono className="text-ink-faint">{f.dateTime(file.created_at)}</Mono>
          </span>
          <Button size="sm" onClick={() => open(file.storage_path)} disabled={pending}>
            {t.documents.view}
          </Button>
        </li>
      ))}
    </ul>
  );
}
