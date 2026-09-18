'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import {
  commentClaimAction,
  fileClaimAction,
  setClaimStatusAction,
  type ClaimState,
} from '@/lib/claims/actions';
import { useI18n } from '@/lib/i18n/provider';
import type { ClaimKind, ClaimStatus, OrderStop, PartyRole } from '@/types/db';

const KINDS: ClaimKind[] = ['CARGO_DAMAGE', 'SHORTAGE', 'DOWNTIME', 'DEVIATION', 'OTHER'];
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

/**
 * Подача claim из карточки рейса.
 *
 * Свёрнута в кнопку: claim — событие редкое, и форма, раскрытая в
 * каждой карточке выполненного рейса, выглядела бы приглашением спорить.
 * Точки — из самого рейса, чтобы «где случилось» выбиралось, а не
 * вписывалось: по точке claim находит фото этой точки.
 */
export function FileClaim({ orderId, stops }: { orderId: string; stops: OrderStop[] }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, submit, pending] = useActionState<ClaimState, FormData>(fileClaimAction, {
    error: null,
  });

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {t.claims.file}
      </Button>
    );
  }

  return (
    <form
      action={submit}
      className="flex flex-col gap-3 rounded-control border border-line bg-sunken p-3"
    >
      <p className="text-[13px] font-semibold">{t.claims.fileTitle}</p>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.claims.kind} required>
          {(props) => (
            <Select {...props} name="kind" required defaultValue="CARGO_DAMAGE">
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t.claimKind[kind]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t.claims.stop}>
          {(props) => (
            <Select {...props} name="stop_id" defaultValue="">
              <option value="">{t.claims.stopWhole}</option>
              {stops.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.sequence + 1}. {stop.place_name || stop.city || stop.address}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label={t.claims.description} hint={t.claims.descriptionHint} required>
        {(props) => (
          <Textarea
            {...props}
            name="description"
            rows={3}
            minLength={10}
            maxLength={4000}
            required
          />
        )}
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.claims.amount} hint={t.claims.amountHint}>
          {(props) => <Input {...props} name="amount" inputMode="decimal" placeholder="0,00" />}
        </Field>
        <Field label={t.claims.attach} hint={t.claims.attachHint}>
          {(props) => (
            <Input {...props} name="file" type="file" accept={ACCEPT} className="pt-1.5" />
          )}
        </Field>
      </div>

      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending ? t.claims.submitting : t.claims.submit}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t.claims.cancel}
        </Button>
      </div>
    </form>
  );
}

/** Сообщение в ленту, с файлом или без. Форма очищается после отправки. */
export function ClaimComposer({ claimId }: { claimId: string }) {
  const { t, locale } = useI18n();
  const form = useRef<HTMLFormElement>(null);
  const [state, submit, pending] = useActionState<ClaimState, FormData>(commentClaimAction, {
    error: null,
  });

  useEffect(() => {
    if (state.done) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={submit} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="claim_id" value={claimId} />
      <Textarea
        name="body"
        rows={3}
        maxLength={4000}
        placeholder={t.claims.commentPlaceholder}
        aria-label={t.claims.comment}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="label-micro">{t.claims.attach}</span>
          <input name="file" type="file" accept={ACCEPT} className="max-w-56 text-xs" />
        </label>
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending ? t.claims.sending : t.claims.send}
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

/**
 * Решение по claim.
 *
 * Оператору — весь набор переходов; подавшему — одна кнопка «решено
 * между нами». Что кому можно, повторно проверит база: здесь лишь не
 * показывается кнопка, которая заведомо откажет.
 */
export function ClaimModeration({
  claimId,
  status,
  viewer,
  mine,
}: {
  claimId: string;
  status: ClaimStatus;
  viewer: PartyRole;
  mine: boolean;
}) {
  const { t, locale } = useI18n();
  const [state, submit, pending] = useActionState<ClaimState, FormData>(setClaimStatusAction, {
    error: null,
  });

  const closed = status === 'RESOLVED' || status === 'REJECTED';
  const admin = viewer === 'ADMIN';

  if (!admin && !(mine && !closed)) return null;

  const targets: Array<{
    status: ClaimStatus;
    label: string;
    variant: 'primary' | 'default' | 'danger';
  }> = admin
    ? closed
      ? [{ status: 'IN_REVIEW', label: t.claims.reopen, variant: 'default' }]
      : [
          ...(status === 'OPEN'
            ? [
                {
                  status: 'IN_REVIEW' as const,
                  label: t.claims.toReview,
                  variant: 'default' as const,
                },
              ]
            : []),
          { status: 'RESOLVED', label: t.claims.resolve, variant: 'primary' },
          { status: 'REJECTED', label: t.claims.reject, variant: 'danger' },
        ]
    : [{ status: 'RESOLVED', label: t.claims.settle, variant: 'default' }];

  return (
    <form action={submit} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="claim_id" value={claimId} />
      <Field
        label={admin ? t.claims.resolution : t.claims.comment}
        hint={admin ? t.claims.resolutionHint : t.claims.settleHint}
      >
        {(props) => <Textarea {...props} name="note" rows={2} maxLength={4000} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        {targets.map((target) => (
          <Button
            key={target.status}
            type="submit"
            name="status"
            value={target.status}
            size="sm"
            variant={target.variant}
            disabled={pending}
          >
            {target.label}
          </Button>
        ))}
      </div>
      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
