'use client';

import { useActionState, useState } from 'react';
import { Badge, Button, Select } from '@/components/ui';
import { tripProgress, type TripStop } from '@/lib/orders/progress';
import { closeOrderAction, uploadTripDocumentAction, type TripState } from '@/lib/orders/trip';
import { DocumentList } from '@/components/domain/TripDocuments';
import { useI18n } from '@/lib/i18n/provider';
import type { TripDocument, TripDocumentKind } from '@/types/db';

const initial: TripState = { error: null };

const KINDS: TripDocumentKind[] = ['CMR', 'LOADING_PHOTO', 'UNLOADING_PHOTO', 'DAMAGE_PHOTO'];

/**
 * Закрытие рейса с документами (ТЗ §9).
 *
 * Появляется, когда пройдены все точки: до этого закрывать нечего, а
 * кнопка, которая всегда на экране и всегда отказывает, приучает её не
 * замечать.
 *
 * CMR обязателен, и об этом сказано до нажатия, а не после отказа:
 * накладная — основание, по которому оператор платит перевозчику и
 * выставляет счёт заказчику.
 */
export function ClosingPanel({
  orderId,
  stops,
  documents,
  closed,
}: {
  orderId: string;
  stops: TripStop[];
  documents: TripDocument[];
  closed: boolean;
}) {
  const { t, locale } = useI18n();
  const [upload, uploadAction, uploading] = useActionState(uploadTripDocumentAction, initial);
  const [close, closeAction, closingNow] = useActionState(closeOrderAction, initial);
  const [kind, setKind] = useState<TripDocumentKind>('CMR');

  const progress = tripProgress(stops);
  const hasCmr = documents.some((d) => d.kind === 'CMR');

  /* Пока не пройдены все точки, закрывать нечего. */
  if (!closed && !progress.finished) return null;

  return (
    <div className="mt-4 rounded-control border border-line bg-sunken p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="label-micro">{closed ? t.trip.documents : t.trip.closing}</p>
        {closed && <Badge tone="ok">{t.trip.closed}</Badge>}
      </div>

      {!closed && <p className="mb-3 text-xs text-ink-faint">{t.trip.closingHint}</p>}

      <DocumentList documents={documents} />

      {!closed && (
        <>
          <form action={uploadAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="order_id" value={orderId} />

            <Select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as TripDocumentKind)}
              aria-label={t.trip.documents}
              className="w-auto"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.tripDocument[k]}
                </option>
              ))}
            </Select>

            <input
              type="file"
              name="file"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="text-xs text-ink-muted file:mr-2 file:rounded-control file:border file:border-line file:bg-raised file:px-2.5 file:py-1 file:text-xs file:text-ink"
            />

            <Button type="submit" size="sm" disabled={uploading}>
              {uploading ? t.trip.uploading : t.trip.addFile}
            </Button>
          </form>

          {upload.error && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {upload.error}
            </p>
          )}

          <form action={closeAction} className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="order_id" value={orderId} />

            <Button type="submit" variant="primary" size="sm" disabled={!hasCmr || closingNow}>
              {closingNow ? t.trip.closing_ : t.trip.close}
            </Button>

            {!hasCmr && <span className="text-xs text-warn">{t.trip.cmrRequired}</span>}
          </form>

          {close.error && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {close.error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
