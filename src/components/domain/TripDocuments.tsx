'use client';

import { useTransition } from 'react';
import { Button, Mono } from '@/components/ui';
import { tripDocumentUrlAction } from '@/lib/orders/trip';
import { useI18n } from '@/lib/i18n/provider';
import type { TripDocument } from '@/types/db';

/**
 * Список документов со ссылками.
 *
 * Ссылка выписывается по нажатию и живёт пять минут: подписанный URL в
 * разметке страницы утёк бы вместе с ней — в историю браузера, в
 * пересланный скриншот, в кэш.
 */
export function DocumentList({ documents }: { documents: TripDocument[] }) {
  const { t, f } = useI18n();
  const [pending, start] = useTransition();

  /*
   * Что на снимке: сторона осмотра, подпись с именем подписавшего. Вид
   * документа (фото погрузки, повреждения, CMR) остаётся первым словом.
   */
  const label = (doc: TripDocument) => {
    if (doc.subject === 'SIGNATURE') {
      return doc.signer_name ? `${t.trip.signature} · ${doc.signer_name}` : t.trip.signature;
    }
    const angle = doc.angle as keyof typeof t.driverApp.angle | null;
    return angle ? `${t.tripDocument[doc.kind]} · ${t.driverApp.angle[angle]}` : t.tripDocument[doc.kind];
  };

  if (documents.length === 0) {
    return <p className="text-xs text-ink-dim">{t.trip.noDocuments}</p>;
  }

  function open(path: string) {
    start(async () => {
      const url = await tripDocumentUrlAction(path);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {documents.map((doc) => (
        <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="min-w-0 text-ink-muted">
            <span className="font-semibold text-ink">{label(doc)}</span>
            {' · '}
            {/*
              * У снимка из приложения имя файла — служебный идентификатор,
              * и человеку оно ничего не говорит. Вместо него — откуда снимок.
              */}
            {doc.source === 'DRIVER_APP' ? (
              <span>{t.trip.fromApp}</span>
            ) : (
              <span className="truncate">{doc.file_name}</span>
            )}
            {' · '}
            <Mono className="text-ink-faint">{f.dateTime(doc.captured_at ?? doc.created_at)}</Mono>
          </span>

          <Button size="sm" onClick={() => open(doc.storage_path)} disabled={pending}>
            {t.documents.view}
          </Button>
        </li>
      ))}
    </ul>
  );
}
