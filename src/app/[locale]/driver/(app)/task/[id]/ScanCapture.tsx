'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { buildPdf, detectSheet, loadPhoto, renderPage, type Point, type Quad } from '@/lib/driverApp/scan';
import { useI18n } from '@/lib/i18n/provider';
import { askPosition } from '@/lib/orders/position';
import { useOutbox } from '../../../OutboxProvider';

type Page = { jpeg: Blob; width: number; height: number; url: string };

/* Тело запроса на площадке — до 4,5 МБ; восемь страниц скана в него укладываются с запасом. */
const MAX_PAGES = 8;

/**
 * Скан накладной в PDF: камера → углы листа → страницы → один PDF.
 *
 * Камера открывается системной (input capture): в PWA на iPhone это
 * надёжнее живого видео, и водитель снимает привычной кнопкой. Углы
 * находятся сами; если промахнулись — их двигают пальцем. Страниц может
 * быть несколько: у CMR бывает оборот и приложения.
 *
 * Готовый PDF уходит в ту же очередь, что и снимки, с пометкой CMR:
 * без связи он ждёт на телефоне.
 */
export function ScanCapture({
  orderId,
  stopId,
  done = false,
  className,
}: {
  orderId: string;
  stopId: string;
  done?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const { enqueue } = useOutbox();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [editing, setEditing] = useState<{ photo: HTMLCanvasElement; quad: Quad; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /* Ссылки на превью освобождаются при уходе со страницы; удалённые — сразу при удалении. */
  const urls = useRef<string[]>([]);
  useEffect(() => {
    urls.current = pages.map((p) => p.url);
  }, [pages]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  function shoot() {
    input.current?.click();
  }

  async function onFile(file: File | undefined) {
    if (input.current) input.current.value = '';
    if (!file) return;
    setBusy(true);
    setOpen(true);
    try {
      const photo = await loadPhoto(file);
      const url = photo.toDataURL('image/jpeg', 0.6);
      setEditing({ photo, quad: detectSheet(photo), url });
    } finally {
      setBusy(false);
    }
  }

  async function usePage() {
    if (!editing) return;
    setBusy(true);
    try {
      const page = await renderPage(editing.photo, editing.quad);
      setPages((list) => [...list, { ...page, url: URL.createObjectURL(page.jpeg) }]);
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    pages.forEach((p) => URL.revokeObjectURL(p.url));
    setPages([]);
    setEditing(null);
    setOpen(false);
  }

  async function finish() {
    if (pages.length === 0) return;
    setBusy(true);
    try {
      const [pdf, position] = await Promise.all([buildPdf(pages), askPosition(3000)]);
      const fields: Record<string, string> = { order_id: orderId, stop_id: stopId, subject: 'DOCUMENT', cmr: '1' };
      if (position) {
        fields.lat = String(position.lat);
        fields.lon = String(position.lon);
      }
      await enqueue('UPLOAD', fields, pdf);
      close();
    } finally {
      setBusy(false);
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
        onClick={shoot}
        className={cn(
          'h-12 w-full rounded-control px-4 text-[15px] font-semibold',
          done ? 'border border-line bg-surface text-ink' : 'bg-ink text-surface',
        )}
      >
        <span className="inline-flex items-center justify-center gap-2">
          <ScanIcon />
          {done ? t.driverApp.scanAgain : t.driverApp.scanCmr}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal>
          <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
            <span className="text-[16px] font-semibold">{t.driverApp.scanTitle}</span>
            <button type="button" onClick={close} className="h-11 px-3 text-[15px] text-white/80">
              {t.driverApp.scanCancel}
            </button>
          </div>

          {editing ? (
            <>
              <p className="px-4 pb-2 text-[14px] text-white/70">{t.driverApp.scanAdjust}</p>
              <CornerEditor
                url={editing.url}
                width={editing.photo.width}
                height={editing.photo.height}
                quad={editing.quad}
                onChange={(quad) => setEditing((e) => (e ? { ...e, quad } : e))}
              />
              <div className="flex gap-2 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    shoot();
                  }}
                  className="h-12 flex-1 rounded-control border border-white/30 text-[15px] font-semibold"
                >
                  {t.driverApp.scanRetake}
                </button>
                <button
                  type="button"
                  onClick={usePage}
                  disabled={busy}
                  className="h-12 flex-[2] rounded-control bg-white text-[15px] font-semibold text-black disabled:opacity-60"
                >
                  {busy ? t.driverApp.scanWorking : t.driverApp.scanUse}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4">
                {busy && pages.length === 0 ? (
                  <p className="pt-10 text-center text-[15px] text-white/70">{t.driverApp.scanWorking}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pb-4">
                    {pages.map((p, i) => (
                      <figure key={p.url} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element -- локальный blob-URL */}
                        <img src={p.url} alt="" className="w-full rounded-control bg-white" />
                        <figcaption className="mt-1 flex items-center justify-between text-[13px] text-white/70">
                          <span>
                            {t.driverApp.scanPage} {i + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPages((list) => {
                                URL.revokeObjectURL(list[i]!.url);
                                return list.filter((_, j) => j !== i);
                              })
                            }
                            className="h-11 px-2 text-white"
                          >
                            {t.driverApp.scanRemove}
                          </button>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
                <button
                  type="button"
                  onClick={shoot}
                  disabled={busy || pages.length >= MAX_PAGES}
                  className="h-12 flex-1 rounded-control border border-white/30 text-[15px] font-semibold disabled:opacity-50"
                >
                  {t.driverApp.scanAddPage}
                </button>
                <button
                  type="button"
                  onClick={finish}
                  disabled={busy || pages.length === 0}
                  className="h-12 flex-[2] rounded-control bg-white text-[15px] font-semibold text-black disabled:opacity-50"
                >
                  {busy ? t.driverApp.scanWorking : t.driverApp.scanFinish}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Снимок с четырьмя углами листа. Углы тянут пальцем; ручка крупная
 * (44 px) — в перчатке по-другому не попасть.
 */
function CornerEditor({
  url,
  width,
  height,
  quad,
  onChange,
}: {
  url: string;
  width: number;
  height: number;
  quad: Quad;
  onChange: (quad: Quad) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const scale = Math.min(el.clientWidth / width, el.clientHeight / height);
      setSize({ w: width * scale, h: height * scale });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width, height]);

  const scale = size.w / width || 1;

  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const point: Point = {
      x: Math.min(width, Math.max(0, (e.clientX - rect.left) / scale)),
      y: Math.min(height, Math.max(0, (e.clientY - rect.top) / scale)),
    };
    const next = [...quad] as Quad;
    next[dragging.current] = point;
    onChange(next);
  }

  const points = quad.map((p) => `${p.x * scale},${p.y * scale}`).join(' ');

  return (
    <div ref={box} className="flex min-h-0 flex-1 items-center justify-center px-4">
      <div
        className="relative touch-none"
        style={{ width: size.w, height: size.h }}
        onPointerMove={move}
        onPointerUp={() => (dragging.current = null)}
        onPointerCancel={() => (dragging.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- локальный снимок */}
        <img src={url} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
        <svg className="absolute inset-0 h-full w-full" aria-hidden>
          <polygon points={points} fill="rgba(56,140,255,0.18)" stroke="#3b8cff" strokeWidth="2" />
        </svg>
        {quad.map((p, i) => (
          <div
            key={i}
            aria-hidden
            onPointerDown={(e) => {
              dragging.current = i;
              e.currentTarget.parentElement?.setPointerCapture(e.pointerId);
            }}
            className="absolute size-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#3b8cff]/60"
            style={{ left: p.x * scale, top: p.y * scale }}
          />
        ))}
      </div>
    </div>
  );
}

function ScanIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M8 9h8M8 12h8M8 15h5" />
    </svg>
  );
}
