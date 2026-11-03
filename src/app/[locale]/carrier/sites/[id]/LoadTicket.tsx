'use client';

import { useActionState, useRef, useState } from 'react';
import { WeighTicketWarnings } from '@/components/domain/WeighTicketWarnings';
import { Button, Field, InputMono, Modal, Select } from '@/components/ui';
import { compressPhoto } from '@/lib/driverApp/photo';
import { useI18n } from '@/lib/i18n/provider';
import { MATERIALS, isMaterialCode } from '@/lib/sites/work';
import { readWeighTicketAction, saveCarrierLoadAction, type CarrierLoadState } from '@/lib/weighTicket/actions';
import { formWeights, matchScaleSite, ticketWarnings, type Duplicates, type TicketReading } from '@/lib/weighTicket/reading';

type Load = {
  id: string;
  material_code: string;
  scale_site_id: string | null;
  gross_kg: number | null;
  tare_kg: number | null;
  ticket_no: string | null;
};

const initial: CarrierLoadState = { error: null, done: false };

/* «YYYY-MM-DDTHH:MM» талона → значение поля datetime-local (то же местное время). */
const localInput = (weighedAt: string | null) => (weighedAt && weighedAt.length >= 16 ? weighedAt.slice(0, 16) : '');

/**
 * Рейс по весовому талону — на странице объекта у диспетчера.
 *
 * load — правка этого рейса (или только фото к нему на объекте под заказ
 * платформы: веса там записывает водитель); без load — новый рейс в день
 * водителя. Фото читается сразу после выбора, поля заполняются, а
 * сохраняет диспетчер сам, видя предупреждения.
 */
export function LoadTicket({
  jobId,
  dayId,
  load,
  orderJob,
  defaultMaterial,
  scaleSites,
  expectedPlates,
  limitKg,
  comboTareKg,
}: {
  jobId: string;
  dayId: string;
  load?: Load;
  orderJob: boolean;
  defaultMaterial: string;
  scaleSites: { id: string; name: string; city: string | null }[];
  expectedPlates: string[];
  limitKg: number | null;
  comboTareKg: number | null;
}) {
  const { t, locale } = useI18n();
  const w = t.weighTicket;
  const s = t.siteWork;
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const [material, setMaterial] = useState(load?.material_code ?? defaultMaterial);
  const [scaleId, setScaleId] = useState(load?.scale_site_id ?? '');
  const [gross, setGross] = useState(load?.gross_kg ? String(load.gross_kg) : '');
  const [tare, setTare] = useState(load?.tare_kg ? String(load.tare_kg) : '');
  const [ticket, setTicket] = useState(load?.ticket_no ?? '');
  const [unloadedAt, setUnloadedAt] = useState('');

  const [preview, setPreview] = useState<string | null>(null);
  const [photoState, setPhotoState] = useState<'none' | 'reading' | 'READ' | 'NOT_CONFIGURED' | 'FAILED' | 'error'>('none');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [reading, setReading] = useState<TicketReading | null>(null);
  const [duplicates, setDuplicates] = useState<Duplicates | null>(null);

  const [state, action, pending] = useActionState(async (previous: CarrierLoadState, form: FormData) => {
    const result = await saveCarrierLoadAction(previous, form);
    if (result.done) close();
    return result;
  }, initial);

  function close() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPhotoState('none');
    setTicketId(null);
    setReading(null);
    setDuplicates(null);
    setOpen(false);
    if (!load) {
      setGross('');
      setTare('');
      setTicket('');
      setUnloadedAt('');
    }
  }

  async function onFile(chosen: File | undefined) {
    if (!chosen) return;
    if (preview) URL.revokeObjectURL(preview);
    const blob = await compressPhoto(chosen);
    setPreview(URL.createObjectURL(blob));
    setPhotoState('reading');
    setReading(null);
    setDuplicates(null);
    setTicketId(null);

    const form = new FormData();
    form.set('file', new File([blob], 'ticket.jpg', { type: blob.type || 'image/jpeg' }));
    form.set('ticket_id', crypto.randomUUID());
    form.set('job_id', jobId);
    form.set('expected_plates', JSON.stringify(expectedPlates));
    try {
      const result = await readWeighTicketAction(form);
      if (!result.ok) {
        setPhotoState('error');
        return;
      }
      setTicketId(result.ticketId);
      setDuplicates(result.duplicates);
      setPhotoState(result.status);
      const r = result.reading;
      if (r && !orderJob) {
        setReading(r);
        const weights = formWeights(r);
        if (weights.grossKg) setGross(String(weights.grossKg));
        if (weights.tareKg) setTare(String(weights.tareKg));
        if (r.ticketNumber) setTicket(r.ticketNumber);
        if (r.materialCode && isMaterialCode(r.materialCode)) setMaterial(r.materialCode);
        const site = matchScaleSite(r.scaleName, scaleSites);
        if (site) setScaleId(site.id);
        if (!load && r.weighedAt) setUnloadedAt(localInput(r.weighedAt));
      } else if (r) {
        /* Под заказом веса не меняются — прочитанное только сверяется с записью водителя. */
        setReading(r);
      }
    } catch {
      setPhotoState('error');
    }
  }

  const num = (value: string) => {
    const n = Number.parseInt(value.replace(/\s/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  };
  const warnings = ticketWarnings({
    grossKg: num(gross),
    tareKg: num(tare),
    ticketNo: ticket.trim() || null,
    scaleSiteId: scaleId || null,
    reading,
    duplicates,
    expectedPlates,
    limitKg,
    comboTareKg,
  });
  /* Под заказом прочитанное только показывается рядом с записью водителя: веса не трогаем. */
  const readWeights = orderJob && reading ? formWeights(reading) : null;

  const status =
    photoState === 'reading'
      ? w.reading
      : photoState === 'READ'
        ? w.read
        : photoState === 'NOT_CONFIGURED'
          ? w.notConfigured
          : photoState === 'FAILED'
            ? w.failed
            : photoState === 'error'
              ? t.error.generic
              : null;

  return (
    <>
      <Button size="sm" variant={load ? 'ghost' : 'default'} onClick={() => setOpen(true)}>
        {load ? w.attachTicket : w.addFromTicket}
      </Button>
      <Modal open={open} onClose={close} title={load ? w.modalTitle : w.addFromTicket}>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="job_id" value={jobId} />
          <input type="hidden" name="day_id" value={dayId} />
          <input type="hidden" name="load_id" value={load?.id ?? ''} />
          <input type="hidden" name="weigh_ticket_id" value={ticketId ?? ''} />
          <input type="hidden" name="unloaded_at" value={unloadedAt && Number.isFinite(Date.parse(unloadedAt)) ? new Date(unloadedAt).toISOString() : ''} />

          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div className="flex items-center gap-3">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element -- выбранный файл, ещё не на сервере
              <img src={preview} alt="" className="size-16 shrink-0 rounded-control border border-line object-cover" />
            )}
            <Button type="button" onClick={() => file.current?.click()} disabled={photoState === 'reading'}>
              {preview ? w.photoRetake : w.chooseFile}
            </Button>
          </div>
          {status ? (
            <p className={photoState === 'READ' ? 'text-[13px] text-ok' : 'text-[13px] text-warn'} aria-live="polite">
              {status}
            </p>
          ) : (
            <p className="text-xs text-ink-faint">{w.photoHint}</p>
          )}

          {orderJob && <p className="text-[13px] text-ink-muted">{w.orderJobNote}</p>}

          <fieldset disabled={orderJob} className="grid gap-3 sm:grid-cols-2">
            <Field label={s.material}>
              {(p) => (
                <Select {...p} name="material_code" value={material} onChange={(e) => setMaterial(e.target.value)}>
                  {MATERIALS.map((m) => (
                    <option key={m.code} value={m.code}>
                      {s.materials[m.code]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={s.scale}>
              {(p) => (
                <Select {...p} name="scale_site_id" value={scaleId} onChange={(e) => setScaleId(e.target.value)}>
                  <option value="">{s.scaleNone}</option>
                  {scaleSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                      {site.city ? `, ${site.city}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={s.gross}>
              {(p) => <InputMono {...p} name="gross_kg" inputMode="numeric" value={gross} onChange={(e) => setGross(e.target.value)} />}
            </Field>
            <Field label={s.tare}>
              {(p) => <InputMono {...p} name="tare_kg" inputMode="numeric" value={tare} onChange={(e) => setTare(e.target.value)} />}
            </Field>
            <Field label={s.ticket}>
              {(p) => <InputMono {...p} name="ticket_no" value={ticket} onChange={(e) => setTicket(e.target.value)} maxLength={60} />}
            </Field>
            {!load && (
              <Field label={w.unloadedAt}>
                {(p) => <InputMono {...p} type="datetime-local" value={unloadedAt} onChange={(e) => setUnloadedAt(e.target.value)} />}
              </Field>
            )}
          </fieldset>

          {readWeights && (readWeights.grossKg || readWeights.tareKg) && (
            <p className="text-[13px]">
              {w.view}: {w.fields.gross} <span className="font-mono">{readWeights.grossKg ?? '—'}</span> kg · {w.fields.tare}{' '}
              <span className="font-mono">{readWeights.tareKg ?? '—'}</span> kg
            </p>
          )}
          <WeighTicketWarnings
            warnings={warnings}
            onFix={orderJob ? undefined : (field, kg) => (field === 'gross' ? setGross(String(kg)) : setTare(String(kg)))}
          />

          {state.error && <p className="text-[13px] text-danger">{state.error}</p>}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              {t.action.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={pending || photoState === 'reading' || (orderJob && !ticketId)}
            >
              {orderJob ? w.attachOnly : warnings.length > 0 ? w.confirmAnyway : w.save}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
