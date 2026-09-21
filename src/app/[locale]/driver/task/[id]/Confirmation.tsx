'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { uploadPhotoAction } from '@/lib/driverApp/actions';
import type { TripPhoto } from '@/lib/driverApp/photos';
import { useI18n } from '@/lib/i18n/provider';
import { PhotoCapture } from './PhotoCapture';

/**
 * Подтверждение сдачи: подпись получателя на экране или снимок
 * подписанной накладной — что удобнее на месте. Снимок накладной ложится
 * видом CMR, и перевозчик закрывает рейс без повторной загрузки скана.
 */
export function Confirmation({
  orderId,
  stopId,
  photos,
}: {
  orderId: string;
  stopId: string;
  photos: TripPhoto[];
}) {
  const { t } = useI18n();
  const here = photos.filter((p) => p.stopId === stopId);
  const signature = here.filter((p) => p.subject === 'SIGNATURE').at(-1);
  const cmr = here.filter((p) => p.kind === 'CMR').at(-1);

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[16px] font-semibold">{t.driverApp.confirmation}</h3>

      {signature ? (
        <p className="rounded-card bg-ok/10 px-3 py-2 text-[15px] font-semibold text-ok">
          ✓ {t.driverApp.signed}
          {signature.signerName ? ` · ${signature.signerName}` : ''}
        </p>
      ) : (
        <SignaturePad orderId={orderId} stopId={stopId} />
      )}

      <div className="rounded-card border border-line bg-surface p-3">
        <span className="text-[16px] font-semibold">
          {cmr ? `✓ ${t.driverApp.cmrDone}` : t.driverApp.scanCmr}
        </span>
        <PhotoCapture
          className="mt-2"
          target={{ orderId, stopId, subject: 'DOCUMENT', cmr: true }}
          label={t.driverApp.scanCmr}
          done={Boolean(cmr)}
        />
      </div>
    </section>
  );
}

/**
 * Подпись пальцем на экране. Рисуется в canvas с учётом плотности экрана,
 * уходит PNG вместе с именем подписавшего — подпись без имени в споре
 * ничего не доказывает.
 */
function SignaturePad({ orderId, stopId }: { orderId: string; stopId: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    el.width = el.clientWidth * ratio;
    el.height = el.clientHeight * ratio;
    const ctx = el.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0c1626';
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  function clear() {
    const el = canvas.current!;
    el.getContext('2d')!.clearRect(0, 0, el.width, el.height);
    setDirty(false);
  }

  function save() {
    start(async () => {
      setError(null);
      const blob = await new Promise<Blob | null>((resolve) => canvas.current!.toBlob(resolve, 'image/png'));
      if (!blob) return;

      const form = new FormData();
      form.set('locale', locale);
      form.set('file', new File([blob], 'signature.png', { type: 'image/png' }));
      form.set('order_id', orderId);
      form.set('stop_id', stopId);
      form.set('subject', 'SIGNATURE');
      form.set('signer_name', name);
      form.set('external_id', crypto.randomUUID());
      form.set('captured_at', new Date().toISOString());

      const result = await uploadPhotoAction(form);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3">
      <span className="text-[15px] text-ink-muted">{t.driverApp.signHere}</span>
      <canvas
        ref={canvas}
        className="h-40 w-full touch-none rounded-control border border-dashed border-line-strong bg-sunken"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const { x, y } = point(e);
          const ctx = e.currentTarget.getContext('2d')!;
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const { x, y } = point(e);
          const ctx = e.currentTarget.getContext('2d')!;
          ctx.lineTo(x, y);
          ctx.stroke();
          setDirty(true);
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.driverApp.signerName}
        maxLength={120}
        className="h-12 rounded-control border border-line bg-sunken px-3 text-[16px]"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clear}
          className="h-12 flex-1 rounded-control border border-line text-[15px] font-semibold"
        >
          {t.driverApp.clear}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || name.trim().length < 2 || pending}
          className="h-12 flex-[2] rounded-control bg-ink text-[15px] font-semibold text-surface disabled:opacity-50"
        >
          {pending ? t.driverApp.uploading : t.driverApp.saveSignature}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
