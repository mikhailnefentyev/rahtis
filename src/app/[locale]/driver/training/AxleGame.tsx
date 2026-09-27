'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import { statusToneClass, type StatusTone } from '@/components/ui';
import {
  AXLE_CONFIG,
  axleRatio,
  calcAxleLoads,
  checkAxleLoads,
  slotCenter,
  type AxleFinding,
  type AxleName,
} from '@/lib/training/axles';
import { AXLE_SCENARIOS, type AxleScenarioId } from '@/lib/training/modules';
import { Segmented, primaryButton, secondaryButton } from './ui';

const TONE: Record<AxleFinding['level'], StatusTone> = { error: 'danger', warn: 'warn', ok: 'ok' };

type State = {
  slots: number[];
  /** Груз, который ещё надо поставить (режим place). */
  pool: number[];
  /** Сколько рядов выгружено (режим unload). */
  unloaded: number;
};

function initial(id: AxleScenarioId): State {
  const scenario = AXLE_SCENARIOS.find((s) => s.id === id)!;
  return {
    slots: scenario.start ? [...scenario.start] : Array(AXLE_CONFIG.slots).fill(0),
    pool: [...scenario.pool],
    unloaded: 0,
  };
}

/** Где на прицепе тележка: ряды, над которыми стоят её оси. */
function isOverBogie(index: number): boolean {
  return Math.abs(slotCenter(index) - AXLE_CONFIG.trailer.bogie) <= 1.4;
}

/**
 * «Jaa kuorma»: водитель расставляет или выгружает груз, нагрузки на оси
 * пересчитываются на каждое нажатие. Прицеп нарисован вертикально —
 * передний борт вверху, под тягачом: одиннадцать рядов во всю ширину
 * экрана, каждый под палец.
 */
export function AxleGame({ mode }: { mode: 'pro' | 'new' }) {
  const { t, m, f } = useI18n();
  const texts = t.training.axles;
  const [scenarioId, setScenarioId] = useState<AxleScenarioId>('load');
  const [state, setState] = useState<State>(() => initial('load'));
  const [findings, setFindings] = useState<AxleFinding[] | null>(null);

  const scenario = AXLE_SCENARIOS.find((s) => s.id === scenarioId)!;
  const loads = useMemo(() => calcAxleLoads(state.slots), [state.slots]);
  const unplaced = scenario.mode === 'place' ? state.pool.length : scenario.unload - state.unloaded;
  const tons = (value: number) => `${f.decimal(value, 1)} t`;

  function change(next: State) {
    setState(next);
    setFindings(null);
  }

  function tap(index: number) {
    const slots = [...state.slots];
    if (scenario.mode === 'place') {
      if (slots[index] > 0) {
        change({ ...state, slots: slots.map((m, i) => (i === index ? 0 : m)), pool: [slots[index], ...state.pool] });
      } else if (state.pool.length > 0) {
        const [next, ...rest] = state.pool;
        slots[index] = next;
        change({ ...state, slots, pool: rest });
      }
      return;
    }
    /* Выгрузка: снять ряд, пока не выгружено сколько нужно; повторное нажатие на снятый ряд — вернуть. */
    const original = scenario.start?.[index] ?? 0;
    if (slots[index] > 0 && state.unloaded < scenario.unload) {
      slots[index] = 0;
      change({ ...state, slots, unloaded: state.unloaded + 1 });
    } else if (slots[index] === 0 && original > 0) {
      slots[index] = original;
      change({ ...state, slots, unloaded: state.unloaded - 1 });
    }
  }

  const axleLabel: Record<AxleName, string> = { steer: texts.steer, drive: texts.drive, bogie: texts.bogie };

  function text(finding: AxleFinding): string {
    switch (finding.code) {
      case 'over_axle':
        return m('training.axles.over', { axle: axleLabel[finding.axle], load: f.decimal(finding.load, 1), limit: f.decimal(finding.limit, 1) });
      case 'over_total':
        return m('training.axles.overTotal', { load: f.decimal(finding.load, 1), limit: f.decimal(finding.limit, 0) });
      case 'unplaced':
        return m(scenario.mode === 'place' ? 'training.axles.unplaced' : 'training.axles.unloadLeft', { count: finding.count });
      case 'drive_light':
        return m('training.axles.driveLight', { share: finding.share, min: finding.min });
      case 'ok':
        return m('training.axles.ok', { total: f.decimal(finding.total, 1) });
    }
  }

  const bars: Array<[AxleName | 'total', string]> = [
    ['steer', texts.steer],
    ['drive', texts.drive],
    ['bogie', texts.bogie],
    ['total', texts.total],
  ];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{texts.title}</h2>

      <Segmented
        label={texts.scenarioLabel}
        size="md"
        items={AXLE_SCENARIOS.map((s) => ({ key: s.id, label: texts.scenarios[s.id].name }))}
        active={scenarioId}
        onChange={(id) => {
          setScenarioId(id);
          change(initial(id));
        }}
      />

      <p className="text-[16px]">{texts.scenarios[scenarioId].task}</p>

      {/* Полосы нагрузок: цвет — доля лимита, число — тонны. */}
      <dl className="flex flex-col gap-2 rounded-card bg-raised/60 p-3" aria-live="polite">
        {bars.map(([axle, label]) => {
          const ratio = axleRatio(loads, axle);
          const tone = ratio > 1 ? 'bg-danger' : ratio > 0.92 ? 'bg-warn' : 'bg-ok';
          return (
            <div key={axle}>
              <div className="flex items-baseline justify-between gap-2 text-[14px]">
                <dt className={cn(axle === 'drive' && 'font-semibold')}>{label}</dt>
                <dd className={cn('font-mono tabular-nums', ratio > 1 && 'font-bold text-danger')}>
                  {tons(loads[axle])} / {tons(AXLE_CONFIG.limits[axle])}
                </dd>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-pill bg-surface">
                <i
                  className={cn('block h-full rounded-pill motion-safe:transition-[width] motion-safe:duration-[var(--duration-state)]', tone)}
                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </dl>

      <p className="flex items-center justify-between rounded-control border border-line px-3 py-2 text-[15px]">
        <span>{scenario.mode === 'place' ? texts.inHand : texts.toUnload}</span>
        <b className="font-mono tabular-nums">
          {scenario.mode === 'place' ? state.pool.map((m) => tons(m)).join(' · ') || '—' : Math.max(0, unplaced)}
        </b>
      </p>

      {/* Автопоезд сверху вниз: тягач, потом ряды прицепа от переднего борта к хвосту. */}
      <div className="flex flex-col items-stretch">
        <div className="mx-auto flex w-2/3 flex-col items-center rounded-t-card bg-night px-3 pt-2 pb-1 text-night-muted" aria-hidden>
          <span className="text-[12px] tracking-wider">{texts.steer}</span>
          <span className="my-1 h-1 w-full rounded-pill bg-night-line" />
          <span className="text-[12px] tracking-wider">{texts.drive}</span>
          <span className="my-1 h-1 w-full rounded-pill bg-night-line" />
        </div>
        <p className="border-x-2 border-t-2 border-ink/70 bg-surface py-1 text-center text-[12px] text-ink-muted">{texts.front}</p>
        <ol className="flex flex-col gap-1 border-x-2 border-b-2 border-ink/70 bg-surface p-1.5">
          {state.slots.map((mass, index) => {
            const bogie = isOverBogie(index);
            return (
              <li key={index} className="flex items-stretch gap-1.5">
                <button
                  type="button"
                  onClick={() => tap(index)}
                  aria-label={`${texts.slot} ${index + 1}: ${mass > 0 ? tons(mass) : '—'}`}
                  className={cn(
                    'flex min-h-11 flex-1 items-center justify-between rounded-control px-3 text-[15px] font-semibold',
                    mass > 0 ? 'bg-accent text-accent-ink' : 'border-[1.5px] border-dashed border-line-strong text-ink-faint',
                  )}
                >
                  <span className="font-mono text-[13px] opacity-80">{index + 1}</span>
                  <span className="font-mono">{mass > 0 ? tons(mass) : ''}</span>
                </button>
                {/* Оси тележки — справа, на уровне своих рядов. */}
                <span
                  aria-hidden
                  className={cn('w-2 rounded-pill', bogie ? 'bg-ink' : 'bg-transparent')}
                />
              </li>
            );
          })}
        </ol>
      </div>

      <p className="text-[14px] text-ink-muted">{scenario.mode === 'place' ? texts.placeHint : texts.unloadHint}</p>
      {mode === 'new' && (
        <p className="rounded-control border border-dashed border-warn/60 bg-warn/5 px-3 py-2.5 text-[15px]">
          <b className="text-warn">{t.training.hint}:</b> {texts.newHint}
        </p>
      )}

      <button type="button" className={primaryButton} onClick={() => setFindings(checkAxleLoads(state.slots, Math.max(0, unplaced)))}>
        {texts.check}
      </button>
      <button type="button" className={secondaryButton} onClick={() => change(initial(scenarioId))}>
        {texts.reset}
      </button>

      <div aria-live="polite" className="flex flex-col gap-2">
        {findings && (
          <>
            {findings.map((finding, i) => (
              <p key={i} className={cn('rounded-control border px-3 py-2.5 text-[15px]', statusToneClass[TONE[finding.level]])}>
                {text(finding)}
              </p>
            ))}
            <p className="text-[13px] text-ink-muted">{texts.model}</p>
          </>
        )}
      </div>
    </div>
  );
}
