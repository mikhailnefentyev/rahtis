'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { compressPhoto } from '@/lib/driverApp/photo';
import { useI18n } from '@/lib/i18n/provider';
import { askPosition } from '@/lib/orders/position';
import { useOutbox } from '../../OutboxProvider';

export type PhotoTarget = {
  orderId: string;
  stopId: string;
  subject: 'TRAILER' | 'CARGO' | 'SEAL' | 'DOCUMENT' | 'OTHER';
  angle?: 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT';
  cmr?: boolean;
};

export type QueuedPhoto = {
  subject: string;
  angle: string | null;
  cmr: boolean;
  damage: boolean;
  signerName: string | null;
  url: string | null;
};

/**
 * Снимки точки, которые ещё в очереди телефона, — с миниатюрой из самого
 * файла. Без связи водитель видит, что сторона снята, и не переснимает её.
 */
export function useQueuedPhotos(stopId: string): QueuedPhoto[] {
  const { pending } = useOutbox();
  const events = useMemo(
    () => pending.filter((e) => e.kind === 'UPLOAD' && e.fields.stop_id === stopId),
    [pending, stopId],
  );

  const urls = useMemo(() => events.map((e) => (e.blob ? URL.createObjectURL(e.blob) : null)), [events]);
  useEffect(() => () => urls.forEach((u) => u && URL.revokeObjectURL(u)), [urls]);

  return events.map((e, i) => ({
    subject: e.fields.subject,
    angle: e.fields.angle ?? null,
    cmr: e.fields.cmr === '1',
    damage: e.fields.damage === '1',
    signerName: e.fields.signer_name ?? null,
    url: urls[i],
  }));
}

/**
 * Кнопка «Ota kuva»: камера телефона → сжатие → очередь.
 *
 * Время съёмки — момент выбора кадра, а не отправки: в споре важно,
 * когда снято. Место — одна быстрая попытка; нет — снимок уходит без
 * него.
 */
export function PhotoCapture({
  target,
  damage = false,
  label,
  done = false,
  className,
}: {
  target: PhotoTarget;
  damage?: boolean;
  label: string;
  done?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const { enqueue } = useOutbox();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const [blob, position] = await Promise.all([compressPhoto(file), askPosition(3000)]);
      const fields: Record<string, string> = {
        order_id: target.orderId,
        stop_id: target.stopId,
        subject: target.subject,
      };
      if (target.angle) fields.angle = target.angle;
      if (target.cmr) fields.cmr = '1';
      if (damage) fields.damage = '1';
      if (position) {
        fields.lat = String(position.lat);
        fields.lon = String(position.lon);
      }
      await enqueue('UPLOAD', fields, blob);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className={className}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className={cn(
          'h-12 w-full rounded-control px-4 text-[15px] font-semibold disabled:opacity-60',
          done ? 'border border-line bg-surface text-ink' : 'bg-ink text-surface',
        )}
      >
        {busy ? t.driverApp.uploading : done ? t.driverApp.retake : `📷 ${label}`}
      </button>
    </div>
  );
}
