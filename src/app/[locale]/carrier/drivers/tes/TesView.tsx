'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { Button, Card, CardBody, EmptyState, Field, Input, InputMono, Textarea } from '@/components/ui';
import {
  copyTesTemplateAction,
  deleteTesAction,
  saveTesAction,
  type FormState,
} from '@/lib/drivers/actions';
import { useI18n } from '@/lib/i18n/provider';
import type { TesRuleSet } from '@/types/db';

const initial: FormState = { error: null, done: false };

/**
 * Наборы правил TES.
 *
 * Числа вводит перевозчик из текста своего договора — платформа их не
 * подставляет. Шаблоны оператора, если они есть, копируются к себе и
 * дальше правятся как свои: договор у каждого может отличаться.
 */
export function TesView({ own, templates }: { own: TesRuleSet[]; templates: TesRuleSet[] }) {
  const { t, f, locale } = useI18n();
  const [editing, setEditing] = useState<TesRuleSet | null | 'new'>(null);
  const close = useCallback(() => setEditing(null), []);

  const pct = (bps: number) => `${f.decimal(bps / 100, 0)} %`;
  const span = (a: string | null, b: string | null) => (a && b ? `${a.slice(0, 5)}–${b.slice(0, 5)}` : '—');

  const describe = (s: TesRuleSet) =>
    [
      `${f.eur(s.base_hourly_cents)} / h`,
      `${f.decimal(s.daily_regular_minutes / 60, 1)} h`,
      `${t.workReport.colOvertime} ${pct(s.overtime1_bps)} / ${pct(s.overtime2_bps)}`,
      `${t.workReport.colEvening} ${span(s.evening_start, s.evening_end)} ${f.eur(s.evening_cents)}`,
      `${t.workReport.colNight} ${span(s.night_start, s.night_end)} ${f.eur(s.night_cents)}`,
      `${t.workReport.colSaturday} ${pct(s.saturday_bps)}`,
      `${t.workReport.colSunday} ${pct(s.sunday_bps)}`,
    ].join(' · ');

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink-faint">{t.tes.own}</h2>
          {editing === null && (
            <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
              {t.tes.add}
            </Button>
          )}
        </div>

        {editing !== null && (
          <div className="mb-4">
            <TesForm set={editing === 'new' ? null : editing} onClose={close} />
          </div>
        )}

        {own.length === 0 && editing === null ? (
          <EmptyState title={t.tes.none} />
        ) : (
          <div className="flex flex-col gap-2">
            {own.map((s) => (
              <Card key={s.id}>
                <CardBody className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">
                      {s.name} · {f.date(`${s.valid_from}T12:00:00Z`)}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">{describe(s)}</p>
                    {s.note && <p className="mt-1 text-xs text-ink-dim">{s.note}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => setEditing(s)}>
                      {t.drivers.edit}
                    </Button>
                    <DeleteTes id={s.id} />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      {templates.length > 0 && (
        <section>
          <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
            {t.tes.templates}
          </h2>
          <div className="flex flex-col gap-2">
            {templates.map((s) => (
              <Card key={s.id}>
                <CardBody className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">
                      {s.name} · {f.date(`${s.valid_from}T12:00:00Z`)}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">{describe(s)}</p>
                  </div>
                  <form action={copyTesTemplateAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={s.id} />
                    <Button type="submit" size="sm">
                      {t.tes.copy}
                    </Button>
                  </form>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DeleteTes({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(deleteTesAction, initial);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="danger" disabled={pending}>
        {t.tes.delete}
      </Button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

function TesForm({ set, onClose }: { set: TesRuleSet | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(saveTesAction, initial);

  useEffect(() => {
    if (state.done) onClose();
  }, [state.done, onClose]);

  /* Центы и базисные пункты — в евро и проценты, как их пишут в договоре. */
  const eur = (cents: number | undefined) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','));
  const pct = (bps: number | undefined) => (bps == null ? '' : String(bps / 100).replace('.', ','));
  const hrs = (min: number | undefined) => (min == null ? '' : String(min / 60).replace('.', ','));

  return (
    <Card stripe="info">
      <CardBody>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          {set && <input type="hidden" name="id" value={set.id} />}

          <Field label={t.tes.name} required>
            {(p) => <Input {...p} name="name" required defaultValue={set?.name ?? ''} placeholder="Kuljetusalan TES" />}
          </Field>
          <Field label={t.tes.validFrom} required>
            {(p) => <Input {...p} type="date" name="valid_from" required defaultValue={set?.valid_from ?? ''} />}
          </Field>

          <Field label={t.tes.base} required>
            {(p) => (
              <InputMono {...p} name="base_hourly" required inputMode="decimal" defaultValue={eur(set?.base_hourly_cents)} />
            )}
          </Field>
          <Field label={t.tes.regular} required>
            {(p) => (
              <InputMono
                {...p}
                name="daily_regular_hours"
                required
                inputMode="decimal"
                defaultValue={hrs(set?.daily_regular_minutes ?? 480)}
              />
            )}
          </Field>

          <Field label={t.tes.ot1Hours} required>
            {(p) => (
              <InputMono
                {...p}
                name="overtime1_hours"
                required
                inputMode="decimal"
                defaultValue={hrs(set?.overtime1_minutes ?? 120)}
              />
            )}
          </Field>
          <Field label={t.tes.ot1}>
            {(p) => <InputMono {...p} name="overtime1_pct" inputMode="decimal" defaultValue={pct(set?.overtime1_bps)} />}
          </Field>
          <Field label={t.tes.ot2}>
            {(p) => <InputMono {...p} name="overtime2_pct" inputMode="decimal" defaultValue={pct(set?.overtime2_bps)} />}
          </Field>
          <div />

          <WindowFields
            label={t.tes.evening}
            prefix="evening"
            start={set?.evening_start ?? ''}
            end={set?.evening_end ?? ''}
            cents={eur(set?.evening_cents)}
          />
          <WindowFields
            label={t.tes.night}
            prefix="night"
            start={set?.night_start ?? ''}
            end={set?.night_end ?? ''}
            cents={eur(set?.night_cents)}
          />

          <Field label={t.tes.saturday}>
            {(p) => <InputMono {...p} name="saturday_pct" inputMode="decimal" defaultValue={pct(set?.saturday_bps)} />}
          </Field>
          <Field label={t.tes.sunday}>
            {(p) => <InputMono {...p} name="sunday_pct" inputMode="decimal" defaultValue={pct(set?.sunday_bps)} />}
          </Field>

          <Field label={t.tes.note} className="sm:col-span-2">
            {(p) => <Textarea {...p} name="note" rows={2} maxLength={1000} defaultValue={set?.note ?? ''} />}
          </Field>

          {state.error && (
            <p role="alert" className="text-[13px] text-danger sm:col-span-2">
              {state.error}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" onClick={onClose} className="flex-1">
              {t.action.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={pending} className="flex-[2]">
              {t.tes.save}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/** Окно доплаты: с, по и сумма за час. Окно через полночь (22–06) допустимо. */
function WindowFields({
  label,
  prefix,
  start,
  end,
  cents,
}: {
  label: string;
  prefix: string;
  start: string;
  end: string;
  cents: string;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="grid grid-cols-3 gap-2 sm:col-span-2">
      <legend className="label-micro mb-1.5">{label}</legend>
      <Field label={t.tes.from}>
        {(p) => <Input {...p} type="time" name={`${prefix}_start`} defaultValue={start.slice(0, 5)} />}
      </Field>
      <Field label={t.tes.to}>
        {(p) => <Input {...p} type="time" name={`${prefix}_end`} defaultValue={end.slice(0, 5)} />}
      </Field>
      <Field label={t.tes.perHour}>
        {(p) => <InputMono {...p} name={prefix} inputMode="decimal" defaultValue={cents} />}
      </Field>
    </fieldset>
  );
}
