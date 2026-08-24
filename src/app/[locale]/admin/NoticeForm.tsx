'use client';

import { useActionState } from 'react';
import { Button, Card, CardBody, Field, Input, Select, Textarea } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { sendNoticeAction, type NoticeState } from '@/lib/support/actions';

const initial: NoticeState = { error: null, done: false };

/** Произвольное уведомление компании: в кабинет обязательно, письмом заодно. */
export function NoticeForm({
  locale,
  companies,
}: {
  locale: string;
  companies: { id: string; name: string; kind: 'CARRIER' | 'SHIPPER' | 'ADMIN' }[];
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(sendNoticeAction, initial);

  if (companies.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardBody className="flex flex-col gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{t.adminMessage.title}</h2>
          <p className="mt-1 text-[13px] text-ink-muted">{t.adminMessage.hint}</p>
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.adminMessage.company} required>
              {(p) => (
                <Select {...p} name="company_id" required defaultValue="">
                  <option value="" disabled>
                    —
                  </option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} · {t.role[company.kind]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={t.adminMessage.subject} required>
              {(p) => <Input {...p} name="subject" required minLength={3} maxLength={200} />}
            </Field>
          </div>

          <Field label={t.adminMessage.body} required>
            {(p) => <Textarea {...p} name="body" required minLength={3} maxLength={4000} rows={3} />}
          </Field>

          {state.error && (
            <p
              role="alert"
              className="rounded-control border border-danger/35 bg-danger/10 px-3 py-2 text-[13px] text-danger"
            >
              {state.error}
            </p>
          )}

          {state.done && (
            <p
              role="status"
              className="rounded-control border border-ok/35 bg-ok/10 px-3 py-2 text-[13px] text-ok"
            >
              {t.adminMessage.sent}
            </p>
          )}

          <Button type="submit" variant="primary" size="md" className="self-start" disabled={pending}>
            {pending ? t.adminMessage.sending : t.adminMessage.submit}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
