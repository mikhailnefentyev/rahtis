'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FUEL_SOURCES, type FuelSource } from '@/lib/fuel/fuel';

/**
 * Три линии заправок за месяц: отчёт, водитель, спутник — нарастающим
 * итогом. Разошлись линии — значит, у одного источника заправка есть, а у
 * другого нет или объёмы не сходятся.
 *
 * Цвета — первые три слота проверенной категориальной палитры (синий,
 * оранжевый, бирюзовый); спутник ещё и пунктиром, чтобы не держаться на
 * одном цвете. Подписи линий справа, значения — в подсказке у курсора и в
 * таблице заправок ниже.
 */

export type SourceLinesProps = {
  days: string[];
  unit: 'l' | 'kg';
  lines: Record<FuelSource, number[] | null>;
  intl: string;
  labels: Record<FuelSource, string> & { title: string; noData: string; fleet: string; vehicle: string };
  vehicles: { id: string; plate: string }[];
  vehicle: string | null;
  /** Адрес страницы без параметра машины: к нему добавляется &vehicle=. */
  baseHref: string;
};

const STYLE: Record<FuelSource, { color: string; dash?: string }> = {
  IMPORT: { color: 'var(--series-1)' },
  DRIVER: { color: 'var(--series-2)' },
  TELEMATICS: { color: 'var(--series-3)', dash: '6 4' },
};

const HEIGHT = 220;
const PAD = { top: 12, right: 92, bottom: 26, left: 52 };

export function SourceLines({ days, unit, lines, intl, labels, vehicles, vehicle, baseHref }: SourceLinesProps) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const number = useMemo(() => new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }), [intl]);
  const dayLabel = useMemo(() => new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'numeric', timeZone: 'UTC' }), [intl]);
  const fmtDay = (day: string) => dayLabel.format(new Date(`${day}T12:00:00Z`));

  const present = FUEL_SOURCES.filter((source) => lines[source] != null);
  const max = Math.max(1, ...present.map((source) => lines[source]!.at(-1) ?? 0));
  const yMax = niceCeil(max);
  const ticks = [0, yMax / 2, yMax];

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (days.length > 1 ? (i / (days.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  /* Подписи у правого края: не ближе 14 px друг к другу, иначе слипаются при совпадающих линиях. */
  const endLabels = present
    .map((source) => ({ source, value: lines[source]!.at(-1) ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .map((item) => ({ ...item, at: y(item.value) }));
  for (let i = 1; i < endLabels.length; i += 1) {
    endLabels[i].at = Math.max(endLabels[i].at, endLabels[i - 1].at + 14);
  }

  const xTicks = days.length > 0 ? [0, Math.floor((days.length - 1) / 2), days.length - 1] : [];

  const onMove = (event: React.PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    setHover(Math.min(days.length - 1, Math.max(0, Math.round(ratio * (days.length - 1)))));
  };

  const onVehicle = (id: string) => {
    router.push(id ? `${baseHref}&vehicle=${encodeURIComponent(id)}` : baseHref);
  };

  return (
    <div className="source-lines flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label-micro">{labels.title}</p>
        <label className="flex items-center gap-2 text-[12px] text-ink-muted">
          {labels.vehicle}
          <select
            className="rounded-sm border border-line bg-surface px-2 py-1 text-[12px] text-ink"
            value={vehicle ?? ''}
            onChange={(event) => onVehicle(event.target.value)}
          >
            <option value="">{labels.fleet}</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-muted">
        {FUEL_SOURCES.map((source) => (
          <li key={source} className="flex items-center gap-2">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="1" y1="4" x2="21" y2="4" stroke={STYLE[source].color} strokeWidth="2" strokeDasharray={STYLE[source].dash} strokeLinecap="round" />
            </svg>
            <span className="text-ink">{labels[source]}</span>
            {lines[source] == null && <span className="text-ink-faint">· {labels.noData}</span>}
          </li>
        ))}
      </ul>

      <div ref={box} className="relative w-full">
        <svg width={width} height={HEIGHT} role="img" aria-label={labels.title}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(tick)} y2={y(tick)} stroke="var(--color-line)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="source-lines__axis">
                {number.format(tick)} {unit}
              </text>
            </g>
          ))}
          {xTicks.map((i) => (
            <text key={i} x={x(i)} y={HEIGHT - 6} textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'} className="source-lines__axis">
              {fmtDay(days[i])}
            </text>
          ))}

          {present.map((source) => (
            <polyline
              key={source}
              fill="none"
              stroke={STYLE[source].color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={STYLE[source].dash}
              points={lines[source]!.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            />
          ))}

          {endLabels.map((item) => (
            <text key={item.source} x={PAD.left + plotW + 8} y={item.at + 4} className="source-lines__end">
              {labels[item.source]}
            </text>
          ))}

          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--color-line-strong)" strokeWidth="1" />
              {present.map((source) => (
                <circle
                  key={source}
                  cx={x(hover)}
                  cy={y(lines[source]![hover])}
                  r="4"
                  fill={STYLE[source].color}
                  stroke="var(--color-surface)"
                  strokeWidth="2"
                />
              ))}
            </g>
          )}

          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>

        {hover != null && present.length > 0 && (
          <div
            className="source-lines__tip"
            style={{
              /* Во второй половине — слева от курсора: справа подписи линий. */
              left: x(hover) > width / 2 ? Math.max(0, x(hover) - 12 - 160) : x(hover) + 12,
              top: PAD.top,
            }}
          >
            <p className="source-lines__tip-day">{fmtDay(days[hover])}</p>
            {present.map((source) => (
              <p key={source} className="source-lines__tip-row">
                <svg width="14" height="6" aria-hidden="true">
                  <line x1="1" y1="3" x2="13" y2="3" stroke={STYLE[source].color} strokeWidth="2" strokeDasharray={STYLE[source].dash ? '3 2' : undefined} />
                </svg>
                <strong>
                  {number.format(lines[source]![hover])} {unit}
                </strong>
                <span>{labels[source]}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Верх оси: 1, 2 или 5 × 10ⁿ не меньше максимума. */
function niceCeil(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
}
