'use client';

import { useState, useTransition } from 'react';
import { Button, Card, CardBody, Field, FileDrop, SectionTitle, Textarea } from '@/components/ui';
import { importOrderAction } from '@/lib/orders/importActions';
import type { OrderDraft } from '@/lib/orders/importDraft';
import { useI18n } from '@/lib/i18n/provider';

/* Снимок с телефона бывает 8–10 МБ; до отправки он ужимается, PDF — нет. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/* Vercel принимает тело запроса до 4,5 МБ. */
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

/**
 * «Luo tekstistä tai PDF:stä» над формой заказа.
 *
 * Письмо вставляется текстом, заказ-PDF или фото накладной — файлом.
 * Ответ не создаёт заказ: форма открывается заполненной, подсвечивает
 * то, что заполнил разбор, и перечисляет, чего не хватило.
 *
 * Своя форма, а не часть формы заказа: вложенная форма в HTML
 * недопустима, а отправлять письмо вместе с заказом незачем.
 */
export function OrderImport({ onDraft, defaultOpen = false }: { onDraft: (draft: OrderDraft) => void; defaultOpen?: boolean }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button size="sm" onClick={() => setOpen(true)}>
          {t.orderImport.open}
        </Button>
        <span className="text-xs text-ink-faint">{t.orderImport.openHint}</span>
      </div>
    );
  }

  return (
    <Card stripe="info">
      <CardBody>
        <SectionTitle>{t.orderImport.title}</SectionTitle>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setError(null);
            startTransition(async () => {
              const prepared = await prepare(data);
              if ('error' in prepared) {
                setError(t.orderImport[prepared.error]);
                return;
              }
              const result = await importOrderAction(prepared.data);
              if (result.ok) onDraft(result.draft);
              else setError(result.error);
            });
          }}
        >
          <input type="hidden" name="locale" value={locale} />
          <Field label={t.orderImport.textLabel}>
            {(p) => <Textarea {...p} name="text" rows={6} maxLength={30_000} placeholder={t.orderImport.textPlaceholder} />}
          </Field>
          <p className="label-micro text-center">{t.orderImport.or}</p>
          <FileDrop
            name="file"
            accept={ACCEPT}
            maxBytes={MAX_IMAGE_BYTES}
            choose={t.orderImport.fileChoose}
            drop={t.orderImport.fileDrop}
            tooLarge={t.orderImport.tooLarge}
            wrongType={t.orderImport.wrongFile}
          />
          <p className="text-xs text-ink-faint">{t.orderImport.privacy}</p>
          {error && (
            <p role="alert" className="rounded-control border border-warn/40 bg-warn/5 px-3 py-2 text-[13px] text-ink">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? t.orderImport.reading : t.orderImport.read}
            </Button>
            <Button type="button" onClick={() => setOpen(false)} disabled={pending}>
              {t.orderImport.cancel}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/**
 * Проверка и ужатие до отправки. Снимок уменьшается до 2200 px по длинной
 * стороне и уходит JPEG: текст накладной читается, а тело запроса
 * укладывается в лимит. PDF уходит как есть — и потому не больше 4 МБ.
 */
async function prepare(data: FormData): Promise<{ data: FormData } | { error: 'nothing' | 'tooLarge' | 'wrongFile' }> {
  const text = String(data.get('text') ?? '').trim();
  const file = data.get('file');
  const picked = file instanceof File && file.size > 0 ? file : null;
  if (!picked) {
    data.delete('file');
    return text ? { data } : { error: 'nothing' };
  }
  if (!ACCEPT.split(',').includes(picked.type)) return { error: 'wrongFile' };
  if (picked.type === 'application/pdf') return picked.size > MAX_PDF_BYTES ? { error: 'tooLarge' } : { data };
  if (picked.size > MAX_IMAGE_BYTES) return { error: 'tooLarge' };

  try {
    const bitmap = await createImageBitmap(picked);
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('blob');
    if (blob.size > MAX_PDF_BYTES) return { error: 'tooLarge' };
    data.set('file', new File([blob], picked.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
    return { data };
  } catch {
    /* Браузер не смог открыть снимок — отправим как есть, если влезает. */
    return picked.size > MAX_PDF_BYTES ? { error: 'tooLarge' } : { data };
  }
}
