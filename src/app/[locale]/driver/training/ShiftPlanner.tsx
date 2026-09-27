'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import { statusToneClass, type StatusTone } from '@/components/ui';
import { SHIFT_SCENARIOS, type ShiftScenarioId } from '@/lib/training/modules';
import {
  SHIFT_RULES,
  shiftSegments,
  shiftTotals,
  validateShift,
  type ShiftBlock,
  type ShiftBlockKind,
  type ShiftFinding,
} from '@/lib/training/shift';
import { Segmented, primaryButton, secondaryButton, useDuration } from './ui';

/** Кнопки добавления — как в прототипе: руль по 30 и 60, работа 15, перерывы 15/30/45. */
const ADD: ReadonlyArray<ShiftBlock> = [
  { kind: 'drive', minutes: 30 },
  { kind: 'drive', minutes: 60 },
  { kind: 'work', minutes: 15 },
  { kind: 'break', minutes: 15 },
  { kind: 'break', minutes: 30 },
  { kind: 'break', minutes: 45 },
];

const FILL: Record<ShiftBlockKind, string> = {
  drive: 'bg-accent',
  break: 'bg-ok',
  work: 'bg-warn',
};

const TONE: Record<ShiftFinding['level'], StatusTone> = { error: 'danger', warn: 'warn', ok: 'ok' };

/**
 * «Спланируй смену»: водитель собирает смену из блоков, проверка — чистая
 * validateShift. Полоса красит красным вождение без положенного перерыва
 * той же функцией обхода, что и проверка.
 */
export function ShiftPlanner({ mode }: { mode: 'pro' | 'new' }) {
  const { t, m } = useI18n();
  const dur = useDuration();
  const [scenarioId, setScenarioId] = useState<ShiftScenarioId>('short');
  const [blocks, setBlocks] = useState<ShiftBlock[]>([]);
  const [findings, setFindings] = useState<ShiftFinding[] | null>(null);

  const scenario = SHIFT_SCENARIOS.find((s) => s.id === scenarioId) ?? SHIFT_SCENARIOS[0];
  const texts = t.training.shift;
  const label: Record<ShiftBlockKind, string> = { drive: texts.drive, break: texts.rest, work: texts.work };

  const segments = shiftSegments(blocks);
  const totals = shiftTotals(blocks);
  const scaleMax = Math.max(SHIFT_RULES.regularRestFits, totals.total);

  function change(next: ShiftBlock[]) {
    setBlocks(next);
    setFindings(null);
  }

  function text(finding: ShiftFinding): string {
    switch (finding.code) {
      case 'continuous_driving':
        return m('training.shift.continuous', { at: dur(finding.atMinute), limit: dur(SHIFT_RULES.maxContinuousDrive) });
      case 'split_first_part':
        return m('training.shift.split', { first: dur(SHIFT_RULES.splitFirst), second: dur(SHIFT_RULES.splitSecond) });
      case 'drive_mismatch':
        return m('training.shift.driveMismatch', { planned: dur(finding.planned), required: dur(finding.required) });
      case 'daily_limit':
        return m('training.shift.dailyLimit', { limit: dur(finding.limit) });
      case 'extension_used':
        return m('training.shift.extension');
      case 'work_mismatch':
        return m('training.shift.workMismatch', { planned: dur(finding.planned), required: dur(finding.required) });
      case 'long_shift':
        return m('training.shift.longShift', { total: dur(finding.total) });
      case 'ok':
        return m('training.shift.ok', { total: dur(finding.total) });
      case 'empty':
        return m('training.shift.empty');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{texts.title}</h2>

      <Segmented
        label={texts.scenarioLabel}
        size="md"
        items={SHIFT_SCENARIOS.map((s) => ({ key: s.id, label: texts.scenarios[s.id].name }))}
        active={scenarioId}
        onChange={(id) => {
          setScenarioId(id);
          change([]);
        }}
      />

      <p className="text-[16px]">{texts.scenarios[scenario.id].task}</p>

      <div>
        <div
          className="flex h-11 overflow-hidden rounded-control border border-line bg-sunken"
          role="img"
          aria-label={`${texts.timeline}: ${segments.map((s) => `${label[s.kind]} ${dur(s.minutes)}`).join(', ')}`}
        >
          {segments.map((segment, i) => (
            <div
              key={i}
              className={cn(
                'flex h-full items-center justify-center overflow-hidden border-r border-surface/60 text-[11px] font-bold whitespace-nowrap text-accent-ink',
                segment.over ? 'bg-danger' : FILL[segment.kind],
              )}
              style={{ width: `${(segment.minutes / scaleMax) * 100}%` }}
            >
              {/* Короче часа подпись на телефоне обрезается — там хватает цвета. */}
              {segment.minutes >= 60 ? dur(segment.minutes) : ''}
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[12px] text-ink-muted">
          <span>0 {t.training.units.h}</span>
          <span>
            {Math.round(scaleMax / 60)} {t.training.units.h}
          </span>
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
        <div>
          <dt className="inline">{texts.drive}: </dt>
          <dd className="inline font-semibold tabular-nums">
            {dur(totals.drive)} / {dur(scenario.driveMinutes)}
          </dd>
        </div>
        <div>
          <dt className="inline">{texts.work}: </dt>
          <dd className="inline font-semibold tabular-nums">
            {dur(totals.work)} / {dur(scenario.workMinutes)}
          </dd>
        </div>
        <div>
          <dt className="inline">{texts.totalShift}: </dt>
          <dd className="inline font-semibold tabular-nums">{dur(totals.total)}</dd>
        </div>
      </dl>

      <div className="grid grid-cols-3 gap-2">
        {ADD.map((block) => (
          <button
            key={`${block.kind}-${block.minutes}`}
            type="button"
            onClick={() => change([...blocks, block])}
            className={cn(
              'min-h-14 rounded-control px-1 text-[14px] leading-tight font-semibold text-accent-ink',
              FILL[block.kind],
            )}
          >
            + {label[block.kind]} {dur(block.minutes)}
          </button>
        ))}
      </div>

      <button type="button" className={primaryButton} onClick={() => setFindings(validateShift(blocks, scenario))}>
        {texts.check}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={secondaryButton} disabled={!blocks.length} onClick={() => change(blocks.slice(0, -1))}>
          {texts.undo}
        </button>
        <button type="button" className={secondaryButton} disabled={!blocks.length} onClick={() => change([])}>
          {texts.clear}
        </button>
      </div>

      <div aria-live="polite" className="flex flex-col gap-2">
        {findings
          ? findings.map((finding, i) => (
              <p key={i} className={cn('rounded-control border px-3 py-2.5 text-[15px]', statusToneClass[TONE[finding.level]])}>
                {text(finding)}
              </p>
            ))
          : mode === 'new' && (
              <p className={cn('rounded-control border px-3 py-2.5 text-[15px]', statusToneClass.warn)}>{texts.newHint}</p>
            )}
      </div>
    </div>
  );
}
