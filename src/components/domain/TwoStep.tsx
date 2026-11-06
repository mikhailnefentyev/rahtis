'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Field, InputMono } from '@/components/ui';
import {
  confirmEnrolAction,
  removeTwoStepAction,
  startEnrolAction,
  stepUpAction,
  type CodeState,
  type EnrolStart,
  type EnrolState,
} from '@/lib/auth/twoStepActions';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';

/*
 * Двухэтапный вход (6.11.2026): поле кода, «подтвердите кодом» перед
 * важным действием и блок подключения на странице своих данных.
 */

/** Шесть цифр: цифровая клавиатура и подсказка браузеру, что это код. Пробел внутри сервер уберёт. */
export function CodeInput({
  onEnter,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { onEnter?: () => void }) {
  return (
    <InputMono
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      required
      placeholder="123456"
      className={cn('max-w-[10rem] text-[15px] tracking-[0.25em]', className)}
      {...props}
      onKeyDown={
        onEnter
          ? (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onEnter();
              }
            }
          : props.onKeyDown
      }
    />
  );
}

/**
 * Код перед важным действием. Без своей <form>: стоит внутри чужой
 * формы, а вложенные формы браузер не допускает. Код верный — onVerified,
 * и форма отправляется заново сама.
 */
export function StepUpPrompt({ onVerified }: { onVerified: () => void }) {
  const { t, locale } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const form = new FormData();
      form.set('locale', locale);
      form.set('code', code);
      const result = await stepUpAction({ error: null, done: false }, form);
      if (result.done) {
        setError(null);
        onVerified();
      } else setError(result.error);
    });

  return (
    <div role="group" aria-label={t.twoStep.stepUpTitle} className="flex flex-col gap-2 rounded-control border border-accent/35 bg-accent/5 px-3 py-3">
      <p className="text-[13px] font-semibold">{t.twoStep.stepUpTitle}</p>
      <p className="text-[13px] text-ink-muted">{t.twoStep.stepUpHint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <CodeInput autoFocus required={false} name="step_up_code" value={code} onChange={(e) => setCode(e.target.value)} onEnter={submit} aria-label={t.twoStep.code} />
        <Button type="button" variant="primary" size="sm" disabled={pending} onClick={submit}>
          {t.twoStep.confirm}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const initialCode: CodeState = { error: null, done: false };
const initialEnrol: EnrolState = { error: null, done: false, next: null };

/**
 * Блок «Kaksivaiheinen kirjautuminen»: включить (QR, ключ, первый код),
 * отключить (свежим кодом) и что делать, если телефон потерян.
 */
export function TwoStepPanel({
  enabled,
  enabledAt,
  required,
  support,
}: {
  enabled: boolean;
  enabledAt: string | null;
  /** Оператор: без двухэтапного входа админка закрыта. */
  required: boolean;
  support: string;
}) {
  const { t, f } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-[15px] font-semibold tracking-tight">{t.twoStep.title}</h2>
        <Badge tone={enabled ? 'ok' : 'neutral'}>{enabled ? t.twoStep.on : t.twoStep.off}</Badge>
      </div>
      <p className="max-w-xl text-[13px] leading-relaxed text-ink-muted">{t.twoStep.intro}</p>
      {required && !enabled && (
        <p role="alert" className="rounded-control border border-warn/35 bg-warn/10 px-3 py-2 text-[13px] text-warn">
          {t.twoStep.adminRequired}
        </p>
      )}

      {enabled ? (
        <>
          {enabledAt && <p className="text-[13px] text-ink-muted">{t.twoStep.enabledSince.replace('{date}', f.date(enabledAt))}</p>}
          <RemoveTwoStep />
        </>
      ) : (
        <Enrol />
      )}

      <p className="text-xs leading-relaxed text-ink-faint">{t.twoStep.lostPhone.replace('{email}', support)}</p>
    </div>
  );
}

function Enrol() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [setup, setSetup] = useState<Extract<EnrolStart, { ok: true }> | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, start] = useTransition();
  const [state, formAction, pending] = useActionState(confirmEnrolAction, initialEnrol);
  const done = useRef(false);

  useEffect(() => {
    if (!state.done || done.current) return;
    done.current = true;
    if (state.next) router.push(state.next);
    else router.refresh();
  }, [state, router]);

  if (!setup) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="primary"
          className="self-start"
          disabled={starting}
          onClick={() =>
            start(async () => {
              const result = await startEnrolAction(locale);
              if (result.ok) {
                setStartError(null);
                setSetup(result);
              } else setStartError(result.error);
            })
          }
        >
          {t.twoStep.start}
        </Button>
        {startError && (
          <p role="alert" className="text-[13px] text-danger">
            {startError}
          </p>
        )}
      </div>
    );
  }

  if (state.done) {
    return (
      <p role="status" className="text-[13px] text-ok">
        {t.twoStep.enabled}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="factor_id" value={setup.factorId} />

      <ol className="flex list-decimal flex-col gap-3 pl-5 text-[13px] leading-relaxed">
        <li>
          {t.twoStep.step1}
          {/* SVG от Supabase адресом data: — next/image для него не нужен. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt={t.twoStep.qrAlt} width={176} height={176} className="mt-2 rounded-control border border-line bg-white p-2" />
          <details className="mt-2">
            <summary className="cursor-pointer text-ink-muted">{t.twoStep.manual}</summary>
            <code className="mt-1 block break-all font-mono text-[13px] select-all">{setup.secret}</code>
          </details>
        </li>
        <li>
          {t.twoStep.step2}
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Field label={t.twoStep.code}>{(p) => <CodeInput {...p} autoFocus />}</Field>
            <Button type="submit" variant="primary" disabled={pending}>
              {t.twoStep.confirm}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
              {t.action.cancel}
            </Button>
          </div>
        </li>
      </ol>

      {state.error && (
        <p role="alert" className="text-[13px] text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

function RemoveTwoStep() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState(removeTwoStepAction, initialCode);

  useEffect(() => {
    if (state.done) router.refresh();
  }, [state.done, router]);

  if (state.done) {
    return (
      <p role="status" className="text-[13px] text-ok">
        {t.twoStep.removed}
      </p>
    );
  }

  if (!asking) {
    return (
      <Button type="button" size="sm" className="self-start" onClick={() => setAsking(true)}>
        {t.twoStep.remove}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-[13px] text-ink-muted">{t.twoStep.removeHint}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t.twoStep.code}>{(p) => <CodeInput {...p} autoFocus />}</Field>
        <Button type="submit" variant="danger" disabled={pending}>
          {t.twoStep.remove}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
          {t.action.cancel}
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-[13px] text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
