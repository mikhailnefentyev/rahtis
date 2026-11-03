'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { WeighTicketWarnings } from '@/components/domain/WeighTicketWarnings';
import { cn } from '@/lib/cn';
import { compressPhoto } from '@/lib/driverApp/photo';
import { combinationMass, isMassCountry, type TrailerUnit } from '@/lib/fleet/mass';
import { useI18n } from '@/lib/i18n/provider';
import { askPosition } from '@/lib/orders/position';
import { MATERIALS, dayEnd, isMaterialCode } from '@/lib/sites/work';
import { readWeighTicketAction } from '@/lib/weighTicket/actions';
import { formWeights, matchScaleSite, ticketWarnings, type Duplicates, type TicketReading } from '@/lib/weighTicket/reading';
import { useOutbox } from '../../OutboxProvider';

type Load = {
  id: string;
  material_code: string;
  scale_site_id: string | null;
  gross_kg: number | null;
  tare_kg: number | null;
  net_kg: number | null;
  unloaded_at: string;
  ticket_no: string | null;
};

type Day = {
  id: string;
  arrived_at: string;
  ended_at: string | null;
  buffer_minutes: number;
  trailer_id: string | null;
  approved_at: string | null;
  /* День уже в счёте: новых рейсов база не примет — формы нет. Старая база поля не отдаёт. */
  invoiced?: boolean;
  loads: Load[];
};

type Job = {
  id: string;
  /** Объект заведён под самосвальный заказ платформы. */
  order_id?: string | null;
  name: string;
  address: string | null;
  customer_name: string;
  material_code: string;
  receiving_site_id: string | null;
  day: Day | null;
};

type Trailer = { id: string; plate: string; kind: TrailerUnit['kind']; axles: number; twin_wheels: boolean; gross_max_kg: number | null; tare_kg: number | null };

export type SiteState = {
  today: string;
  country: string | null;
  vehicle: { id: string; plate: string; vehicle_class: string; axles: number; gross_max_kg: number | null; tare_kg: number | null } | null;
  trailers: Trailer[];
  jobs: Job[];
  scale_sites: { id: string; name: string; city: string | null; lat: number | null; lon: number | null; kind: string }[];
};

const BUTTON = 'h-14 w-full rounded-control px-4 text-[16px] font-semibold disabled:opacity-50';
const INPUT = 'h-12 w-full rounded-control border border-line bg-surface px-3 text-[16px]';

const tonnes = (kg: number) => (kg / 1000).toLocaleString('fi-FI', { maximumFractionDigits: 1 });

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}

/**
 * Экран объекта. Каждое нажатие уходит через очередь приложения: без
 * связи на карьере рейс не теряется и не задваивается, а сервер получит
 * время нажатия, а не время отправки.
 */
export function SiteScreen({ state }: { state: SiteState }) {
  const { t, f } = useI18n();
  const { pending, enqueue } = useOutbox();
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    let alive = true;
    askPosition(5000).then((p) => {
      if (alive && p) setPosition({ lat: p.lat, lon: p.lon });
    });
    return () => {
      alive = false;
    };
  }, []);

  const sites = useMemo(() => {
    const list = state.scale_sites.map((s) => ({
      ...s,
      km: position && s.lat != null && s.lon != null ? distanceKm(position, { lat: s.lat, lon: s.lon }) : null,
    }));
    return list.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9) || a.name.localeCompare(b.name));
  }, [state.scale_sites, position]);

  const sitePending = pending.filter((e) => e.kind === 'SITE');

  if (state.jobs.length === 0) {
    return (
      <>
        <p className="text-[15px] text-ink-muted">{t.siteWork.noJobs}</p>
        <AddSite position={position} enqueue={enqueue} />
      </>
    );
  }

  return (
    <>
      {sitePending.length > 0 && <p className="text-[13px] text-warn">{t.siteWork.queued} ({sitePending.length})</p>}
      {state.jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          state={state}
          sites={sites}
          position={position}
          pendingFor={sitePending.filter((e) => e.fields.job_id === job.id)}
          enqueue={enqueue}
          formatTime={(iso) => f.time(iso)}
        />
      ))}
      <AddSite position={position} enqueue={enqueue} />
    </>
  );
}

type Enqueue = ReturnType<typeof useOutbox>['enqueue'];
type Pending = ReturnType<typeof useOutbox>['pending'];

function JobCard({
  job,
  state,
  sites,
  position,
  pendingFor,
  enqueue,
  formatTime,
}: {
  job: Job;
  state: SiteState;
  sites: (SiteState['scale_sites'][number] & { km: number | null })[];
  position: { lat: number; lon: number } | null;
  pendingFor: Pending;
  enqueue: Enqueue;
  formatTime: (iso: string) => string;
}) {
  const { t } = useI18n();
  const [trailerId, setTrailerId] = useState(job.day?.trailer_id ?? '');
  const [material, setMaterial] = useState(job.material_code);
  const [scaleId, setScaleId] = useState(job.receiving_site_id ?? sites[0]?.id ?? '');
  const [gross, setGross] = useState('');
  const [tare, setTare] = useState('');
  const [ticket, setTicket] = useState('');
  const [busy, setBusy] = useState(false);
  /* Весовой талон по фото: прочитанное, повторы, фото без связи и подтверждение предупреждений. */
  const camera = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoState, setPhotoState] = useState<'none' | 'reading' | 'READ' | 'NOT_CONFIGURED' | 'FAILED' | 'offline'>('none');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [reading, setReading] = useState<TicketReading | null>(null);
  const [duplicates, setDuplicates] = useState<Duplicates | null>(null);
  const [offlinePhoto, setOfflinePhoto] = useState<Blob | null>(null);

  const pendingArrive = pendingFor.find((e) => e.fields.action === 'ARRIVE');
  const pendingLoads = pendingFor.filter((e) => e.fields.action === 'LOAD');
  const arrivedAt = job.day?.arrived_at ?? pendingArrive?.pressedAt ?? null;
  const dayTrailer = state.trailers.find((tr) => tr.id === (job.day?.trailer_id ?? trailerId)) ?? null;

  /* Предел массы сегодняшней сцепки — для предупреждения о перегрузе. */
  const mass = useMemo(() => {
    if (!state.vehicle) return null;
    /* Тягач без полуприцепа груз не возит: предел «18 т» дал бы ложный перегруз на каждом рейсе. */
    if (state.vehicle.vehicle_class === 'TRACTOR' && !dayTrailer) return null;
    const country = isMassCountry(state.country) ? state.country : 'FI';
    return combinationMass(
      country,
      {
        kind: state.vehicle.vehicle_class === 'TRACTOR' ? 'TRACTOR' : 'TRUCK',
        axles: state.vehicle.axles,
        grossMaxKg: state.vehicle.gross_max_kg,
        tareKg: state.vehicle.tare_kg,
      },
      dayTrailer
        ? [{ kind: dayTrailer.kind, axles: dayTrailer.axles, twinWheels: dayTrailer.twin_wheels, grossMaxKg: dayTrailer.gross_max_kg, tareKg: dayTrailer.tare_kg }]
        : [],
    );
  }, [state.vehicle, state.country, dayTrailer]);
  const limitKg = mass?.limitKg ?? null;

  const grossKg = Number.parseInt(gross.replace(/\s/g, ''), 10);
  const tareKg = Number.parseInt(tare.replace(/\s/g, ''), 10);
  const net = Number.isFinite(grossKg) && Number.isFinite(tareKg) && grossKg > tareKg ? grossKg - tareKg : null;
  const over = limitKg && Number.isFinite(grossKg) && grossKg > limitKg ? grossKg - limitKg : 0;

  const expectedPlates = [state.vehicle?.plate, dayTrailer?.plate].filter((p): p is string => Boolean(p));
  const warnings = ticketWarnings({
    grossKg: Number.isFinite(grossKg) ? grossKg : null,
    tareKg: Number.isFinite(tareKg) ? tareKg : null,
    ticketNo: ticket.trim() || null,
    scaleSiteId: scaleId || null,
    reading,
    duplicates,
    expectedPlates,
    limitKg,
    comboTareKg: mass?.tareKg ?? null,
  });

  function resetTicket() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPhotoState('none');
    setTicketId(null);
    setReading(null);
    setDuplicates(null);
    setOfflinePhoto(null);
  }

  /**
   * Фото талона: сжать, отправить на чтение, разложить прочитанное по
   * полям. Ничего не сохраняет — рейс водитель сохраняет сам. Без связи
   * фото ждёт и уйдёт вместе с рейсом через очередь.
   */
  async function onPhoto(file: File | undefined) {
    if (!file) return;
    resetTicket();
    const blob = await compressPhoto(file);
    setPreview(URL.createObjectURL(blob));

    if (!navigator.onLine) {
      setOfflinePhoto(blob);
      setPhotoState('offline');
      return;
    }

    setPhotoState('reading');
    const form = new FormData();
    form.set('file', new File([blob], 'ticket.jpg', { type: blob.type || 'image/jpeg' }));
    form.set('ticket_id', crypto.randomUUID());
    form.set('job_id', job.id);
    form.set('expected_plates', JSON.stringify(expectedPlates));

    try {
      const result = await readWeighTicketAction(form);
      if (!result.ok) {
        /* Не легло на сервер — фото поедет с рейсом через очередь. */
        setOfflinePhoto(blob);
        setPhotoState(result.error === 'failed' ? 'offline' : 'FAILED');
        return;
      }
      setTicketId(result.ticketId);
      setDuplicates(result.duplicates);
      setPhotoState(result.status);
      if (result.reading) {
        const r = result.reading;
        setReading(r);
        const weights = formWeights(r);
        if (weights.grossKg) setGross(String(weights.grossKg));
        if (weights.tareKg) setTare(String(weights.tareKg));
        if (r.ticketNumber) setTicket(r.ticketNumber);
        if (r.materialCode && isMaterialCode(r.materialCode)) setMaterial(r.materialCode);
        const site = matchScaleSite(r.scaleName, sites);
        /* Поля весов видны только при выбранных весах: нашлись по шапке — их, иначе весы объекта. */
        if (site) setScaleId(site.id);
        else if (!scaleId && (weights.grossKg || weights.tareKg)) setScaleId(job.receiving_site_id ?? sites[0]?.id ?? '');
      }
    } catch {
      setOfflinePhoto(blob);
      setPhotoState('offline');
    }
  }

  const loads = job.day?.loads ?? [];
  const netTotal = loads.reduce((s, l) => s + (l.net_kg ?? 0), 0);
  const end = job.day
    ? dayEnd({ arrivedAt: job.day.arrived_at, endedAt: job.day.ended_at, bufferMinutes: job.day.buffer_minutes, unloads: loads.map((l) => l.unloaded_at) })
    : null;

  async function send(action: 'ARRIVE' | 'LOAD' | 'END', data: Record<string, unknown> = {}, blob?: Blob) {
    setBusy(true);
    try {
      await enqueue('SITE', { action, job_id: job.id, data: JSON.stringify(data) }, blob);
    } finally {
      setBusy(false);
    }
  }

  async function arrive() {
    const p = position ?? (await askPosition(3000));
    await send('ARRIVE', { trailer_id: trailerId || null, lat: p?.lat ?? null, lon: p?.lon ?? null });
  }

  async function saveLoad() {
    await send(
      'LOAD',
      {
        material_code: material,
        scale_site_id: scaleId || null,
        gross_kg: Number.isFinite(grossKg) ? grossKg : null,
        tare_kg: Number.isFinite(tareKg) ? tareKg : null,
        ticket_no: ticket.trim() || null,
        weigh_ticket_id: ticketId,
      },
      ticketId ? undefined : (offlinePhoto ?? undefined),
    );
    setGross('');
    setTare('');
    setTicket('');
    resetTicket();
  }

  return (
    <section className="rounded-card border border-line bg-surface px-4 py-4">
      <h2 className="text-[17px] font-semibold leading-snug">{job.name}</h2>
      <p className="text-[13px] text-ink-muted">
        {job.customer_name}
        {job.address ? ` · ${job.address}` : ''}
      </p>

      {!arrivedAt ? (
        <div className="mt-4 flex flex-col gap-3">
          {state.trailers.length > 0 && (
            <label className="flex flex-col gap-1 text-[13px]">
              {t.siteWork.trailerToday}
              <select className={INPUT} value={trailerId} onChange={(e) => setTrailerId(e.target.value)}>
                <option value="">{t.siteWork.noTrailer}</option>
                {state.trailers.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.plate}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className={cn(BUTTON, 'bg-accent text-white')} disabled={busy} onClick={arrive}>
            {t.siteWork.arrive}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-[14px]">
            {t.siteWork.arrivedAt} <span className="font-mono font-semibold">{formatTime(arrivedAt)}</span>
            {dayTrailer && <span className="text-ink-muted"> · {dayTrailer.plate}</span>}
          </p>
          <p className="mt-1 text-[14px]">
            {t.siteWork.loadsToday}:{' '}
            <span className="font-semibold">
              {loads.length + pendingLoads.length} · {tonnes(netTotal)} {t.siteWork.tonnes}
            </span>
          </p>
          {end && (
            <p className="mt-1 text-[13px] text-ink-muted">
              {job.day?.ended_at ? t.siteWork.ended : t.siteWork.dayEnds} <span className="font-mono">{formatTime(end)}</span>
              {!job.day?.ended_at && ` (${t.siteWork.dayEndsHint})`}
            </p>
          )}
          {job.day?.approved_at && <p className="mt-1 text-[13px] text-ok">{t.siteWork.approved}</p>}

          {!job.day?.invoiced && (
          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
            <h3 className="text-[15px] font-semibold">{t.siteWork.newLoad}</h3>

            {/* Весовой талон: фото → поля ниже. Сохраняет водитель сам, после проверки. */}
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
                className="h-12 flex-1 rounded-control border-[1.5px] border-line-strong bg-surface px-4 text-[15px] font-semibold disabled:opacity-50"
                disabled={busy || photoState === 'reading'}
                onClick={() => camera.current?.click()}
              >
                {preview ? t.weighTicket.photoRetake : t.weighTicket.photo}
              </button>
            </div>
            {photoState === 'none' ? (
              <p className="-mt-1 text-[12px] text-ink-dim">{t.weighTicket.photoHint}</p>
            ) : (
              <p
                className={cn('text-[14px]', photoState === 'READ' ? 'text-ok' : photoState === 'reading' ? 'text-ink-muted' : 'text-warn')}
                aria-live="polite"
              >
                {photoState === 'reading'
                  ? t.weighTicket.reading
                  : photoState === 'READ'
                    ? t.weighTicket.read
                    : photoState === 'NOT_CONFIGURED'
                      ? t.weighTicket.notConfigured
                      : photoState === 'FAILED'
                        ? t.weighTicket.failed
                        : t.weighTicket.offline}
              </p>
            )}

            <label className="flex flex-col gap-1 text-[13px]">
              {t.siteWork.material}
              <select className={INPUT} value={material} onChange={(e) => setMaterial(e.target.value)}>
                {MATERIALS.map((m) => (
                  <option key={m.code} value={m.code}>
                    {t.siteWork.materials[m.code]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[13px]">
              {t.siteWork.scale}
              <select className={INPUT} value={scaleId} onChange={(e) => setScaleId(e.target.value)}>
                <option value="">{t.siteWork.scaleNone}</option>
                {sites.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.city ? `, ${s.city}` : ''}
                    {s.km != null ? ` · ${s.km.toFixed(s.km < 10 ? 1 : 0)} km` : ''}
                    {i === 0 && s.km != null ? ` (${t.siteWork.nearest})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {scaleId && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[13px]">
                  {t.siteWork.gross}
                  <input className={cn(INPUT, 'font-mono')} inputMode="numeric" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="74800" />
                </label>
                <label className="flex flex-col gap-1 text-[13px]">
                  {t.siteWork.tare}
                  <input className={cn(INPUT, 'font-mono')} inputMode="numeric" value={tare} onChange={(e) => setTare(e.target.value)} placeholder="24600" />
                </label>
                <label className="col-span-2 flex flex-col gap-1 text-[13px]">
                  {t.siteWork.ticket}
                  <input className={cn(INPUT, 'font-mono')} value={ticket} onChange={(e) => setTicket(e.target.value)} />
                </label>
              </div>
            )}
            {net !== null && (
              <p className="text-[15px]">
                {t.siteWork.net}: <span className="font-mono font-semibold">{tonnes(net)} {t.siteWork.tonnes}</span>
              </p>
            )}
            {over > 0 && limitKg && (
              <p className="rounded-control bg-danger/10 px-3 py-2 text-[15px] font-semibold text-danger" role="alert">
                {t.siteWork.overload} {over.toLocaleString('fi-FI')} kg · {t.siteWork.limit} {tonnes(limitKg)} {t.siteWork.tonnes}
              </p>
            )}
            <WeighTicketWarnings
              warnings={warnings}
              onFix={(field, kg) => (field === 'gross' ? setGross(String(kg)) : setTare(String(kg)))}
            />
            <button
              type="button"
              className={cn(BUTTON, warnings.length > 0 ? 'bg-ink text-surface' : 'bg-accent text-white')}
              disabled={busy || photoState === 'reading'}
              onClick={saveLoad}
            >
              {warnings.length > 0 ? t.weighTicket.confirmAnyway : t.siteWork.saveLoad}
            </button>
          </div>
          )}

          {loads.length > 0 && (
            <ul className="mt-4 flex flex-col divide-y divide-line border-t border-line text-[14px]">
              {loads
                .slice()
                .reverse()
                .map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 py-2">
                    <span>
                      <span className="font-mono">{formatTime(l.unloaded_at)}</span> · {t.siteWork.materials[l.material_code as keyof typeof t.siteWork.materials] ?? l.material_code}
                    </span>
                    <span className="font-mono">{l.net_kg != null ? `${tonnes(l.net_kg)} ${t.siteWork.tonnes}` : '—'}</span>
                  </li>
                ))}
            </ul>
          )}

          {!job.day?.ended_at && (
            <button type="button" className={cn(BUTTON, 'mt-4 border border-line bg-surface')} disabled={busy || !job.day} onClick={() => send('END')}>
              {t.siteWork.end}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** Новый пункт приёмки — там, где водитель стоит сейчас. */
function AddSite({ position, enqueue }: { position: { lat: number; lon: number } | null; enqueue: Enqueue }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" className="text-left text-[14px] text-accent underline" onClick={() => setOpen(true)}>
          {t.siteWork.addSite}
        </button>
        <p className="text-[12px] text-ink-dim">{t.siteWork.addSiteHint}</p>
      </div>
    );
  }

  async function save() {
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      const p = position ?? (await askPosition(4000));
      await enqueue('SITE', { action: 'ADD_SITE', job_id: '', data: JSON.stringify({ name: name.trim(), lat: p?.lat ?? null, lon: p?.lon ?? null }) });
      setName('');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface px-4 py-4">
      <label className="flex flex-col gap-1 text-[13px]">
        {t.siteWork.siteName}
        <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="button" className={cn(BUTTON, 'bg-accent text-white')} disabled={busy} onClick={save}>
        {t.siteWork.saveSite}
      </button>
    </section>
  );
}
