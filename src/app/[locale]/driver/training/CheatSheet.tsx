'use client';

import { useI18n } from '@/lib/i18n/provider';
import type { TrainingModuleId } from '@/lib/training/modules';

/** Шпаргалка модуля: коротко, без лекций — для опытного водителя. */
export function CheatSheet({ module }: { module: TrainingModuleId }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{t.training.tabRules}</h2>
      <dl className="flex flex-col gap-3">
        {t.training.rules[module].map((rule) => (
          <div key={rule.t}>
            <dt className="text-[16px] font-semibold">{rule.t}</dt>
            <dd className="mt-0.5 text-[15px] text-ink-muted">{rule.d}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
