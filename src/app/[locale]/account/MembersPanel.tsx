'use client';

import { useActionState, useState } from 'react';
import { Badge, Button, Field, Input } from '@/components/ui';
import { inviteMemberAction, removeMemberAction, type MemberState } from '@/lib/companies/members';
import { useI18n } from '@/lib/i18n/provider';
import { useKeepOnError } from '@/lib/forms/keepOnError';

/**
 * Пользователи компании: главный и его диспетчеры.
 *
 * Список видят все люди компании — диспетчер должен знать, кто ещё
 * работает в кабинете. Приглашает и убирает только главный: у остальных
 * вместо формы одна строка о том, к кому идти.
 */

export type Member = {
  user_id: string;
  full_name: string | null;
  email: string;
  member_kind: string;
  last_sign_in_at: string | null;
};

const initial: MemberState = { error: null, done: false };

export function MembersPanel({
  members,
  selfId,
  canManage,
}: {
  members: Member[];
  selfId: string;
  canManage: boolean;
}) {
  const { t, f, locale } = useI18n();
  const [state, inviteAction, pending] = useActionState(inviteMemberAction, initial);
  const keepInviteAction = useKeepOnError(state);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
        {members.map((member) => (
          <li key={member.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
            <span className="text-[13px] font-semibold">
              {member.full_name || member.email}
              {member.user_id === selfId && <span className="font-normal text-ink-dim"> · {t.members.you}</span>}
            </span>
            <Badge tone={member.member_kind === 'OWNER' ? 'info' : 'neutral'}>
              {member.member_kind === 'OWNER' ? t.members.owner : t.members.dispatcher}
            </Badge>
            {member.full_name && <span className="text-[13px] text-ink-muted">{member.email}</span>}
            <span className="text-xs text-ink-dim">
              {member.last_sign_in_at
                ? `${t.members.lastSeen} ${f.date(member.last_sign_in_at)}`
                : t.members.pending}
            </span>
            {canManage && member.member_kind === 'DISPATCHER' && <RemoveMember userId={member.user_id} />}
          </li>
        ))}
      </ul>

      {canManage ? (
        <form
          /* После успеха поля пустеют: следующего диспетчера вводят с чистого листа. */
          key={state.done ? `sent-${members.length}` : 'editing'}
          {...keepInviteAction}
          action={inviteAction}
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <input type="hidden" name="locale" value={locale} />
          <Field label={t.members.name}>
            {(p) => <Input {...p} name="full_name" required minLength={2} maxLength={120} autoComplete="off" />}
          </Field>
          <Field label={t.members.email}>
            {(p) => <Input {...p} name="email" type="email" required autoComplete="off" />}
          </Field>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? t.members.adding : t.members.add}
          </Button>

          {state.error && (
            <p role="alert" className="text-[13px] text-danger sm:col-span-3">
              {state.error}
            </p>
          )}
          {state.done && (
            <p role="status" className="text-[13px] text-ok sm:col-span-3">
              {t.members.invited}
            </p>
          )}
        </form>
      ) : (
        <p className="text-[13px] text-ink-muted">{t.members.ownerOnly}</p>
      )}
    </div>
  );
}

/** Снятие доступа — в два шага: вход и сессии человека гаснут сразу. */
function RemoveMember({ userId }: { userId: string }) {
  const { t, locale } = useI18n();
  const [state, removeAction, pending] = useActionState(removeMemberAction, initial);
  const keepRemoveAction = useKeepOnError(state);
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button size="sm" variant="danger" className="ml-auto" onClick={() => setAsking(true)}>
        {t.members.remove}
      </Button>
    );
  }

  return (
    <form {...keepRemoveAction} action={removeAction} className="ml-auto flex flex-wrap items-center gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="user_id" value={userId} />
      <span className="text-xs text-ink-muted">{state.error ?? t.members.removeConfirm}</span>
      <Button type="submit" size="sm" variant="danger" disabled={pending}>
        {t.members.remove}
      </Button>
      <Button type="button" size="sm" onClick={() => setAsking(false)}>
        {t.action.cancel}
      </Button>
    </form>
  );
}
