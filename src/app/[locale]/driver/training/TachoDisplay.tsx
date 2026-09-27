'use client';

import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import type { FreshnessState } from '@/lib/training/leitner';

const SEGMENTS = 10;

/**
 * Экран-тахограф над модулем — фирменный элемент тренажёра.
 *
 * Корпус прибора с прорезью для карт и кнопками, внутри — дисплей:
 * крупная «свежесть знаний» моноширинным шрифтом и шкала из делений, как
 * у настоящего тахографа. Единственный тёмный блок на светлом экране.
 * Прорези и кнопки — декорация, скрытая от чтения с экрана.
 */
export function TachoDisplay({
  module,
  freshness,
  state,
  due,
}: {
  module: string;
  freshness: number;
  state: FreshnessState;
  due: number;
}) {
  const { t, m } = useI18n();
  const lit = Math.round((freshness / 100) * SEGMENTS);

  return (
    <section
      aria-label={t.training.lcdLabel}
      className="rounded-card bg-night p-3 shadow-[inset_0_-3px_0_rgb(0_0_0/0.35)]"
    >
      <div className="mb-2 flex items-center justify-between px-1" aria-hidden>
        <span className="font-mono text-[11px] tracking-[0.2em] text-night-faint">RAHTIS</span>
        <span className="flex gap-1.5">
          <span className="block h-2 w-14 rounded-[2px] bg-black/50" />
          <span className="block h-2 w-14 rounded-[2px] bg-black/50" />
        </span>
      </div>

      <div className="rounded-control bg-black/35 px-3.5 py-3 font-mono text-accent-bright [text-shadow:0_0_8px_rgb(0_168_216/0.35)]">
        <div className="flex justify-between gap-2 text-[14px] whitespace-nowrap">
          <span className="truncate">{module}</span>
          <span className={cn(due > 0 && 'rounded-[2px] bg-accent-bright px-1 text-night [text-shadow:none]')}>
            {m('training.lcdDue', { count: due })}
          </span>
        </div>
        <div className="mt-1.5 flex items-end justify-between gap-2 whitespace-nowrap">
          <span className="text-[44px] leading-none tabular-nums">{freshness}%</span>
          <span className="pb-1 text-[16px]">{t.training.lcdState[state]}</span>
        </div>
        <div
          className="mt-3 grid grid-cols-10 gap-1"
          role="meter"
          aria-label={t.training.lcdLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={freshness}
        >
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span
              key={i}
              className={cn(
                'block h-2 rounded-[1px] motion-safe:transition-colors motion-safe:duration-[var(--duration-object)]',
                i < lit ? 'bg-accent-bright' : 'bg-accent-bright/15',
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex gap-1.5 px-1" aria-hidden>
        {[0, 1, 2, 3].map((key) => (
          <span key={key} className="block h-3.5 w-8 rounded-[3px] bg-night-line shadow-[inset_0_-2px_0_rgb(0_0_0/0.3)]" />
        ))}
      </div>
    </section>
  );
}
