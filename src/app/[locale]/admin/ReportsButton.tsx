'use client';

import { useActionState } from 'react';
import { Button, Card, CardBody, Field, Input } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { generateReportsAction, type ReportState } from '@/lib/reports/actions';

const initial: ReportState = { error: null, done: null };

/** Ручной выпуск отчётов: та же функция, что позовёт планировщик. */
export function ReportsButton({ locale }: { locale: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(generateReportsAction, initial);

  return (
    <Card className="mt-4">
      <CardBody className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight">{t.report_.generate}</h2>

        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="locale" value={locale} />

          {/* Пусто — прошлая неделя. Дата нужна для перевыпуска задним числом. */}
          <Field label={t.orderForm.date}>
            {(p) => <Input {...p} name="week" type="date" className="w-44" />}
          </Field>

          <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? t.report_.generating : t.report_.generate}
          </Button>
        </form>

        {state.error && (
          <p role="alert" className="text-[13px] text-danger">
            {state.error}
          </p>
        )}
        {state.done && (
          <p role="status" className="text-[13px] text-ok">
            {t.report_.generated} · {state.done}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
