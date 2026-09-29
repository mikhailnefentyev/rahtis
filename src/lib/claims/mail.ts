import 'server-only';

import { siteUrl } from '@/lib/config';
import { operatorInbox, sendEmail } from '@/lib/email';
import { claimEmail, claimMirrorEmail } from '@/lib/email/templates/claim';
import { emailLocaleOf } from '@/lib/email/text';
import { createFormat } from '@/lib/format';
import { getDictionary } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ClaimEventKind, ClaimKind, ClaimStatus, PartyRole } from '@/types/db';

/**
 * Общее для claims в кабинете и в API: файлы, виды и письма о событиях.
 * Вынесено из actions.ts, чтобы маршруты API слали те же письма, что и
 * кабинет, а не свою копию.
 */

export const BUCKET = 'claim-docs';
export const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export const KINDS = [
  'CARGO_DAMAGE',
  'SHORTAGE',
  'DOWNTIME',
  'DEVIATION',
  'OTHER',
] as const satisfies readonly ClaimKind[];
export const STATUSES = [
  'OPEN',
  'IN_REVIEW',
  'RESOLVED',
  'REJECTED',
] as const satisfies readonly ClaimStatus[];

/** Корень раздела claims для роли. */
export function section(role: PartyRole): string {
  return role === 'ADMIN'
    ? '/admin/claims'
    : role === 'CARRIER'
      ? '/carrier/claims'
      : '/shipper/claims';
}

/* ── Письма ────────────────────────────────────────────────────── */

const MIRROR_FACT = 'Välitetty';

/**
 * Письма о событии claim.
 *
 * Спор идёт через оператора (миграция claims_mirror):
 *
 *   подача     — второй стороне зеркало от имени Aivomaa Oy с полным
 *                текстом и вложениями, ответ приходит оператору; оператору —
 *                уведомление, куда ушло зеркало;
 *   сообщение  — подавшего получает оператор, с текстом; оператора —
 *                подавший; вторую сторону переписка в кабинете не касается,
 *                с ней оператор говорит почтой;
 *   статус     — обеим сторонам, кроме той, что его поставила.
 *
 * Reply-To у всех писем — ящик оператора: на что бы ни ответил человек,
 * ответ попадёт тому, кто ведёт спор, а не на noreply.
 */
export async function mailClaimEvent(
  claimId: string,
  event: ClaimEventKind,
  actor: PartyRole,
  message?: string | null,
) {
  try {
    const admin = createAdminClient();

    const { data: claim } = await admin
      .from('claims')
      .select(
        'id, ref, kind, status, filed_by_role, description, amount_cents, stop_id, resolution, order_id, filed_by_company_id, against_company_id',
      )
      .eq('id', claimId)
      .single();

    if (!claim) return;

    const [{ data: order }, { data: companies }, { data: stops }, { data: files }] =
      await Promise.all([
        admin
          .from('orders')
          .select('ref, shipper_company_id, closed_at, assigned_vehicle_id')
          .eq('id', claim.order_id)
          .single(),
        admin
          .from('companies')
          .select('id, name, language, contact_email, billing_email, frozen_at')
          .in('id', [claim.filed_by_company_id, claim.against_company_id]),
        admin
          .from('order_stops')
          .select('id, sequence, city, place_name')
          .eq('order_id', claim.order_id)
          .order('sequence'),
        admin
          .from('claim_attachments')
          .select('storage_path, file_name')
          .eq('claim_id', claimId)
          .order('created_at'),
      ]);

    if (!order) return;

    const base = siteUrl();
    const operator = operatorInbox();
    const filedBy = claim.filed_by_role === 'CARRIER' ? 'CARRIER' : 'SHIPPER';
    const roleOf = (companyId: string): PartyRole =>
      companyId === order.shipper_company_id ? 'SHIPPER' : 'CARRIER';

    /* Контактный адрес, а не бухгалтерский: спор ведёт диспетчер. */
    const reachable = (companyId: string) => {
      const company = (companies ?? []).find((c) => c.id === companyId);
      if (!company || company.frozen_at) return null;
      const to = company.contact_email ?? company.billing_email;
      return to ? { to, locale: emailLocaleOf(company.language) } : null;
    };

    const toParty = async (companyId: string) => {
      const target = reachable(companyId);
      if (!target) return;
      await sendEmail(
        claimEmail({
          event,
          to: target.to,
          companyId,
          locale: target.locale,
          claimRef: claim.ref,
          orderRef: order.ref,
          kind: claim.kind,
          status: claim.status,
          filedBy,
          resolution: claim.resolution,
          link: `${base}/${target.locale}${section(roleOf(companyId))}/${claim.id}`,
          operatorEmail: operator,
        }),
      );
    };

    const toOperator = (extraRows?: Array<[string, string]>) =>
      sendEmail(
        claimEmail({
          event,
          to: operator,
          companyId: null,
          locale: 'fi',
          claimRef: claim.ref,
          orderRef: order.ref,
          kind: claim.kind,
          status: claim.status,
          filedBy,
          resolution: claim.resolution,
          link: `${base}/fi/admin/claims/${claim.id}`,
          operatorEmail: operator,
          forOperator: true,
          extraRows,
          message,
        }),
      );

    if (event === 'CREATED') {
      const target = reachable(claim.against_company_id);
      let forwarded: string | null = null;

      if (target) {
        const f = createFormat((await getDictionary(target.locale)).meta.intl);
        const vehicle = order.assigned_vehicle_id
          ? ((
              await admin
                .from('vehicles')
                .select('plate')
                .eq('id', order.assigned_vehicle_id)
                .single()
            ).data?.plate ?? null)
          : null;
        const place = (stops ?? []).find((s) => s.id === claim.stop_id);
        const route = (stops ?? [])
          .map((s) => s.city || s.place_name)
          .filter(Boolean)
          .join(' – ');

        const result = await sendEmail(
          claimMirrorEmail({
            to: target.to,
            companyId: claim.against_company_id,
            locale: target.locale,
            claimRef: claim.ref,
            orderRef: order.ref,
            filedBy,
            kind: claim.kind,
            description: claim.description,
            route: route || null,
            closedAt: order.closed_at ? f.dateTime(order.closed_at) : null,
            vehicle,
            place: place ? `${place.sequence + 1}. ${place.place_name || place.city}` : null,
            amount: claim.amount_cents != null ? f.eur(claim.amount_cents) : null,
            attachments: (files ?? []).map((file) => ({
              bucket: BUCKET,
              path: file.storage_path,
              filename: file.file_name,
            })),
            link: `${base}/${target.locale}${section(roleOf(claim.against_company_id))}/${claim.id}`,
            operatorEmail: operator,
          }),
        );

        /*
         * Отметка о зеркале — когда письмо легло в журнал: по ней видно,
         * когда вторая сторона узнала о претензии. Сбой провайдера виден
         * оператору в журнале писем и в письме ему ниже.
         */
        if (result.outboxId !== null) {
          forwarded =
            result.sent || result.error === undefined
              ? target.to
              : `${target.to} (${result.error})`;
          await admin
            .from('claims')
            .update({ mirrored_at: new Date().toISOString(), mirrored_to: target.to })
            .eq('id', claimId);
        }
      }

      await toOperator([[MIRROR_FACT, forwarded ?? '—']]);
      return;
    }

    if (event === 'COMMENT' || event === 'ATTACHMENT') {
      if (actor === 'ADMIN') await toParty(claim.filed_by_company_id);
      else await toOperator();
      return;
    }

    /* STATUS */
    for (const companyId of [claim.filed_by_company_id, claim.against_company_id]) {
      if (actor !== 'ADMIN' && roleOf(companyId) === actor) continue;
      await toParty(companyId);
    }
    if (actor !== 'ADMIN') await toOperator();
  } catch (cause) {
    /* Письмо — дубль уведомления в кабинете; его сбой не отменяет действие. */
    console.error('claim: письмо не отправлено:', cause instanceof Error ? cause.message : cause);
  }
}
