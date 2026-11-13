'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { Badge, Button, Card, CardBody, Field, Input, Plate } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { endDowntimeAction, scheduleServiceAction, type MaintenanceFormState } from '@/lib/maintenance/actions';
import type { Downtime } from '@/lib/maintenance/load';

/**
 * Машина вне работы: причина, с какого дня, до какого. «Palauta ajoon»
 * снимает ограничение — машина снова выходит на рейсы. Для дефекта и
 * просроченного katsastus перед снятием — одна строка предупреждения и
 * необязательная пометка «почему»: запрет поставлен из-за безопасности,
 * снимать его стоит осознанно, но решает перевозчик.
 */
export function DowntimeCard({ downtime, plate }: { downtime: Downtime; plate?: string }) {
  const { t, f, locale } = useI18n();
  const s = t.maintenance.downtime;
  const [confirm, setConfirm] = useState(false);
  const safety = downtime.reason !== 'SERVICE';
  const period = `${f.date(`${downtime.starts_on}T12:00:00Z`)}${downtime.ends_on ? ` – ${f.date(`${downtime.ends_on}T12:00:00Z`)}` : ` – ${s.untilResolved}`}`;

  return (
    <Card stripe={downtime.current ? 'danger' : 'info'}>
      <CardBody className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {plate && (
            <Link href={`/${locale}/carrier/maintenance/${downtime.vehicle_id ?? downtime.trailer_id}`} className="hover:underline">
              <Plate>{plate}</Plate>
            </Link>
          )}
          <Badge tone={downtime.current ? 'danger' : 'info'}>{downtime.current ? s.outNow : s.planned}</Badge>
          <span className="text-[13px] font-semibold">{s.reasons[downtime.reason as keyof typeof s.reasons]}</span>
        </div>
        <p className="text-[13px]">
          {period}
          {downtime.reason === 'INSPECTION' && downtime.due_on && ` · ${s.dueWas} ${f.date(`${downtime.due_on}T12:00:00Z`)}`}
        </p>
        {downtime.note && <p className="text-[12px] text-ink-muted">{downtime.note}</p>}
        {/* Бессрочно — машина не выходит на рейсы совсем; с датами — нельзя взять заказ на эти дни. */}
        <p className="text-[12px] text-ink-muted">{downtime.blocking ? (downtime.current ? s.effect : s.effectFrom) : s.effectDates}</p>
        {/* Рейсы, уже назначенные на эти дни, — сами не снимаются: решает перевозчик. */}
        {downtime.orders.length > 0 && (
          <div className="rounded-control border border-warn/40 bg-warn/10 px-3 py-2 text-[13px]">
            <p className="font-semibold text-warn">{s.ordersTitle}</p>
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {downtime.orders.map((o) => (
                <li key={o.order_id}>
                  <Link href={`/${locale}/carrier`} className="font-mono hover:underline">
                    {o.ref}
                  </Link>{' '}
                  <span className="text-ink-muted">{f.date(`${o.first_day}T12:00:00Z`)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[12px] text-ink-muted">{s.ordersHint}</p>
          </div>
        )}

        {!confirm ? (
          <div>
            <Button size="sm" variant={downtime.current ? 'default' : 'ghost'} onClick={() => setConfirm(true)}>
              {downtime.current ? s.lift : s.cancel}
            </Button>
          </div>
        ) : (
          <form action={endDowntimeAction} className="flex flex-col gap-2 rounded-control bg-raised px-3 py-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={downtime.id} />
            {safety && <p className="text-[13px] text-warn">{downtime.reason === 'DEFECT' ? s.liftWarningDefect : s.liftWarningInspection}</p>}
            <Field label={s.liftNote}>{(p) => <Input {...p} name="note" maxLength={300} />}</Field>
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="primary">
                {downtime.current ? s.liftConfirm : s.cancel}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                {t.maintenance.form.cancel}
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

/** Сервис по датам: первый и последний день вне работы, пометка (мастерская, что делают). */
export function ServiceForm({
  assetId,
  trailer,
  today,
  onClose,
}: {
  assetId: string;
  trailer: boolean;
  today: string;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const s = t.maintenance;
  const [state, action, pending] = useActionState(scheduleServiceAction, { error: null, done: false } as MaintenanceFormState);
  useEffect(() => {
    if (state.done) onClose();
  }, [state, onClose]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name={trailer ? 'trailer_id' : 'vehicle_id'} value={assetId} />
      <h3 className="text-[13px] font-semibold">{s.downtime.formTitle}</h3>
      <p className="text-[12px] text-ink-muted">{s.downtime.formHint}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={s.downtime.startsOn} required>
          {(p) => <Input {...p} name="starts_on" type="date" required defaultValue={today} min={today} />}
        </Field>
        <Field label={s.downtime.endsOn} hint={s.downtime.endsHint}>
          {(p) => <Input {...p} name="ends_on" type="date" min={today} />}
        </Field>
        <Field label={s.form.note}>{(p) => <Input {...p} name="note" maxLength={300} placeholder={s.downtime.notePlaceholder} />}</Field>
      </div>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {s.downtime.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {s.form.cancel}
        </Button>
      </div>
    </form>
  );
}
