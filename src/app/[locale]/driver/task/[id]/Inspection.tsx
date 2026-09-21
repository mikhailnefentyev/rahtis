'use client';

import { useState } from 'react';
import type { TripPhoto } from '@/lib/driverApp/photos';
import { useI18n } from '@/lib/i18n/provider';
import { PhotoCapture, type PhotoTarget } from './PhotoCapture';

type Item = {
  key: string;
  label: string;
  subject: PhotoTarget['subject'];
  angle?: PhotoTarget['angle'];
};

/**
 * Осмотр на точке — список по сторонам, как у DFDS.
 *
 * У полуприцепа и контейнера — четыре стороны и пломба, если она
 * требуется. У экспресса единицы нет, и снимается груз. Повреждение
 * отмечается переключателем до съёмки: снимок ложится видом «фото
 * повреждения», и в споре его не надо искать среди обычных.
 *
 * На сдаче рядом со стороной — её снимок при взятии: новая вмятина
 * отличима от старой прямо у ворот.
 */
export function Inspection({
  orderId,
  stopId,
  unit,
  sealRequired,
  delivery,
  photos,
}: {
  orderId: string;
  stopId: string;
  /** Полуприцеп или контейнер — единица, у которой есть стороны. */
  unit: boolean;
  sealRequired: boolean;
  /** Точка сдачи: показывать снимок взятия для сравнения. */
  delivery: boolean;
  photos: TripPhoto[];
}) {
  const { t } = useI18n();
  const [damage, setDamage] = useState<Record<string, boolean>>({});

  const items: Item[] = unit
    ? [
        { key: 'FRONT', label: t.driverApp.angle.FRONT, subject: 'TRAILER', angle: 'FRONT' },
        { key: 'LEFT', label: t.driverApp.angle.LEFT, subject: 'TRAILER', angle: 'LEFT' },
        { key: 'RIGHT', label: t.driverApp.angle.RIGHT, subject: 'TRAILER', angle: 'RIGHT' },
        { key: 'BACK', label: t.driverApp.angle.BACK, subject: 'TRAILER', angle: 'BACK' },
        ...(sealRequired ? [{ key: 'SEAL', label: t.driverApp.sealPhoto, subject: 'SEAL' as const }] : []),
      ]
    : [{ key: 'CARGO', label: t.driverApp.cargoPhoto, subject: 'CARGO' }];

  const here = photos.filter((p) => p.stopId === stopId);
  const shotOf = (item: Item) =>
    here.filter((p) => (item.angle ? p.angle === item.angle : p.subject === item.subject)).at(-1);
  const pickupOf = (item: Item) =>
    delivery && item.angle
      ? photos.filter((p) => p.phase === 'PICKUP' && p.angle === item.angle).at(-1)
      : undefined;

  const extra = here.filter((p) => p.subject === 'OTHER');

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-[16px] font-semibold">{t.driverApp.inspection}</h3>
        <p className="text-sm text-ink-muted">{t.driverApp.inspectionHint}</p>
      </div>

      {items.map((item) => {
        const shot = shotOf(item);
        const before = pickupOf(item);
        return (
          <div key={item.key} className="rounded-card border border-line bg-surface p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[16px] font-semibold">
                {shot ? '✓ ' : ''}
                {item.label}
              </span>
              <label className="flex items-center gap-2 text-[15px]">
                <input
                  type="checkbox"
                  checked={Boolean(damage[item.key])}
                  onChange={(e) => setDamage((d) => ({ ...d, [item.key]: e.target.checked }))}
                  className="size-5 accent-[var(--color-danger)]"
                />
                {t.driverApp.damageToggle}
              </label>
            </div>

            {(before?.url || shot?.url) && (
              <div className="mt-2 flex gap-2">
                {before?.url && (
                  <figure className="flex-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={before.url} alt="" className="h-24 w-full rounded-control object-cover" />
                    <figcaption className="mt-0.5 text-xs text-ink-muted">{t.driverApp.atPickup}</figcaption>
                  </figure>
                )}
                {shot?.url && (
                  <figure className="flex-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shot.url} alt="" className="h-24 w-full rounded-control object-cover" />
                    <figcaption className="mt-0.5 text-xs text-ink-muted">
                      {shot.kind === 'DAMAGE_PHOTO' ? t.driverApp.damageToggle : t.driverApp.stopDone}
                    </figcaption>
                  </figure>
                )}
              </div>
            )}

            <PhotoCapture
              className="mt-2"
              target={{ orderId, stopId, subject: item.subject, angle: item.angle }}
              damage={Boolean(damage[item.key])}
              label={t.driverApp.takePhoto}
              done={Boolean(shot)}
            />
          </div>
        );
      })}

      <div className="rounded-card border border-line bg-surface p-3">
        <span className="text-[16px] font-semibold">
          {t.driverApp.extraPhoto}
          {extra.length > 0 ? ` · ${extra.length}` : ''}
        </span>
        <PhotoCapture
          className="mt-2"
          target={{ orderId, stopId, subject: 'OTHER' }}
          label={t.driverApp.takePhoto}
        />
      </div>
    </section>
  );
}
