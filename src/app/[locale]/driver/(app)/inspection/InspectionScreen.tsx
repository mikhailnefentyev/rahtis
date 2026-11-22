'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import {
  INSPECTION_ITEMS,
  inspectionFaults,
  inspectionPayload,
  inspectionProblem,
  type InspectionAnswer,
  type InspectionItem,
} from '@/lib/maintenance/inspection';
import { useOutbox } from '../../OutboxProvider';

export type InspectionState = {
  vehicle: { id: string; plate: string } | null;
  last_odometer: number | null;
  today: { id: string; inspected_at: string; defects: number; mine: boolean }[];
};

type Answers = Partial<Record<InspectionItem, InspectionAnswer>>;

/**
 * Осмотр по пунктам. У каждого — две крупные кнопки «Kunnossa» / «Vika»;
 * «Kaikki kunnossa» отмечает все разом (обычный день — одно нажатие).
 * У неисправности — можно ли ехать и пара слов: она уйдёт перевозчику
 * дефектом, «ехать нельзя» — снимет машину с рейсов.
 */
export function InspectionScreen({ state }: { state: InspectionState }) {
  const { t, f } = useI18n();
  const s = t.defectDriver.inspection;
  const d = t.defectDriver;
  const { pending, enqueue } = useOutbox();

  const [answers, setAnswers] = useState<Answers>({});
  const [odometer, setOdometer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ count: number; unsafe: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const queued = pending.filter((event) => event.kind === 'INSPECTION');
  const faults = inspectionFaults(answers);
  const answered = INSPECTION_ITEMS.filter((k) => answers[k]).length;

  const set = (key: InspectionItem, answer: InspectionAnswer) => {
    setAnswers((prev) => ({ ...prev, [key]: answer }));
    setSaved(null);
    setError(null);
  };
  const fault = (key: InspectionItem): Extract<InspectionAnswer, { ok: false }> => {
    const a = answers[key];
    return a && !a.ok ? a : { ok: false, severity: null, description: '' };
  };

  async function save() {
    const problem = inspectionProblem(answers);
    if (problem) {
      setError(s.errors[problem]);
      return;
    }
    setBusy(true);
    try {
      const payload = inspectionPayload(answers as Record<InspectionItem, InspectionAnswer>, odometer);
      /* Машина на экране в момент нажатия: без связи осмотр уйдёт позже, а водителя могут пересадить. */
      const kept = await enqueue('INSPECTION', { data: JSON.stringify({ ...payload, vehicle_id: state.vehicle?.id ?? null }) });
      /* Не записалось и не ушло — ответы остаются на экране. */
      if (!kept) return;
      setSaved(faults);
      setAnswers({});
      setOdometer('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Машину сегодня уже осматривали (этот водитель или сменщик) — видно сразу. */}
      {state.today.length > 0 && (
        <section className="rounded-card border border-ok/40 bg-ok/10 px-4 py-3 text-[15px]">
          {state.today.map((row) => (
            <p key={row.id}>
              <span className="font-semibold">
                {s.doneAt} {f.time(row.inspected_at)}
              </span>
              {` · ${row.mine ? s.byYou : s.byOther}`}
              {row.defects > 0 && ` · ${s.faultsCount.replace('{count}', String(row.defects))}`}
            </p>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface px-4 py-4">
        <p className="text-[15px] text-ink-muted">{s.lead}</p>

        <label className="flex flex-col gap-1 text-[13px]">
          {s.odometer}
          <input
            className="h-12 w-full rounded-control border border-line bg-surface px-3 font-mono text-[16px]"
            inputMode="numeric"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            placeholder={state.last_odometer ? String(state.last_odometer) : ''}
          />
        </label>

        <button
          type="button"
          className="h-14 w-full rounded-control border-[1.5px] border-ok bg-ok/10 px-4 text-[16px] font-semibold text-ok"
          onClick={() => {
            setAnswers(Object.fromEntries(INSPECTION_ITEMS.map((k) => [k, answers[k] && !answers[k]!.ok ? answers[k] : { ok: true }])) as Answers);
            setSaved(null);
            setError(null);
          }}
        >
          {s.allOk}
        </button>

        <ol className="flex flex-col divide-y divide-line">
          {INSPECTION_ITEMS.map((key) => {
            const answer = answers[key];
            const bad = answer && !answer.ok ? answer : null;
            return (
              <li key={key} className="flex flex-col gap-2 py-3">
                <div>
                  <p className="text-[16px] font-semibold">{s.items[key]}</p>
                  <p className="text-[13px] text-ink-muted">{s.hints[key]}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={answer?.ok === true}
                    className={cn(
                      'min-h-12 rounded-control border-[1.5px] px-3 text-[15px] font-semibold',
                      answer?.ok === true ? 'border-ok bg-ok/10 text-ok' : 'border-line bg-surface',
                    )}
                    onClick={() => set(key, { ok: true })}
                  >
                    {s.ok}
                  </button>
                  <button
                    type="button"
                    aria-pressed={!!bad}
                    className={cn(
                      'min-h-12 rounded-control border-[1.5px] px-3 text-[15px] font-semibold',
                      bad ? 'border-danger bg-danger/10 text-danger' : 'border-line bg-surface',
                    )}
                    onClick={() => set(key, fault(key))}
                  >
                    {s.fault}
                  </button>
                </div>
                {bad && (
                  <div className="flex flex-col gap-2 rounded-control border border-danger/30 bg-danger/5 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        aria-pressed={bad.severity === 'CAN_DRIVE'}
                        className={cn(
                          'min-h-12 rounded-control border-[1.5px] px-3 text-[14px] font-semibold',
                          bad.severity === 'CAN_DRIVE' ? 'border-ok bg-ok/10 text-ok' : 'border-line bg-surface',
                        )}
                        onClick={() => set(key, { ...bad, severity: 'CAN_DRIVE' })}
                      >
                        {d.canDrive}
                      </button>
                      <button
                        type="button"
                        aria-pressed={bad.severity === 'UNSAFE'}
                        className={cn(
                          'min-h-12 rounded-control border-[1.5px] px-3 text-[14px] font-semibold',
                          bad.severity === 'UNSAFE' ? 'border-danger bg-danger/10 text-danger' : 'border-line bg-surface',
                        )}
                        onClick={() => set(key, { ...bad, severity: 'UNSAFE' })}
                      >
                        {d.unsafe}
                      </button>
                    </div>
                    <textarea
                      className="min-h-20 w-full rounded-control border border-line bg-surface px-3 py-2 text-[16px]"
                      value={bad.description}
                      maxLength={1000}
                      placeholder={s.faultPlaceholder}
                      onChange={(e) => set(key, { ...bad, description: e.target.value })}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {faults.unsafe && <p className="text-[14px] font-semibold text-danger">{d.unsafeHint}</p>}
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <button
          type="button"
          className="h-14 w-full rounded-control bg-accent px-4 text-[16px] font-semibold text-accent-ink disabled:opacity-50"
          disabled={busy}
          onClick={save}
        >
          {faults.count > 0 ? s.saveWithFaults.replace('{count}', String(faults.count)) : s.save}
          <span className="ml-2 font-mono text-[13px] font-normal opacity-80">
            {answered}/{INSPECTION_ITEMS.length}
          </span>
        </button>
        {saved && (
          <p className={cn('text-[14px]', saved.count > 0 ? 'text-warn' : 'text-ok')}>{saved.count > 0 ? s.savedFaults : s.saved}</p>
        )}
        {queued.length > 0 && <p className="text-[13px] text-ink-muted">{s.queued}</p>}
      </section>
    </>
  );
}
