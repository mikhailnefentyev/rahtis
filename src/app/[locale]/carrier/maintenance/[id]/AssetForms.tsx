'use client';

import { useActionState, useEffect, useState } from 'react';
import { Badge, Button, Card, CardBody, Field, Input, Select, Textarea } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import {
  deleteMaintenanceItemAction,
  recordMaintenanceAction,
  reportDefectAction,
  saveMaintenanceItemAction,
  type MaintenanceFormState,
} from '@/lib/maintenance/actions';
import type { ItemWithStatus } from '@/lib/maintenance/load';
import { DEFAULT_MONTHS, DEFECT_AREAS, MAINTENANCE_KINDS, TRAILER_KINDS, type MaintenanceKind } from '@/lib/maintenance/status';
import { CURRENCIES, type Currency } from '@/lib/money/currency';
import { dueParts, dueTone, intervalText, itemLabel } from '../format';

const initial: MaintenanceFormState = { error: null, done: false };

type Option = { id: string; label: string };
type AssetRef = { id: string; type: 'VEHICLE' | 'TRAILER'; odometer: number | null };

/* ── Пункт плана: статус, «сделано», правка ─────────────────────── */

export function PlanItemCard({
  item,
  trailer,
  odometer,
  openDefects,
  today,
  costsOpen,
}: {
  item: ItemWithStatus;
  trailer: boolean;
  odometer: number | null;
  openDefects: Option[];
  today: string;
  costsOpen: boolean;
}) {
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const s = t.maintenance;
  const [mode, setMode] = useState<'view' | 'done' | 'edit'>('view');
  const interval = intervalText(i18n, item, f);
  const close = () => setMode('view');

  return (
    <Card stripe={item.status.state === 'NONE' ? undefined : dueTone[item.status.state]}>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold">{itemLabel(i18n, item)}</span>
              <Badge tone={dueTone[item.status.state]}>{s.state[item.status.state]}</Badge>
            </div>
            <p className="mt-1 text-[13px]">{dueParts(i18n, item, item.status).join(' / ') || '—'}</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {[
                interval,
                item.last_done_on
                  ? `${s.lastDone}: ${f.date(`${item.last_done_on}T12:00:00Z`)}${item.last_done_km != null ? `, ${f.number(item.last_done_km)} km` : ''}`
                  : null,
                item.note,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {mode === 'view' && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={() => setMode('done')}>
                {s.done.button}
              </Button>
              <Button size="sm" onClick={() => setMode('edit')}>
                {s.form.edit}
              </Button>
              <form action={deleteMaintenanceItemAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={item.id} />
                <Button type="submit" size="sm" variant="ghost">
                  {s.form.delete}
                </Button>
              </form>
            </div>
          )}
        </div>
        {mode === 'done' && (
          <DoneForm
            asset={{ id: item.asset.id, type: trailer ? 'TRAILER' : 'VEHICLE', odometer }}
            item={item}
            openDefects={openDefects}
            today={today}
            costsOpen={costsOpen}
            onClose={close}
          />
        )}
        {mode === 'edit' && <ItemForm asset={{ id: item.asset.id, type: trailer ? 'TRAILER' : 'VEHICLE', odometer }} item={item} onClose={close} />}
      </CardBody>
    </Card>
  );
}

/* ── Кнопки под планом: новый пункт, ремонт, дефект ─────────────── */

export function AssetActions({
  asset,
  openDefects,
  today,
  costsOpen,
}: {
  asset: AssetRef;
  openDefects: Option[];
  today: string;
  costsOpen: boolean;
}) {
  const { t } = useI18n();
  const s = t.maintenance;
  const [mode, setMode] = useState<'none' | 'item' | 'repair' | 'defect'>('none');
  const close = () => setMode('none');

  return (
    <section>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={mode === 'item' ? 'primary' : 'default'} onClick={() => setMode(mode === 'item' ? 'none' : 'item')}>
          {s.addItem}
        </Button>
        <Button size="sm" variant={mode === 'repair' ? 'primary' : 'default'} onClick={() => setMode(mode === 'repair' ? 'none' : 'repair')}>
          {s.repair.button}
        </Button>
        <Button size="sm" variant={mode === 'defect' ? 'primary' : 'default'} onClick={() => setMode(mode === 'defect' ? 'none' : 'defect')}>
          {s.defects.report}
        </Button>
      </div>
      {mode !== 'none' && (
        <Card className="mt-3">
          <CardBody>
            {mode === 'item' && <ItemForm asset={asset} item={null} onClose={close} />}
            {mode === 'repair' && <DoneForm asset={asset} item={null} openDefects={openDefects} today={today} costsOpen={costsOpen} onClose={close} />}
            {mode === 'defect' && <DefectForm asset={asset} onClose={close} />}
          </CardBody>
        </Card>
      )}
    </section>
  );
}

/** Закрыть форму после удачного сохранения. */
function useCloseOnDone(state: MaintenanceFormState, onClose: () => void) {
  useEffect(() => {
    if (state.done) onClose();
  }, [state, onClose]);
}

function AssetFields({ asset }: { asset: AssetRef }) {
  const { locale } = useI18n();
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      {asset.type === 'TRAILER' ? (
        <input type="hidden" name="trailer_id" value={asset.id} />
      ) : (
        <input type="hidden" name="vehicle_id" value={asset.id} />
      )}
    </>
  );
}

/* ── Пункт плана: новый или правка ──────────────────────────────── */

function ItemForm({ asset, item, onClose }: { asset: AssetRef; item: ItemWithStatus | null; onClose: () => void }) {
  const { t } = useI18n();
  const s = t.maintenance;
  const [state, action, pending] = useActionState(saveMaintenanceItemAction, initial);
  useCloseOnDone(state, onClose);
  const trailer = asset.type === 'TRAILER';
  const kinds = trailer ? TRAILER_KINDS : MAINTENANCE_KINDS;
  const [kind, setKind] = useState<MaintenanceKind>((item?.kind as MaintenanceKind) ?? (trailer ? 'INSPECTION' : 'SERVICE'));
  /* Интервал по умолчанию — только для нового пункта и только по правилу (katsastus, тахограф). */
  const [months, setMonths] = useState(item ? String(item.interval_months ?? '') : String(DEFAULT_MONTHS[kind] ?? ''));
  const hint = (s.kindHints as Partial<Record<MaintenanceKind, string>>)[kind];

  return (
    <form action={action} className="flex flex-col gap-3">
      <AssetFields asset={asset} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <h3 className="text-[13px] font-semibold">{item ? s.form.editTitle : s.form.newTitle}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={s.form.kind} required hint={hint}>
          {(p) => (
            <Select
              {...p}
              name="kind"
              value={kind}
              onChange={(e) => {
                const next = e.target.value as MaintenanceKind;
                setKind(next);
                if (!item) setMonths(String(DEFAULT_MONTHS[next] ?? ''));
              }}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {s.kinds[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={kind === 'OTHER' ? s.form.title : s.form.titleOptional} required={kind === 'OTHER'}>
          {(p) => <Input {...p} name="title" maxLength={80} defaultValue={item?.title ?? ''} placeholder={s.form.titlePlaceholder} />}
        </Field>
        <Field label={s.form.intervalMonths}>
          {(p) => <Input {...p} name="interval_months" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />}
        </Field>
        {!trailer && (
          <Field label={s.form.intervalKm}>
            {(p) => <Input {...p} name="interval_km" inputMode="numeric" defaultValue={item?.interval_km ?? ''} placeholder="90 000" />}
          </Field>
        )}
        <Field label={s.form.lastDoneOn}>
          {(p) => <Input {...p} name="last_done_on" type="date" defaultValue={item?.last_done_on ?? ''} />}
        </Field>
        {!trailer && (
          <Field label={s.form.lastDoneKm}>
            {(p) => <Input {...p} name="last_done_km" inputMode="numeric" defaultValue={item?.last_done_km ?? ''} />}
          </Field>
        )}
        <Field label={s.form.nextDueOn} hint={s.form.nextHint}>
          {(p) => <Input {...p} name="next_due_on" type="date" defaultValue={item?.next_due_on ?? ''} />}
        </Field>
        {!trailer && (
          <Field label={s.form.nextDueKm}>
            {(p) => <Input {...p} name="next_due_km" inputMode="numeric" defaultValue={item?.next_due_km ?? ''} />}
          </Field>
        )}
      </div>
      <Field label={s.form.note}>{(p) => <Input {...p} name="note" maxLength={300} defaultValue={item?.note ?? ''} />}</Field>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {s.form.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {s.form.cancel}
        </Button>
      </div>
    </form>
  );
}

/* ── Сделано: строка сервисной книжки (по пункту или разовый ремонт) ── */

function DoneForm({
  asset,
  item,
  openDefects,
  today,
  costsOpen,
  onClose,
}: {
  asset: AssetRef;
  item: ItemWithStatus | null;
  openDefects: Option[];
  today: string;
  costsOpen: boolean;
  onClose: () => void;
}) {
  const i18n = useI18n();
  const { t, f } = i18n;
  const s = t.maintenance;
  const [state, action, pending] = useActionState(recordMaintenanceAction, initial);
  useCloseOnDone(state, onClose);
  const [currency, setCurrency] = useState<Currency>(f.currency);
  const trailer = asset.type === 'TRAILER';
  const needsKm = !!item?.interval_km && !trailer;
  const repairKinds = (trailer ? TRAILER_KINDS : MAINTENANCE_KINDS).filter((k) => k !== 'OTHER');

  return (
    <form action={action} className="flex flex-col gap-3">
      <AssetFields asset={asset} />
      {item && <input type="hidden" name="item_id" value={item.id} />}
      {item && <input type="hidden" name="label" value={itemLabel(i18n, item)} />}
      {needsKm && <input type="hidden" name="needs_km" value="1" />}
      <h3 className="text-[13px] font-semibold">{item ? `${s.done.title}: ${s.kinds[item.kind as MaintenanceKind] ?? ''}` : s.repair.title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!item && (
          <>
            <Field label={s.form.kind} required>
              {(p) => (
                <Select {...p} name="kind" defaultValue="REPAIR">
                  <option value="REPAIR">{s.kinds.REPAIR}</option>
                  {repairKinds.map((k) => (
                    <option key={k} value={k}>
                      {s.kinds[k]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={s.repair.what} required>
              {(p) => <Input {...p} name="title" maxLength={80} required placeholder={s.repair.whatPlaceholder} />}
            </Field>
          </>
        )}
        <Field label={s.done.doneOn} required>
          {(p) => <Input {...p} name="done_on" type="date" required defaultValue={today} max={today} />}
        </Field>
        {!trailer && (
          <Field label={s.done.odometer} required={needsKm}>
            {(p) => <Input {...p} name="odometer_km" inputMode="numeric" defaultValue={asset.odometer ?? ''} required={needsKm} />}
          </Field>
        )}
        <Field label={s.done.workshop}>{(p) => <Input {...p} name="workshop" maxLength={120} />}</Field>
        <div className="flex items-end gap-2">
          <Field label={f.label(s.done.amount, currency)} className="flex-1" hint={costsOpen ? s.done.costNote : s.done.costLocked}>
            {(p) => <Input {...p} name="amount" inputMode="decimal" placeholder="0" />}
          </Field>
          <Select
            name="currency"
            value={currency}
            onChange={(ev) => setCurrency(ev.target.value as Currency)}
            aria-label={t.orderForm.currency}
            className="mb-[1.375rem] w-24 font-mono"
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </div>
        {item && (
          <>
            <Field label={s.done.nextOn} hint={s.done.nextHint}>
              {(p) => <Input {...p} name="next_due_on" type="date" />}
            </Field>
            {!trailer && (
              <Field label={s.done.nextKm}>
                {(p) => <Input {...p} name="next_due_km" inputMode="numeric" />}
              </Field>
            )}
          </>
        )}
      </div>
      <Field label={s.done.note}>{(p) => <Textarea {...p} name="note" maxLength={500} rows={2} />}</Field>
      {openDefects.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="label-micro mb-1">{s.done.defects}</legend>
          {openDefects.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="defect_ids" value={d.id} className="size-4" />
              {d.label}
            </label>
          ))}
        </fieldset>
      )}
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {s.done.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {s.form.cancel}
        </Button>
      </div>
    </form>
  );
}

/* ── Дефект из кабинета (механик заметил, водитель позвонил) ────── */

function DefectForm({ asset, onClose }: { asset: AssetRef; onClose: () => void }) {
  const { t } = useI18n();
  const s = t.maintenance;
  const [state, action, pending] = useActionState(reportDefectAction, initial);
  useCloseOnDone(state, onClose);

  return (
    <form action={action} className="flex flex-col gap-3">
      <AssetFields asset={asset} />
      <h3 className="text-[13px] font-semibold">{s.defects.reportTitle}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={s.defects.area} required>
          {(p) => (
            <Select {...p} name="area" defaultValue="OTHER">
              {DEFECT_AREAS.map((a) => (
                <option key={a} value={a}>
                  {s.defects.areas[a]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={s.defects.severity} required>
          {(p) => (
            <Select {...p} name="severity" defaultValue="CAN_DRIVE">
              <option value="CAN_DRIVE">{s.defects.severities.CAN_DRIVE}</option>
              <option value="UNSAFE">{s.defects.severities.UNSAFE}</option>
            </Select>
          )}
        </Field>
        {asset.type === 'VEHICLE' && (
          <Field label={s.done.odometer}>{(p) => <Input {...p} name="odometer_km" inputMode="numeric" />}</Field>
        )}
      </div>
      <Field label={s.defects.description} required>
        {(p) => <Textarea {...p} name="description" maxLength={1000} rows={3} required minLength={3} />}
      </Field>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {s.defects.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {s.form.cancel}
        </Button>
      </div>
    </form>
  );
}
