'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { compressPhoto } from '@/lib/driverApp/photo';
import { useI18n } from '@/lib/i18n/provider';
import { DEFECT_AREAS, type DefectArea, type DefectSeverity, type MaintenanceKind } from '@/lib/maintenance/status';
import { useOutbox } from '../../OutboxProvider';

export type DefectState = {
  company_id: string;
  vehicle: { id: string; plate: string } | null;
  last_odometer: number | null;
  trailers: { id: string; plate: string }[];
  due: { kind: MaintenanceKind; title: string | null; next_due_on: string | null; next_due_km: number | null }[];
  defects: {
    id: string;
    reported_at: string;
    area: DefectArea;
    severity: DefectSeverity;
    description: string;
    status: 'OPEN' | 'FIXED' | 'DISMISSED';
    mine: boolean;
    plate: string | null;
  }[];
};

const BUTTON = 'h-14 w-full rounded-control px-4 text-[16px] font-semibold disabled:opacity-50';
const INPUT = 'h-12 w-full rounded-control border border-line bg-surface px-3 text-[16px]';

/**
 * Форма дефекта. Без связи дефект ложится в очередь телефона и уходит
 * позже со временем нажатия — как заправка и отметки рейса.
 *
 * Цели крупные, под палец в перчатке: где (машина или прицеп), что
 * (узел — плитками), можно ли ехать (две большие кнопки), пара слов и
 * фото. Описание обязательно: «тормоза» без слов механику не поможет.
 */
export function DefectScreen({ state }: { state: DefectState }) {
  const { t, f } = useI18n();
  const d = t.defectDriver;
  const { pending, enqueue } = useOutbox();

  /* '' — машина водителя; иначе id прицепа. */
  const [target, setTarget] = useState<string>(state.vehicle ? '' : (state.trailers[0]?.id ?? ''));
  const [area, setArea] = useState<DefectArea | null>(null);
  const [severity, setSeverity] = useState<DefectSeverity | null>(null);
  const [description, setDescription] = useState('');
  const [odometer, setOdometer] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const camera = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const queued = pending.filter((event) => event.kind === 'DEFECT');
  const onTrailer = target !== '';

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhoto(await compressPhoto(file));
  }

  async function save() {
    setError(null);
    if (!area || !severity || description.trim().length < 3) {
      setError(d.required);
      return;
    }
    const km = Number.parseInt(odometer.replace(/\s/g, ''), 10);

    setBusy(true);
    try {
      await enqueue(
        'DEFECT',
        {
          data: JSON.stringify({
            trailer_id: onTrailer ? target : null,
            area,
            severity,
            description: description.trim().slice(0, 1000),
            odometer_km: !onTrailer && Number.isFinite(km) && km > 0 ? km : null,
          }),
        },
        photo ?? undefined,
      );
      setArea(null);
      setSeverity(null);
      setDescription('');
      setOdometer('');
      setPhoto(null);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  const kindLabel = (item: DefectState['due'][number]) => (item.kind === 'OTHER' && item.title ? item.title : d.kinds[item.kind]);

  return (
    <>
      {/* Сроки своей машины — коротко, сверху: водитель первым видит «katsastus через 5 дней». */}
      {state.due.length > 0 && (
        <section className="flex flex-col gap-2 rounded-card border border-warn/40 bg-warn/10 px-4 py-3">
          <h2 className="text-[15px] font-semibold">{d.dueTitle}</h2>
          <ul className="flex flex-col gap-1 text-[15px]">
            {state.due.map((item, i) => (
              <li key={i}>
                <span className="font-semibold">{kindLabel(item)}</span>
                {item.next_due_on && ` · ${f.date(`${item.next_due_on}T12:00:00Z`)}`}
                {item.next_due_km != null && ` · ${f.number(item.next_due_km)} km`}
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-ink-muted">{d.dueHint}</p>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface px-4 py-4">
        <label className="flex flex-col gap-1 text-[13px]">
          {d.target}
          <select
            className={INPUT}
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setSaved(false);
            }}
          >
            {state.vehicle && (
              <option value="">
                {d.vehicle}: {state.vehicle.plate}
              </option>
            )}
            {state.trailers.map((trailer) => (
              <option key={trailer.id} value={trailer.id}>
                {d.trailer}: {trailer.plate}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px]">{d.area}</legend>
          <div className="grid grid-cols-2 gap-2">
            {DEFECT_AREAS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={area === value}
                className={cn(
                  'min-h-12 rounded-control border px-3 py-2 text-left text-[15px] font-semibold',
                  area === value ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface',
                )}
                onClick={() => {
                  setArea(value);
                  setSaved(false);
                }}
              >
                {d.areas[value]}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Можно ли ехать — главный вопрос для перевозчика; две кнопки, без выбора по умолчанию. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px]">{d.severity}</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={severity === 'CAN_DRIVE'}
              className={cn(
                'min-h-14 rounded-control border-[1.5px] px-3 text-[15px] font-semibold',
                severity === 'CAN_DRIVE' ? 'border-ok bg-ok/10 text-ok' : 'border-line bg-surface',
              )}
              onClick={() => setSeverity('CAN_DRIVE')}
            >
              {d.canDrive}
            </button>
            <button
              type="button"
              aria-pressed={severity === 'UNSAFE'}
              className={cn(
                'min-h-14 rounded-control border-[1.5px] px-3 text-[15px] font-semibold',
                severity === 'UNSAFE' ? 'border-danger bg-danger/10 text-danger' : 'border-line bg-surface',
              )}
              onClick={() => setSeverity('UNSAFE')}
            >
              {d.unsafe}
            </button>
          </div>
          {severity === 'UNSAFE' && <p className="text-[14px] text-danger">{d.unsafeHint}</p>}
        </fieldset>

        <label className="flex flex-col gap-1 text-[13px]">
          {d.description}
          <textarea
            className="min-h-24 w-full rounded-control border border-line bg-surface px-3 py-2 text-[16px]"
            value={description}
            maxLength={1000}
            onChange={(e) => {
              setDescription(e.target.value);
              setSaved(false);
            }}
            placeholder={d.descriptionPlaceholder}
          />
        </label>

        {!onTrailer && (
          <label className="flex flex-col gap-1 text-[13px]">
            {d.odometer}
            <input
              className={cn(INPUT, 'font-mono')}
              inputMode="numeric"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              placeholder={state.last_odometer ? String(state.last_odometer) : ''}
            />
          </label>
        )}

        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void onPhoto(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div className="flex items-center gap-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- снимок с телефона, ещё не на сервере
            <img src={preview} alt="" className="size-14 shrink-0 rounded-control border border-line object-cover" />
          )}
          <button
            type="button"
            className="h-12 flex-1 rounded-control border-[1.5px] border-line-strong bg-surface px-4 text-[15px] font-semibold"
            onClick={() => camera.current?.click()}
          >
            {photo ? d.photoRetake : d.photo}
          </button>
        </div>

        {error && <p className="text-[14px] text-danger">{error}</p>}
        <button type="button" className={cn(BUTTON, 'bg-accent text-accent-ink')} disabled={busy} onClick={save}>
          {d.save}
        </button>
        {saved && <p className="text-[14px] text-ok">{d.saved}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">{d.recent}</h2>
        {queued.length === 0 && state.defects.length === 0 && <p className="text-[15px] text-ink-muted">{d.none}</p>}
        <ul className="flex flex-col gap-2">
          {queued.map((event) => {
            let data: { area?: DefectArea; description?: string } = {};
            try {
              data = JSON.parse(event.fields.data);
            } catch {}
            return (
              <li key={event.id} className="rounded-card border border-dashed border-line bg-surface px-4 py-3 text-[15px]">
                <p className="font-semibold">{data.area ? d.areas[data.area] : ''}</p>
                <p className="text-[14px]">{data.description}</p>
                <p className="text-[13px] text-ink-muted">
                  {f.dateTime(event.pressedAt)} · {d.queued}
                </p>
              </li>
            );
          })}
          {state.defects.map((defect) => (
            <li key={defect.id} className="rounded-card border border-line bg-surface px-4 py-3 text-[15px]">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {d.areas[defect.area]}
                {defect.plate && <span className="font-mono text-[13px] font-normal">{defect.plate}</span>}
                <span
                  className={cn(
                    'rounded-pill px-2 text-[12px]',
                    defect.status === 'OPEN' ? (defect.severity === 'UNSAFE' ? 'bg-danger/10 text-danger' : 'bg-warn/10 text-warn') : 'bg-ok/10 text-ok',
                  )}
                >
                  {defect.status === 'OPEN' && defect.severity === 'UNSAFE' ? d.unsafe : d.statuses[defect.status]}
                </span>
              </p>
              <p className="text-[14px]">{defect.description}</p>
              <p className="text-[13px] text-ink-muted">
                {f.dateTime(defect.reported_at)}
                {!defect.mine ? ` · ${d.byOther}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
