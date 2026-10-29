'use client';

import { Button, Card, CardBody, Field, Input } from '@/components/ui';
import { saveEmployerCostAction } from '@/lib/economics/actions';
import { useI18n } from '@/lib/i18n/provider';

/** Надбавка к зарплате водителя на налоги и взносы работодателя, %. */
export function EmployerCostForm({ bps }: { bps: number }) {
  const { t, locale } = useI18n();
  const s = t.economics;
  return (
    <Card className="mt-6 max-w-xl">
      <CardBody>
        <form action={saveEmployerCostAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="locale" value={locale} />
          <Field label={s.employerLabel} hint={s.employerHint}>
            {(p) => <Input {...p} name="employer_cost_pct" inputMode="decimal" defaultValue={String(bps / 100)} className="w-28" />}
          </Field>
          <Button type="submit">{s.save}</Button>
        </form>
      </CardBody>
    </Card>
  );
}
