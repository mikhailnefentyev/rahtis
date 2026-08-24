'use client';

import { useActionState } from 'react';
import { Button, Card, CardBody, Field, Input, Textarea } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { submitSupportAction, type SupportState } from '@/lib/support/actions';

const initial: SupportState = { error: null, done: false };

/**
 * Вопрос оператору из кабинета.
 *
 * Стоит внизу кабинета, а не отдельной страницей: вопрос возникает,
 * когда человек уже смотрит на свои рейсы, и уводить его на другой
 * экран, чтобы он сформулировал вопрос там, значит потерять половину
 * вопросов по дороге.
 */
export function SupportForm({ locale }: { locale: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(submitSupportAction, initial);

  return (
    <Card className="mt-4">
      <CardBody className="flex flex-col gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{t.support.title}</h2>
          <p className="mt-1 text-[13px] text-ink-muted">{t.support.hint}</p>
        </div>

        {state.done ? (
          <p
            role="status"
            className="rounded-control border border-ok/35 bg-ok/10 px-3 py-2 text-[13px] text-ok"
          >
            {t.support.sent}
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="locale" value={locale} />

            <Field label={t.support.subject} required>
              {(p) => (
                <Input
                  {...p}
                  name="subject"
                  required
                  minLength={3}
                  maxLength={200}
                  placeholder={t.support.subjectPlaceholder}
                />
              )}
            </Field>

            <Field label={t.support.body} required>
              {(p) => (
                <Textarea
                  {...p}
                  name="body"
                  required
                  minLength={3}
                  maxLength={4000}
                  rows={4}
                  placeholder={t.support.bodyPlaceholder}
                />
              )}
            </Field>

            {state.error && (
              <p
                role="alert"
                className="rounded-control border border-danger/35 bg-danger/10 px-3 py-2 text-[13px] text-danger"
              >
                {state.error}
              </p>
            )}

            <Button type="submit" size="md" className="self-start" disabled={pending}>
              {pending ? t.support.sending : t.support.submit}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
