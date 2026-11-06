'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui';
import { documentUrlAction } from '@/lib/fleet/actions';

/** Открыть файл документа короткой подписанной ссылкой (как в AdminDocument). */
export function OpenDocumentButton({ storagePath, label }: { storagePath: string; label: string }) {
  const [opening, startOpening] = useTransition();
  return (
    <Button
      size="sm"
      disabled={opening}
      className="self-start"
      onClick={() =>
        startOpening(async () => {
          const url = await documentUrlAction(storagePath);
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
        })
      }
    >
      {label}
    </Button>
  );
}
