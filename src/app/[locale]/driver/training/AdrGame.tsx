'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import { statusToneClass, type StatusTone } from '@/components/ui';
import {
  KIT_ITEMS,
  KIT_SCENARIOS,
  PLATES,
  checkKit,
  decodeHazard,
  plateQuestion,
  type KitFinding,
  type KitItem,
  type PlateCargo,
} from '@/lib/training/adr';
import { CheckIcon, CrossIcon } from './icons';
import { Segmented, primaryButton, secondaryButton } from './ui';

const TONE: Record<KitFinding['level'], StatusTone> = { error: 'danger', warn: 'warn', ok: 'ok' };

/** Оранжевая табличка: номер опасности сверху, номер ООН снизу, чёрная рамка. */
function Plate({ hazard, un, labels }: { hazard: string; un: string; labels: { hazard: string; un: string } }) {
  return (
    <figure className="mx-auto w-56 overflow-hidden rounded-[6px] border-[5px] border-ink bg-hazard font-mono text-ink">
      <div className="border-b-[5px] border-ink py-2 text-center text-[40px] leading-none font-bold tracking-wider">
        <span className="sr-only">{labels.hazard}: </span>
        {hazard}
      </div>
      <div className="py-2 text-center text-[40px] leading-none font-bold tracking-wider">
        <span className="sr-only">{labels.un}: </span>
        {un}
      </div>
    </figure>
  );
}

function PlateMode() {
  const { t, m } = useI18n();
  const texts = t.training.adr;
  const [index, setIndex] = useState(0);
  /* Первый вопрос без случайности: сервер и браузер рисуют одно и то же. */
  const [question, setQuestion] = useState(() => plateQuestion(0, () => 0.42));
  const [picked, setPicked] = useState<PlateCargo | null>(null);

  const { plate } = question;
  const meaning = decodeHazard(plate.hazard)
    .map((token) => texts.tokens[token])
    .join(' · ');

  function next() {
    const i = (index + 1) % PLATES.length;
    setIndex(i);
    setQuestion(plateQuestion(i));
    setPicked(null);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Plate hazard={plate.hazard} un={plate.un} labels={{ hazard: texts.hazardLabel, un: texts.unLabel }} />
      <p className="text-center text-[17px] font-semibold">{texts.plateTask}</p>

      <div className="grid grid-cols-2 gap-2">
        {question.options.map((cargo) => {
          const right = picked != null && cargo === question.correct;
          const wrong = picked === cargo && cargo !== question.correct;
          return (
            <button
              key={cargo}
              type="button"
              disabled={picked != null}
              onClick={() => setPicked(cargo)}
              className={cn(
                'flex min-h-14 items-center justify-center gap-2 rounded-control border-[1.5px] px-2 text-center text-[16px] font-semibold',
                right ? 'border-ok bg-ok/10' : wrong ? 'border-danger bg-danger/10' : 'border-line bg-surface',
              )}
            >
              {right && <CheckIcon className="size-4 text-ok" />}
              {wrong && <CrossIcon className="size-4 text-danger" />}
              {texts.cargo[cargo]}
            </button>
          );
        })}
      </div>

      {picked && (
        <>
          <div
            className={cn(
              'rounded-r-control border-l-4 px-3.5 py-3 text-[15px]',
              picked === question.correct ? 'border-ok bg-ok/10' : 'border-danger bg-danger/10',
            )}
            aria-live="polite"
          >
            <b>
              {m(picked === question.correct ? 'training.adr.plateRight' : 'training.adr.plateWrong', {
                cargo: texts.cargo[question.correct],
                un: plate.un,
              })}
            </b>
            <p className="mt-1">
              {texts.meaning} {plate.hazard}: {meaning}.
            </p>
          </div>
          <button type="button" className={primaryButton} onClick={next}>
            {texts.next}
          </button>
        </>
      )}
    </div>
  );
}

function KitMode({ mode }: { mode: 'pro' | 'new' }) {
  const { t, m } = useI18n();
  const texts = t.training.adr;
  const [scenarioId, setScenarioId] = useState<(typeof KIT_SCENARIOS)[number]['id']>('petrolTank');
  const [chosen, setChosen] = useState<KitItem[]>([]);
  const [findings, setFindings] = useState<KitFinding[] | null>(null);

  const scenario = KIT_SCENARIOS.find((s) => s.id === scenarioId)!;
  const list = (items: readonly KitItem[]) => items.map((item) => texts.items[item]).join(', ');

  function text(finding: KitFinding): string {
    switch (finding.code) {
      case 'missing':
        return m('training.adr.missing', { items: list(finding.items) });
      case 'extinguishers':
        return m('training.adr.extinguishers', { total: finding.total, required: finding.required, additional: finding.additional });
      case 'not_adr':
        return m('training.adr.notAdr', { items: list(finding.items) });
      case 'extra':
        return m('training.adr.extra', { items: list(finding.items) });
      case 'ok':
        return m('training.adr.ok');
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[15px] font-semibold">{texts.scenarioLabel}</legend>
        {KIT_SCENARIOS.map((s) => (
          <label
            key={s.id}
            className={cn(
              'flex min-h-12 cursor-pointer items-center gap-3 rounded-control border-[1.5px] px-3 text-[15px]',
              s.id === scenarioId ? 'border-accent bg-accent-wash font-semibold' : 'border-line bg-surface',
            )}
          >
            <input
              type="radio"
              name="adr-scenario"
              className="size-5 accent-[var(--color-accent)]"
              checked={s.id === scenarioId}
              onChange={() => {
                setScenarioId(s.id);
                setChosen([]);
                setFindings(null);
              }}
            />
            {texts.scenarios[s.id]}
          </label>
        ))}
      </fieldset>

      <p className="text-[16px]">{texts.kitTask}</p>

      <div className="grid grid-cols-2 gap-2">
        {KIT_ITEMS.map((item) => {
          const on = chosen.includes(item);
          return (
            <button
              key={item}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setChosen((current) => (on ? current.filter((x) => x !== item) : [...current, item]));
                setFindings(null);
              }}
              className={cn(
                'flex min-h-12 items-center gap-2 rounded-control border-[1.5px] px-2.5 py-1.5 text-left text-[14px] leading-tight font-semibold',
                on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-[4px] border-[1.5px]',
                  on ? 'border-accent-ink' : 'border-line-strong',
                )}
              >
                {on && <CheckIcon className="size-3.5" />}
              </span>
              {texts.items[item]}
            </button>
          );
        })}
      </div>

      {mode === 'new' && (
        <p className="rounded-control border border-dashed border-warn/60 bg-warn/5 px-3 py-2.5 text-[15px]">
          <b className="text-warn">{t.training.hint}:</b> {texts.newHint}
        </p>
      )}

      <button type="button" className={primaryButton} onClick={() => setFindings(checkKit(scenario, chosen))}>
        {texts.check}
      </button>
      {chosen.length > 0 && (
        <button
          type="button"
          className={secondaryButton}
          onClick={() => {
            setChosen([]);
            setFindings(null);
          }}
        >
          {t.training.axles.reset}
        </button>
      )}

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

/** Практика ADR: две короткие игры — прочитать табличку и собрать комплект. */
export function AdrGame({ mode }: { mode: 'pro' | 'new' }) {
  const { t } = useI18n();
  const texts = t.training.adr;
  const [view, setView] = useState<'plate' | 'kit'>('plate');

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{texts.title}</h2>
      <Segmented
        label={texts.title}
        size="md"
        items={[
          { key: 'plate', label: texts.modePlate },
          { key: 'kit', label: texts.modeKit },
        ]}
        active={view}
        onChange={setView}
      />
      {view === 'plate' ? <PlateMode /> : <KitMode mode={mode} />}
    </div>
  );
}
