'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import { statusToneClass, type StatusTone } from '@/components/ui';
import {
  CARGO_CONFIG,
  calcCargoSecuring,
  type CargoFinding,
  type CargoOptions,
  type CargoResult,
} from '@/lib/training/cargo';
import { Segmented, primaryButton } from './ui';

const TONE: Record<CargoFinding['level'], StatusTone> = { error: 'danger', warn: 'warn', ok: 'ok' };

const START: CargoOptions = { position: 'gap', base: 'wood', angle: 30, edges: false, labels: 'ok', straps: 6 };

/**
 * «Закрепи груз»: водитель выбирает, как закрепить, расчёт — чистая
 * calcCargoSecuring. Под результатом обязательно сказано, что модель
 * упрощённая: без запаса и без прочности борта.
 */
export function CargoGame({ mode }: { mode: 'pro' | 'new' }) {
  const { t, m, f } = useI18n();
  const texts = t.training.cargo;
  const [options, setOptions] = useState<CargoOptions>(START);
  const [result, setResult] = useState<CargoResult | null>(null);

  function set<K extends keyof CargoOptions>(key: K, value: CargoOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
    setResult(null);
  }

  function text(finding: CargoFinding): string {
    switch (finding.code) {
      case 'unlabelled':
        return m('training.cargo.unlabelled');
      case 'too_few':
        return m('training.cargo.tooFew', {
          required: finding.required,
          used: finding.used,
          direction: texts.dirs[finding.direction],
        });
      case 'no_straps':
        return m('training.cargo.noStraps');
      case 'gap':
        return m('training.cargo.gap');
      case 'shallow_angle':
        return m('training.cargo.shallow');
      case 'no_edges':
        return m('training.cargo.noEdges');
      case 'ok':
        return m('training.cargo.ok', { required: finding.required, used: finding.used });
    }
  }

  const g = (value: number) => `${f.decimal(value, 1)} g`;

  const groups = (
    [
      ['position', texts.position, [['gap', texts.gap], ['blocked', texts.blocked]]],
      ['base', texts.base, [['wood', texts.wood], ['mat', texts.mat]]],
      ['angle', texts.angle, [['30', texts.shallow], ['90', texts.steep]]],
      ['edges', texts.edges, [['false', texts.edgesNo], ['true', texts.edgesYes]]],
      ['labels', texts.labels, [['ok', texts.labelsOk], ['missing', texts.labelsMissing]]],
    ] as const
  ).map(([key, label, items]) => {
    const active = String(options[key]);
    return (
      <div key={key} className="flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold">{label}</p>
        <Segmented
          label={label}
          size="md"
          items={items.map(([value, text]) => ({ key: value, label: text }))}
          active={active}
          onChange={(value) => {
            if (key === 'angle') set('angle', Number(value));
            else if (key === 'edges') set('edges', value === 'true');
            else if (key === 'position') set('position', value as CargoOptions['position']);
            else if (key === 'base') set('base', value as CargoOptions['base']);
            else set('labels', value as CargoOptions['labels']);
          }}
        />
      </div>
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{texts.title}</h2>
      <p className="text-[16px]">{texts.task}</p>

      {groups}

      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold">{texts.straps}</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label={texts.fewer}
            disabled={options.straps <= 0}
            onClick={() => set('straps', Math.max(0, options.straps - 1))}
            className="size-14 rounded-control border-[1.5px] border-line bg-surface text-[24px] font-bold disabled:opacity-40"
          >
            −
          </button>
          <b className="min-w-[2ch] text-center text-[26px] tabular-nums" aria-live="polite">
            {options.straps}
          </b>
          <button
            type="button"
            aria-label={texts.more}
            disabled={options.straps >= CARGO_CONFIG.maxStraps}
            onClick={() => set('straps', Math.min(CARGO_CONFIG.maxStraps, options.straps + 1))}
            className="size-14 rounded-control border-[1.5px] border-line bg-surface text-[24px] font-bold disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {mode === 'new' && (
        <p className="rounded-control border border-dashed border-warn/60 px-3 py-2.5 text-[15px]">
          <b className="text-warn">{t.training.hint}:</b> {texts.newHint}
        </p>
      )}

      <button type="button" className={primaryButton} onClick={() => setResult(calcCargoSecuring(options))}>
        {texts.check}
      </button>

      <div aria-live="polite" className="flex flex-col gap-2">
        {result && (
          <>
            {result.findings.map((finding, i) => (
              <p key={i} className={cn('rounded-control border px-3 py-2.5 text-[15px]', statusToneClass[TONE[finding.level]])}>
                {text(finding)}
              </p>
            ))}
            <table className="w-full text-[15px]">
              <tbody>
                {(
                  [
                    [texts.friction, f.decimal(result.mu, 2)],
                    [texts.perStrap, m('training.cargo.perStrapValue', { value: result.perStrapDaN })],
                    [`${texts.forward} (${g(CARGO_CONFIG.acceleration.forward)})`, result.forward ?? texts.headboard],
                    [`${texts.sideways} (${g(CARGO_CONFIG.acceleration.sideways)})`, result.sideways],
                    [`${texts.backward} (${g(CARGO_CONFIG.acceleration.backward)})`, result.backward],
                  ] as const
                ).map(([label, value]) => (
                  <tr key={label} className="border-b border-line">
                    <td className="py-2 pr-2">{label}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[13px] text-ink-muted">{texts.model}</p>
          </>
        )}
      </div>
    </div>
  );
}
