'use client';

import { useEffect, useRef, useState } from 'react';
import type { TripPhoto } from '@/lib/driverApp/photos';
import { useI18n } from '@/lib/i18n/provider';
import { useOutbox } from '../../OutboxProvider';
import { PhotoCapture, useQueuedPhotos } from './PhotoCapture';

/**
 * Подтверждение передачи: подпись на экране и снимок накладной.
 *
 * На погрузке расписывается тот, кто отдаёт единицу или груз, на
 * выгрузке — тот, кто принимает: так у рейса есть подтверждение обоих
 * концов. Снимок накладной ложится видом CMR, и перевозчик закрывает рейс
 * без повторной загрузки скана.
 */
export function Confirmation({
  orderId,
  stopId,
  photos,
  pickup,
}: {
  orderId: string;
  stopId: string;
  photos: TripPhoto[];
  /** Погрузка: подписывает сдающий, а не получатель. */
  pickup: boolean;
}) {
  const { t } = useI18n();
  const here = photos.filter((p) => p.stopId === stopId);
  const queued = useQueuedPhotos(stopId);
  const queuedSignature = queued.filter((q) => q.subject === 'SIGNATURE').at(-1);
  const serverSignature = here.filter((p) => p.subject === 'SIGNATURE').at(-1);
  const signature = queuedSignature
    ? { signerName: queuedSignature.signerName, queued: true }
    : serverSignature
      ? { signerName: serverSignature.signerName, queued: false }
      : null;
  const cmrQueued = queued.some((q) => q.cmr);
  const cmr = cmrQueued || here.some((p) => p.kind === 'CMR');

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[16px] font-semibold">
        {pickup ? t.driverApp.confirmationPickup : t.driverApp.confirmation}
      </h3>

      {signature ? (
        <p className="rounded-card bg-ok/10 px-3 py-2 text-[15px] font-semibold text-ok">
          ✓ {t.driverApp.signed}
          {signature.signerName ? ` · ${signature.signerName}` : ''}
          {signature.queued ? ` · ${t.driverApp.queuedBadge}` : ''}
        </p>
      ) : (
        <SignaturePad orderId={orderId} stopId={stopId} pickup={pickup} />
      )}

      <div className="rounded-card border border-line bg-surface p-3">
        <span className="text-[16px] font-semibold">
          {cmr ? `✓ ${t.driverApp.cmrDone}` : t.driverApp.scanCmr}
          {cmrQueued ? ` · ${t.driverApp.queuedBadge}` : ''}
        </span>
        <PhotoCapture
          className="mt-2"
          target={{ orderId, stopId, subject: 'DOCUMENT', cmr: true }}
          label={t.driverApp.scanCmr}
          done={cmr}
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
function SignaturePad({
  orderId,
  stopId,
  pickup,
}: {
  orderId: string;
  stopId: string;
  pickup: boolean;
}) {
  const { t } = useI18n();
  const { enqueue } = useOutbox();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

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

  async function save() {
    setBusy(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.current!.toBlob(resolve, 'image/png'));
      if (!blob) return;
      await enqueue(
        'UPLOAD',
        { order_id: orderId, stop_id: stopId, subject: 'SIGNATURE', signer_name: name },
        blob,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3">
      <span className="text-[15px] text-ink-muted">
        {pickup ? t.driverApp.signHerePickup : t.driverApp.signHere}
      </span>
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
        placeholder={pickup ? t.driverApp.signerNamePickup : t.driverApp.signerName}
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
          disabled={!dirty || name.trim().length < 2 || busy}
          className="h-12 flex-[2] rounded-control bg-ink text-[15px] font-semibold text-surface disabled:opacity-50"
        >
          {busy ? t.driverApp.uploading : t.driverApp.saveSignature}
        </button>
      </div>
    </div>
  );
}
