'use client';

import { useActionState, useState } from 'react';
import { Button, Card, CardBody, Field, Input, InputMono } from '@/components/ui';
import { submitApplicationAction, type ApplyState } from '@/lib/companies/actions';
import { isValidBusinessId } from '@/lib/format';
import { useI18n } from '@/lib/i18n/provider';
import type { CompanyRole } from '@/types/db';

const initial: ApplyState = { error: null, done: false };

export function ApplyForm() {
  const { t, m } = useI18n();
  const { locale } = useI18n();
  const [state, formAction, pending] = useActionState(submitApplicationAction, initial);

  const [kind, setKind] = useState<CompanyRole>('CARRIER');
  const [name, setName] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [email, setEmail] = useState('');

  if (state.done) {
    return (
      <Card stripe="ok">
        <CardBody className="p-6">
          <h1 className="text-[15px] font-semibold tracking-tight">{t.apply.sentTitle}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            {m('signup.submitted', { company: name, businessId, email })}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
            {kind === 'CARRIER' ? t.apply.carrierNote : t.apply.shipperNote}
          </p>
        </CardBody>
      </Card>
    );
  }

  /* Формат Y-tunnus показываем до отправки — сервер проверит ещё раз. */
  const businessIdError =
    businessId.length > 0 && !isValidBusinessId(businessId) ? t.validation.businessId : undefined;

  return (
    <Card>
      <CardBody className="p-6">
        <h1 className="text-[15px] font-semibold tracking-tight">{t.apply.title}</h1>
        <p className="mt-1.5 mb-5 text-[13px] leading-relaxed text-ink-muted">
          {t.apply.subtitle}
        </p>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="kind" value={kind} />

          <div
            role="radiogroup"
            aria-label={t.apply.title}
            className="grid grid-cols-2 gap-1 rounded-control border border-line bg-sunken p-1"
          >
            {(
              [
                ['CARRIER', t.apply.iAmCarrier],
                ['SHIPPER', t.apply.iAmShipper],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => setKind(value)}
                className={
                  kind === value
                    ? 'cursor-pointer rounded-[4px] bg-accent px-3 py-2 text-[13px] font-semibold text-accent-ink'
                    : 'cursor-pointer rounded-[4px] px-3 py-2 text-[13px] font-semibold text-ink-faint transition-colors duration-150 hover:text-ink'
                }
              >
                {label}
              </button>
            ))}
          </div>

          <Field label={t.company.name} required>
            {(p) => (
              <Input
                {...p}
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nieminen Kuljetus Oy"
                required
              />
            )}
          </Field>

          <Field label={t.company.businessId} required error={businessIdError}>
            {(p) => (
              <InputMono
                {...p}
                name="business_id"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                placeholder="1234567-8"
                required
              />
            )}
          </Field>

          <Field label={t.company.email} required hint={t.company.emailHint}>
            {(p) => (
              <Input
                {...p}
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops@company.fi"
                required
              />
            )}
          </Field>

          <p className="rounded-control border border-line bg-sunken px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
            {kind === 'CARRIER' ? t.apply.carrierNote : t.apply.shipperNote}
          </p>

          {state.error && (
            <p
              role="alert"
              className="rounded-control border border-danger/35 bg-danger/10 px-3 py-2 text-[13px] text-danger"
            >
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={pending || Boolean(businessIdError)}
          >
            {pending ? t.apply.submitting : t.apply.submit}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
