'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { uploadPhotoAction } from '@/lib/driverApp/actions';
import { compressPhoto } from '@/lib/driverApp/photo';
import { useI18n } from '@/lib/i18n/provider';
import { askPosition } from '@/lib/orders/position';

export type PhotoTarget = {
  orderId: string;
  stopId: string;
  subject: 'TRAILER' | 'CARGO' | 'SEAL' | 'DOCUMENT' | 'OTHER';
  angle?: 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT';
  cmr?: boolean;
};

/**
 * Кнопка «Ota kuva»: камера телефона → сжатие → отправка.
 *
 * Время съёмки — момент выбора кадра, а не приёма сервером: в споре
 * важно, когда снято. Место — одна быстрая попытка; нет — снимок уходит
 * без него.
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
  const { t, locale } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    const capturedAt = new Date().toISOString();

    start(async () => {
      setError(null);
      const [blob, position] = await Promise.all([compressPhoto(file), askPosition(3000)]);

      const form = new FormData();
      form.set('locale', locale);
      form.set('file', new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' }));
      form.set('order_id', target.orderId);
      form.set('stop_id', target.stopId);
      form.set('subject', target.subject);
      if (target.angle) form.set('angle', target.angle);
      if (target.cmr) form.set('cmr', '1');
      if (damage) form.set('damage', '1');
      form.set('external_id', crypto.randomUUID());
      form.set('captured_at', capturedAt);
      if (position) {
        form.set('lat', String(position.lat));
        form.set('lon', String(position.lon));
      }

      const result = await uploadPhotoAction(form);
      if (result.error) setError(result.error);
      else router.refresh();
    });

    if (input.current) input.current.value = '';
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
        disabled={pending}
        onClick={() => input.current?.click()}
        className={cn(
          'h-12 w-full rounded-control px-4 text-[15px] font-semibold disabled:opacity-60',
          done ? 'border border-line bg-surface text-ink' : 'bg-ink text-surface',
        )}
      >
        {pending ? t.driverApp.uploading : done ? t.driverApp.retake : `📷 ${label}`}
      </button>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
