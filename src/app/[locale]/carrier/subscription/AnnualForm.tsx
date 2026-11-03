'use client';

import { useActionState, useMemo, useState } from 'react';
import { Button, Card, CardBody, Field, Input } from '@/components/ui';
import { ANNUAL_MIN_VEHICLES, annualPlanCents, ON_REQUEST_FROM, subscriptionLadderCents } from '@/lib/config';
import { useI18n } from '@/lib/i18n/provider';
import { buyAnnualPlanAction, type AnnualState } from '@/lib/subscription/actions';

const initial: AnnualState = { error: null, done: false };

/** Год вперёд: число машин → цена года, в месяц и сколько это экономит против помесячной оплаты. */
export function AnnualForm({ suggested, startsOn }: { suggested: number; startsOn: string }) {
  const { t, locale } = useI18n();
  const s = t.subscription;
  const [vehicles, setVehicles] = useState(String(Math.max(ANNUAL_MIN_VEHICLES, suggested)));
  const [state, action, pending] = useActionState(buyAnnualPlanAction, initial);

  const n = Number(vehicles);
  const valid = Number.isInteger(n) && n >= ANNUAL_MIN_VEHICLES && n < ON_REQUEST_FROM;
  const eur = useMemo(() => new Intl.NumberFormat(t.meta.intl, { style: 'currency', currency: 'EUR' }), [t.meta.intl]);
  const year = valid ? annualPlanCents(n) : 0;
  const monthly = valid ? subscriptionLadderCents(n) * 12 : 0;

  return (
    <Card>
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          <h3 className="text-[13px] font-semibold">{s.annualTitle}</h3>
          <p className="text-[12px] leading-relaxed text-ink-muted">{s.annualHint.replace('{date}', startsOn)}</p>
          <div className="flex flex-wrap items-end gap-4">
            <Field label={s.annualVehicles}>
              {(p) => (
                <Input {...p} name="vehicles" inputMode="numeric" value={vehicles} onChange={(e) => setVehicles(e.target.value.replace(/\D/g, '').slice(0, 3))} className="w-28" />
              )}
            </Field>
            {valid && (
              <div className="text-[13px]">
                <p>
                  <span className="text-ink-muted">{s.annualPrice}: </span>
                  <strong className="font-mono">{eur.format(year / 100)}</strong>
                  <span className="text-ink-muted"> ({eur.format(year / 1200)} / {s.perMonth})</span>
                </p>
                <p className="text-[12px] text-ok">
                  {s.annualSaving.replace('{amount}', eur.format((monthly - year) / 100))}
                </p>
              </div>
            )}
          </div>
          <label className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
            <input type="checkbox" name="confirm" className="mt-0.5" />
            <span>{s.annualConfirm}</span>
          </label>
          {n >= ON_REQUEST_FROM && <p className="text-xs text-ink-muted">{s.annualLarge}</p>}
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          {state.done && <p className="text-xs text-ok">{s.annualDone}</p>}
          <div>
            <Button type="submit" variant="primary" disabled={pending || !valid}>
              {s.annualBuy}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
