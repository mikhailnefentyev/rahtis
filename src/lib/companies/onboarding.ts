import 'server-only';

import { accountPath } from '@/lib/auth/paths';
import { siteUrl } from '@/lib/config';
import { operatorInbox, sendEmail } from '@/lib/email';
import { onboardingEmail, type OnboardingStage } from '@/lib/email/templates/onboarding';
import { emailLocaleOf } from '@/lib/email/text';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CompanyRole } from '@/types/db';
import { sendInvite } from './invite';

/**
 * Напоминания застрявшим на пути к первой работе.
 *
 * Зовёт база раз в день (app.run_onboarding_reminders). Шаг и с какого
 * момента компания на нём стоит — из onboarding_status(). На 2-й, 5-й и
 * 10-й день шага уходит по одному письму; что ушло — в onboarding_reminders,
 * повторный запуск в тот же день ничего не дублирует. Потом тишина:
 * оператор видит компанию в списке «Käyttöönotto» и звонит сам.
 *
 * Не открывшему приглашение — новое приглашение (старая ссылка живёт
 * сутки), остальным — письмо со ссылкой на нужное место кабинета.
 */

const DAYS = [10, 5, 2] as const;

export type OnboardingResult = { checked: number; sent: number; errors: string[] };

export async function sendOnboardingReminders(now = new Date()): Promise<OnboardingResult> {
  const admin = createAdminClient();
  const result: OnboardingResult = { checked: 0, sent: 0, errors: [] };

  const [{ data: list, error }, { data: sent, error: sentError }] = await Promise.all([
    admin.rpc('onboarding_status'),
    admin.from('onboarding_reminders').select('company_id, stage, day'),
  ]);
  if (error || sentError) {
    result.errors.push((error ?? sentError)!.message);
    return result;
  }

  const already = new Set((sent ?? []).map((r) => `${r.company_id}:${r.stage}:${r.day}`));
  const site = siteUrl();

  for (const c of list ?? []) {
    result.checked += 1;
    if (!c.stage || !c.stage_since || !c.contact_email) continue;

    const days = Math.floor((now.getTime() - new Date(c.stage_since).getTime()) / 86_400_000);
    /* Самое позднее из наступивших, если оно ещё не отправлено. Ранние пропущенные не догоняются. */
    const due = DAYS.find((d) => days >= d);
    if (!due || already.has(`${c.company_id}:${c.stage}:${due}`)) continue;

    try {
      let ok: boolean;
      if (c.stage === 'INVITE') {
        const role: CompanyRole = c.kind === 'SHIPPER' ? 'SHIPPER' : 'CARRIER';
        ok = await sendInvite(c.company_id, c.name, c.contact_email, role, c.language);
      } else {
        const locale = emailLocaleOf(c.language);
        const path =
          c.stage === 'ACTIVATE'
            ? accountPath(locale)
            : c.stage === 'SETUP'
              ? `/${locale}/carrier`
              : `/${locale}/shipper/orders`;
        const sentMail = await sendEmail(
          onboardingEmail({
            to: c.contact_email,
            companyName: c.name,
            companyId: c.company_id,
            stage: c.stage as OnboardingStage,
            link: `${site}${path}`,
            operatorEmail: operatorInbox(),
            locale,
          }),
        );
        ok = sentMail.outboxId !== null;
      }

      if (!ok) {
        result.errors.push(`${c.name}: письмо не ушло`);
        continue;
      }

      const { error: logError } = await admin
        .from('onboarding_reminders')
        .insert({ company_id: c.company_id, stage: c.stage, day: due });
      if (logError) result.errors.push(`${c.name}: журнал: ${logError.message}`);
      result.sent += 1;
    } catch (cause) {
      result.errors.push(`${c.name}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  return result;
}
