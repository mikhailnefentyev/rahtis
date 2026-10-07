import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { siteUrl } from '@/lib/config';
import { operatorInbox, sendEmail } from '@/lib/email';
import { operatorInviteEmail } from '@/lib/email/templates/operatorInvite';
import { createAdminClient } from '@/lib/supabase/admin';

/** Сколько в день: решение пользователя 7.10.2026 — пять и пять. */
const PER_DAY = { SHIPPER: 5, CARRIER: 5 } as const;

export type OutreachResult = { sent: number; skipped: number; failed: number; errors: string[] };

/**
 * Ежедневные приглашения от платформы.
 *
 * Берутся только утверждённые строки outreach_targets по очереди. Перед
 * отправкой — сверка: компания уже на платформе (Y-tunnus или адрес) или
 * её уже звали — строка пропускается, а не получает второе письмо.
 * Приглашение пишется в shipper_invites без перевозчика (origin
 * OPERATOR): ссылка заполняет заявку, связей с машинами не создаёт.
 */
export async function sendDailyOutreach(): Promise<OutreachResult> {
  const admin = createAdminClient();
  const result: OutreachResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

  for (const kind of ['SHIPPER', 'CARRIER'] as const) {
    let sentOfKind = 0;
    /* С запасом: пропущенные не должны съедать дневную норму. */
    const { data: queue, error } = await admin
      .from('outreach_targets')
      .select('id, company_name, business_id, email')
      .eq('kind', kind)
      .eq('status', 'QUEUED')
      .eq('approved', true)
      .order('priority')
      .order('created_at')
      .limit(PER_DAY[kind] * 4);
    if (error) {
      result.errors.push(`${kind}: ${error.message}`);
      continue;
    }

    for (const target of queue ?? []) {
      if (sentOfKind >= PER_DAY[kind]) break;

      const known = await alreadyKnown(admin, target.email, target.business_id);
      if (known) {
        await admin.from('outreach_targets').update({ status: 'SKIPPED', note: known }).eq('id', target.id);
        result.skipped += 1;
        continue;
      }

      const token = randomBytes(32).toString('hex');
      const { data: invite, error: inviteError } = await admin
        .from('shipper_invites')
        .insert({
          carrier_company_id: null,
          origin: 'OPERATOR',
          invite_kind: kind,
          token_hash: createHash('sha256').update(token).digest('hex'),
          company_name: target.company_name,
          business_id: target.business_id ?? '',
          email: target.email,
        })
        .select('id')
        .single();
      if (inviteError || !invite) {
        await admin.from('outreach_targets').update({ status: 'FAILED', error: inviteError?.message ?? 'invite' }).eq('id', target.id);
        result.failed += 1;
        result.errors.push(`${target.email}: ${inviteError?.message ?? 'invite'}`);
        continue;
      }

      const mail = await sendEmail(
        operatorInviteEmail({
          to: target.email,
          kind,
          link: `${siteUrl()}/fi/apply?invite=${token}`,
          operatorEmail: operatorInbox(),
          locale: 'fi',
        }),
      );

      if (mail.sent) {
        await admin
          .from('outreach_targets')
          .update({ status: 'SENT', sent_at: new Date().toISOString(), invite_id: invite.id, error: null })
          .eq('id', target.id);
        result.sent += 1;
        sentOfKind += 1;
      } else {
        await admin.from('shipper_invites').delete().eq('id', invite.id);
        await admin.from('outreach_targets').update({ status: 'FAILED', error: mail.error ?? 'send' }).eq('id', target.id);
        result.failed += 1;
        result.errors.push(`${target.email}: ${mail.error ?? 'send'}`);
      }
    }
  }

  return result;
}

/** Компания уже на платформе или уже приглашена — причина словами, иначе null. */
async function alreadyKnown(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  businessId: string | null,
): Promise<string | null> {
  const { data: byEmail } = await admin
    .from('companies')
    .select('id')
    .eq('contact_email', email)
    .is('client_of', null)
    .limit(1);
  if (byEmail?.length) return 'уже на платформе (адрес)';

  if (businessId) {
    const { data: byId } = await admin
      .from('companies')
      .select('id')
      .eq('business_id', businessId)
      .is('client_of', null)
      .neq('status', 'REJECTED')
      .limit(1);
    if (byId?.length) return 'уже на платформе (Y-tunnus)';
  }

  const { data: invited } = await admin.from('shipper_invites').select('id').eq('email', email).limit(1);
  if (invited?.length) return 'уже приглашена';

  return null;
}
