import 'server-only';

import { siteUrl } from '@/lib/config';
import { operatorInbox } from '@/lib/email';
import { renderEmail, renderText, type EmailBlock } from '@/lib/email/layout';
import { emailLocaleOf, emailText } from '@/lib/email/text';
import { getDictionary, getI18n } from '@/lib/i18n';
import { notify } from '@/lib/notify';
import { createAdminClient } from '@/lib/supabase/admin';
import { EXPIRY_WARNING_DAYS, isVerificationItem } from './items';

export type VerificationReminderResult = { checked: number; sent: number; errors: string[] };

/**
 * Напоминание за 14 дней до конца срока пункта пакета tilaajavastuu.
 *
 * Зовёт тот же ежедневный маршрут, что напоминания об удостоверениях
 * водителей (/api/reminders/certificates, база будит его в 06:10 UTC).
 * Одно напоминание на пункт и дату окончания: журнал
 * verification_reminders привязан к сроку — обновили справку, и через
 * три месяца всё начнётся заново.
 *
 * Перевозчику — уведомление в кабинете и письмо на companies.contact_email.
 * Значок гаснет сам (app.company_verified), напоминание — чтобы до этого
 * не дошло.
 */
export async function sendVerificationReminders(): Promise<VerificationReminderResult> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc('verification_expiring_items', { p_days: EXPIRY_WARNING_DAYS });
  if (error) return { checked: 0, sent: 0, errors: [error.message] };

  const result: VerificationReminderResult = { checked: rows?.length ?? 0, sent: 0, errors: [] };
  if (!rows || rows.length === 0) return result;

  const companyIds = [...new Set(rows.map((r) => r.company_id))];
  const [{ data: companies }, { data: sentRows }] = await Promise.all([
    admin.from('companies').select('id, language, contact_email').in('id', companyIds),
    admin.from('verification_reminders').select('company_id, item, valid_until').in('company_id', companyIds),
  ]);
  const sent = new Set((sentRows ?? []).map((r) => `${r.company_id}|${r.item}|${r.valid_until}`));
  const byId = new Map((companies ?? []).map((c) => [c.id, c]));

  const base = siteUrl();
  const operator = operatorInbox();

  for (const row of rows) {
    if (!isVerificationItem(row.item)) continue;
    if (sent.has(`${row.company_id}|${row.item}|${row.valid_until}`)) continue;
    const company = byId.get(row.company_id);
    if (!company) continue;

    /* Сначала журнал: второй параллельный запуск упрётся в первичный ключ. */
    const { error: logError } = await admin
      .from('verification_reminders')
      .insert({ company_id: row.company_id, item: row.item, valid_until: row.valid_until });
    if (logError) {
      if (logError.code !== '23505') result.errors.push(logError.message);
      continue;
    }

    /* Писем на двух языках (src/lib/email/text.ts), текст — из словаря того же языка. */
    const locale = emailLocaleOf(company.language);
    const [{ f }, t] = await Promise.all([getI18n(locale), getDictionary(locale)]);
    const mail = emailText(locale);
    const item = t.verification.items[row.item];
    const date = f.date(`${row.valid_until}T12:00:00Z`);
    const title = t.verification.reminderTitle.replace('{item}', item).replace('{date}', date);
    const lead = (row.source === 'PRH' ? t.verification.reminderLeadPrh : t.verification.reminderLead)
      .replace('{item}', item)
      .replace('{date}', date);
    const link = `${base}/${locale}/carrier/verification`;

    const blocks: EmailBlock[] = [
      { kind: 'text', value: mail.greeting },
      { kind: 'text', value: lead },
      { kind: 'button', label: t.verification.reminderButton, href: link },
    ];

    await notify({
      companyId: company.id,
      kind: 'MODERATION',
      title,
      body: lead,
      link: '/carrier/verification',
      email: company.contact_email
        ? {
            to: company.contact_email,
            template: 'verification.expiring',
            subject: `RAHTIS · ${title}`,
            text: renderText({ heading: title, blocks, operatorEmail: operator, signature: mail.signature, neverAsk: mail.neverAsk }),
            html: renderEmail({
              heading: title,
              preheader: lead,
              blocks,
              operatorEmail: operator,
              tagline: mail.brandTagline,
              neverAsk: mail.neverAsk,
            }),
          }
        : undefined,
    });

    result.sent += 1;
  }

  return result;
}
