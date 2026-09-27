'use client';

import { useI18n } from '@/lib/i18n/provider';
import type { FreshnessState } from '@/lib/training/leitner';

/**
 * Экран-тахограф над модулем — фирменный элемент тренажёра.
 *
 * Единственный тёмный блок на светлом экране: ночные токены и яркий
 * акцент, моноширинный шрифт, как у дисплея настоящего тахографа. Слоты
 * и клавиши — декорация, скрытая от чтения с экрана.
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

  return (
    <section aria-label={t.training.lcdLabel} className="rounded-card bg-night p-2.5">
      <div className="flex gap-2.5">
        <div className="min-w-0 flex-1 rounded-control bg-night-raised px-3 py-2.5 font-mono text-accent-bright">
          <div className="flex justify-between gap-2 text-[15px] whitespace-nowrap">
            <span className="truncate">{module}</span>
            <span>{m('training.lcdDue', { count: due })}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 text-[30px] leading-none whitespace-nowrap">
            <span>{freshness}%</span>
            <span className="text-[17px]">{t.training.lcdState[state]}</span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-pill bg-night-line"
            role="meter"
            aria-label={t.training.lcdLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={freshness}
          >
            <i
              className="block h-full bg-accent-bright motion-safe:transition-[width] motion-safe:duration-[var(--duration-object)]"
              style={{ width: `${freshness}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col justify-center gap-1.5" aria-hidden>
          <span className="block h-2.5 w-12 rounded-[2px] bg-night-line" />
          <span className="block h-2.5 w-12 rounded-[2px] bg-night-line" />
        </div>
      </div>
      <div className="mt-1.5 flex gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((key) => (
          <span key={key} className="block h-4 w-7 rounded-[3px] bg-night-line" />
        ))}
      </div>
    </section>
  );
}
